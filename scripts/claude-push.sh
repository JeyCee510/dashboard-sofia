#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# claude-push.sh — permite que Claude haga commit + push sin intervención.
#
# Uso:  ./scripts/claude-push.sh "mensaje del commit"
#
# El token se lee de `.claude-gh-token` (gitignored, nunca se sube).
# Crea el token en: https://github.com/settings/tokens
#   → "Generate new token (classic)" → marca el permiso `repo` → copiar.
# Para revocarlo: borra el token en esa misma página (o vacía el archivo).
#
# Notas:
#  · El token nunca se imprime ni se escribe en el repo.
#  · Se usa sólo para el push a este repositorio.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

MSG="${1:-cambios desde Claude}"
TOKEN_FILE=".claude-gh-token"
REPO_URL="https://github.com/JeyCee510/dashboard-sofia.git"

# ── Cómo nos autenticamos ──────────────────────────────────────────────
# 1º) GitHub CLI. Si ya hiciste `gh auth login`, la credencial vive en el
#     llavero de macOS, se renueva sola y no hay ningún token en texto plano
#     dando vueltas. Es el camino preferido.
# 2º) El archivo .claude-gh-token (classic PAT). Queda como respaldo porque
#     los tokens classic CADUCAN: el 13-sep-2026 el push falló con
#     "Invalid username or token" justamente por eso.
USAR_GH=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  USAR_GH=1
  echo "• Autenticando con GitHub CLI (llavero de macOS)"
else
  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo "✗ No hay sesión de 'gh' ni $TOKEN_FILE."
    echo "  Lo más simple: corre 'gh auth login' una vez y listo."
    exit 1
  fi
  TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"
  if [[ -z "$TOKEN" || "$TOKEN" == "PEGA_AQUI_TU_TOKEN" ]]; then
    echo "✗ El token está vacío o es el placeholder."
    echo "  Alternativa recomendada: 'gh auth login' (sin tokens que caduquen)."
    exit 1
  fi
  echo "• Autenticando con el token de $TOKEN_FILE"
fi

# Empuja usando el método disponible. Con gh la URL va limpia (la credencial
# la resuelve el helper); con token va embebida y NUNCA se imprime.
empujar() {
  if [[ "$USAR_GH" == "1" ]]; then
    git -c credential.helper='!gh auth git-credential' push -q "$REPO_URL" HEAD:main
  else
    git push -q "https://x-access-token:${TOKEN}@github.com/JeyCee510/dashboard-sofia.git" HEAD:main
  fi
}

# Los locks quedan si un proceso git anterior se cortó; limpiarlos es seguro
# cuando no hay otro git corriendo.
rm -f .git/*.lock 2>/dev/null || true

# En el sandbox de Cowork el mount puede impedir borrar .git/*.lock ("Operation
# not permitted"). En ese caso git local es inusable: se hace el push por un
# clon temporal, copiando el árbol de trabajo (sin .git ni node_modules).
if ls .git/*.lock >/dev/null 2>&1; then
  echo "• .git bloqueado por el mount → push vía clon temporal"
  TMP="$(mktemp -d)"
  git clone -q --depth 1 "https://x-access-token:${TOKEN}@github.com/JeyCee510/dashboard-sofia.git" "$TMP/repo"
  rsync -a --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
    --exclude '.claude-gh-token' --exclude 'backups' \
    ./ "$TMP/repo/"
  cd "$TMP/repo"
  git add -A
  if git diff --cached --quiet; then
    echo "• No hay cambios que commitear."; exit 0
  fi
  git -c user.email="jclira@gmail.com" -c user.name="Juan Cristobal Lira" commit -q -m "$MSG"
  empujar
  echo "✓ Push a main OK (vía clon)"
  git log --oneline -1
  echo "⚠ Tu carpeta local quedó detrás: corre 'git pull' cuando puedas."
  exit 0
fi

git add -A

if git diff --cached --quiet; then
  echo "• No hay cambios que commitear."
else
  git -c user.email="jclira@gmail.com" -c user.name="Juan Cristobal Lira" commit -q -m "$MSG"
  echo "✓ Commit: $MSG"
fi

if empujar 2>/dev/null; then
  echo "✓ Push a main OK"
  git log --oneline -1
else
  echo "✗ Falló el push."
  if [[ "$USAR_GH" == "1" ]]; then
    echo "  Revisa la sesión con 'gh auth status' (o 'gh auth login' de nuevo)."
  else
    echo "  El token de $TOKEN_FILE caducó o perdió el permiso 'repo'."
    echo "  Camino recomendado: 'gh auth login' y olvidarte del archivo."
  fi
  exit 1
fi

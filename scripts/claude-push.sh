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

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "✗ Falta $TOKEN_FILE (crea el token y pégalo ahí)."; exit 1
fi

TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"
if [[ -z "$TOKEN" || "$TOKEN" == "PEGA_AQUI_TU_TOKEN" ]]; then
  echo "✗ El token está vacío o es el placeholder. Pega tu token en $TOKEN_FILE."; exit 1
fi

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
  git push -q "https://x-access-token:${TOKEN}@github.com/JeyCee510/dashboard-sofia.git" HEAD:main
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

# Push con el token en la URL (no queda guardado: no se usa `remote set-url`)
REMOTE_URL="https://x-access-token:${TOKEN}@github.com/JeyCee510/dashboard-sofia.git"
if git push -q "$REMOTE_URL" HEAD:main 2>/dev/null; then
  echo "✓ Push a main OK"
  git log --oneline -1
else
  echo "✗ Falló el push. Revisa que el token tenga permiso 'repo' y no haya caducado."
  exit 1
fi

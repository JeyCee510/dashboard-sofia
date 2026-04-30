#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Redeploy de la Edge Function `voice-command` a Supabase.
#
# Uso:
#   ./scripts/deploy-voice-command.sh
#   o equivalente: npm run deploy:voice
#
# Pre-requisitos (una sola vez):
#   1. brew install supabase/tap/supabase   (ya hecho)
#   2. supabase login                       (genera y guarda el access token)
#
# Si nunca te has logueado, este script lo intenta primero. Después de eso
# basta con correrlo cada vez que cambies el código de la edge function.
# ─────────────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="orceickorgdynlsbskvx"
FUNCTION="voice-command"

# Verificar CLI
if ! command -v supabase &>/dev/null; then
  echo "❌ Supabase CLI no está instalado."
  echo "   Instálalo con: brew install supabase/tap/supabase"
  exit 1
fi

# Verificar login (intenta listar projects; si falla, login)
if ! supabase projects list &>/dev/null; then
  echo "🔑 Necesitas login en Supabase. Abriendo browser..."
  supabase login
fi

echo "🚀 Deployando función '$FUNCTION' a proyecto $PROJECT_REF..."
supabase functions deploy "$FUNCTION" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "✅ Deploy completo. La función ya está activa con el código más reciente."

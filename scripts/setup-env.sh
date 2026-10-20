#!/bin/bash
# Asks for each Supabase value and writes it into .env.local.
# Secret values are typed/pasted invisibly and never shown on screen.
cd "$(dirname "$0")/.." || exit 1
FILE=.env.local

set_value() {
  local key="$1" value="$2"
  value="$(printf '%s' "$value" | tr -d '\r\n' | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//')"
  if [ -z "$value" ]; then echo "   (skipped, left as it was)"; return; fi
  local tmp; tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" 'BEGIN{done=0} $0 ~ "^"k"=" {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' "$FILE" > "$tmp" && mv "$tmp" "$FILE"
  echo "   ✓ saved"
}

echo ""
echo "Paste each value, then press Return. Press Return on its own to skip one."
echo ""

read -r -p "1/5  Project URL (https://....supabase.co): " v; set_value NEXT_PUBLIC_SUPABASE_URL "$v"
read -r -p "2/5  anon / publishable key: " v; set_value NEXT_PUBLIC_SUPABASE_ANON_KEY "$v"
read -r -s -p "3/5  service_role / secret key (hidden as you paste): " v; echo; set_value SUPABASE_SERVICE_ROLE_KEY "$v"
read -r -s -p "4/5  Session pooler connection string, password already filled in (hidden): " v; echo
if printf '%s' "$v" | grep -q 'YOUR-PASSWORD'; then
  read -r -s -p "     It still says [YOUR-PASSWORD]. Type your database password (hidden): " pw; echo
  v="${v//\[YOUR-PASSWORD\]/$pw}"
fi
set_value DATABASE_URL "$v"
read -r -p "5/5  Your email (for producer access): " v; set_value PRODUCER_EMAILS "$v"

echo ""
echo "All done. Go back to Claude and say \"done\"."

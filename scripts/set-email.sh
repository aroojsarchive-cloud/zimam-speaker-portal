#!/bin/bash
# Connects email sending (Resend). Asks for the API key (hidden), checks it,
# shows which sending domains are verified, then saves everything locally AND
# on the live site, and redeploys so it takes effect.
cd "$(dirname "$0")/.." || exit 1

echo ""
echo "Paste your Resend API key (starts with re_). Nothing will show as you paste."
read -r -s -p "Resend API key: " KEY; echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
case "$KEY" in re_*) ;; *) echo "✗ That doesn't look like a Resend key (it should start with re_)."; exit 1 ;; esac

DOMAINS="$(curl -s -H "Authorization: Bearer $KEY" https://api.resend.com/domains)"
VERIFIED="$(printf '%s' "$DOMAINS" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  let j; try { j = JSON.parse(d) } catch { console.log("ERR"); return }
  if (!j.data) { console.log("ERR:" + (j.message || "unknown")); return }
  for (const x of j.data) console.error(`   ${x.status === "verified" ? "✓" : "…"} ${x.name} (${x.status})`);
  console.log(j.data.filter(x => x.status === "verified").map(x => x.name).join(" "));
})')"
case "$VERIFIED" in
  ERR*) echo "✗ Resend didn't accept that key (${VERIFIED#ERR:}). Copy it again from resend.com → API Keys."; exit 1 ;;
esac
echo "✓ Key works."
if [ -z "$VERIFIED" ]; then
  echo ""
  echo "No sending domain is verified yet, so emails can't go to speakers."
  echo "In Resend → Domains, add your domain and give the DNS records to whoever manages it."
  echo "Run this again once it shows 'verified'."
  exit 1
fi

FIRST="${VERIFIED%% *}"
echo ""
read -r -p "Send from which address? [speakers@$FIRST]: " FROM_ADDR
FROM_ADDR="${FROM_ADDR:-speakers@$FIRST}"
FROM_DOMAIN="${FROM_ADDR##*@}"
case " $VERIFIED " in *" $FROM_DOMAIN "*) ;; *) echo "✗ $FROM_DOMAIN isn't a verified domain in Resend. Verified: $VERIFIED"; exit 1 ;; esac
FROM="ZIMAM Digital Health Forum <$FROM_ADDR>"

# Save locally.
for pair in "RESEND_API_KEY=$KEY" "EMAIL_FROM=\"$FROM\""; do
  k="${pair%%=*}"
  tmp="$(mktemp)"
  awk -v k="$k" -v line="$pair" 'BEGIN{d=0} index($0, k"=")==1 {print line; d=1; next} {print} END{if(!d) print line}' .env.local > "$tmp" && mv "$tmp" .env.local
done
echo "✓ Saved on this Mac."

# Save on the live site and redeploy.
printf '%s' "$KEY" | vercel env add RESEND_API_KEY production --force >/dev/null 2>&1 \
  && printf '%s' "$FROM" | vercel env add EMAIL_FROM production --force >/dev/null 2>&1 \
  && echo "✓ Saved on the live site." || { echo "✗ Couldn't save to Vercel. Tell Claude."; exit 1; }
echo "Updating the live site (about a minute)…"
if vercel deploy --prod --yes 2>&1 | grep -q "Aliased"; then
  echo "✓ Live site updated. Emails will now be sent from $FROM_ADDR."
else
  echo "✗ Redeploy didn't finish. Tell Claude."
fi
echo ""
echo "Go back to Claude and say \"done\"."

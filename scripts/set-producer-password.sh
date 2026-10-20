#!/bin/bash
# Sets (or resets) the password a producer uses to sign in. Hidden as you type.
# Usage: scripts/set-producer-password.sh [email]
cd "$(dirname "$0")/.." || exit 1
EMAIL="$1"
[ -z "$EMAIL" ] && read -r -p "Producer email: " EMAIL
read -r -s -p "New password (at least 10 characters, hidden): " PW1; echo
read -r -s -p "Type it again: " PW2; echo
[ "$PW1" != "$PW2" ] && { echo "✗ They don't match. Run this again."; exit 1; }
[ ${#PW1} -lt 10 ] && { echo "✗ Too short: use at least 10 characters."; exit 1; }
P_EMAIL="$EMAIL" P_PW="$PW1" npx tsx scripts/set-producer-password.mts

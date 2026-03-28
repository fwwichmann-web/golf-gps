#!/bin/bash
# Deploy golf app to rebelgolf.co.za
# Usage: ./deploy.sh

SERVER="rebelhqabt@197.242.67.72"
PORT="2222"
REMOTE_PATH="/usr/home/rebelhqabt/public_html/"
LOCAL_PATH="$(dirname "$0")/"

echo "🏌️  Deploying to rebelgolf.co.za..."

rsync -avz --progress \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='deploy.sh' \
  --exclude='node_modules' \
  -e "ssh -p $PORT -i ~/.ssh/id_rsa_rebelgolf -o IdentitiesOnly=yes" \
  "$LOCAL_PATH" \
  "$SERVER:$REMOTE_PATH"

echo "✅ Done — https://rebelgolf.co.za"

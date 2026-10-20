#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! source tools/distribution/ensure-node-mac.sh; then
  read -r -p 'Press Return to close. ' reply
  exit 1
fi
node tools/distribution/launcher.mjs configure
result=$?
if [ "$result" -ne 0 ]; then read -r -p 'Press Return to close. ' reply; fi
exit "$result"

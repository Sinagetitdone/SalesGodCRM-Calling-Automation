#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 from https://nodejs.org/en/download and reopen this file.'
  read -r -p 'Press Return to close. ' reply
  exit 1
fi
node tools/distribution/launcher.mjs start
result=$?
if [ "$result" -ne 0 ]; then read -r -p 'Press Return to close. ' reply; fi
exit "$result"

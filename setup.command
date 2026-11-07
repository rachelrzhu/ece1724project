#!/bin/sh
# macOS: double-click this file, or run `sh setup.command` in Terminal.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '\nInstall Node.js version 24 from https://nodejs.org/en/download first.\nThen close and reopen Terminal and run this file again.\n'
  if [ -t 0 ]; then
    printf '\nPress Enter to close...'
    read -r setup_reply
  fi
  exit 1
fi

node scripts/setup.mjs "$@"
setup_exit_code=$?
if [ "$setup_exit_code" -ne 0 ] && [ -t 0 ]; then
  printf '\nPress Enter to close...'
  read -r setup_reply
fi
exit "$setup_exit_code"

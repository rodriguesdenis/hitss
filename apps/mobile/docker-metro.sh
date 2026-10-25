#!/bin/sh
set -eu

mode="${EXPO_DEV_MODE:-tunnel}"
case "$mode" in
  tunnel | lan | localhost) ;;
  *)
    echo "EXPO_DEV_MODE must be tunnel, lan or localhost (got: $mode)" >&2
    exit 64
    ;;
esac

if [ "$mode" = lan ] && [ -z "${REACT_NATIVE_PACKAGER_HOSTNAME:-}" ]; then
  echo "EXPO_DEV_MODE=lan needs REACT_NATIVE_PACKAGER_HOSTNAME set to this computer's LAN IP" >&2
  exit 64
fi

exec pnpm exec expo start --port 8081 "--$mode"

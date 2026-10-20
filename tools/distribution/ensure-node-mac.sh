#!/bin/bash
# Sourced by the Mac launchers. Downloads stay inside this installation.
salesgod_ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    case "$(node --version 2>/dev/null)" in v24.*) return 0 ;; esac
  fi
  if [ "$(uname -s)" != Darwin ]; then echo 'The Mac launcher requires macOS.'; return 1; fi
  local version arch name archive expected cache runtime_home
  version="$(tr -d '\r\n' < tools/distribution/NODE-VERSION.txt)"
  if [[ ! "$version" =~ ^v24\.[0-9]+\.[0-9]+$ ]]; then echo 'Invalid Node version.'; return 1; fi
  case "$(uname -m)" in arm64) arch=arm64 ;; x86_64) arch=x64 ;; *) echo 'This package needs an Intel or Apple Silicon Mac.'; return 1 ;; esac
  name="node-$version-darwin-$arch"; archive="$name.tar.gz"
  expected="$(awk -v file="$archive" '$2 == file {print $1}' tools/distribution/NODE-SHASUMS256.txt)"
  if [[ ! "$expected" =~ ^[a-f0-9]{64}$ ]]; then echo 'Missing pinned Node checksum.'; return 1; fi
  cache="$PWD/.runtime"; runtime_home="$cache/$name"
  echo 'Preparing a private Node.js 24 runtime from nodejs.org. Internet is needed on first use.'
  (
    set -e
    mkdir -p "$cache" || exit 1
    if ! mkdir "$cache/download-lock" 2>/dev/null; then echo 'Node setup is already running, or a previous setup was interrupted. Ask IT to review .runtime/download-lock if no setup window is open.'; exit 1; fi
    trap 'rmdir "$cache/download-lock" 2>/dev/null || true' EXIT
    if [ ! -f "$cache/$archive" ]; then
      curl --fail --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 20 --max-time 180 "https://nodejs.org/dist/$version/$archive" -o "$cache/$archive.partial" || exit 1
      if [ "$(shasum -a 256 "$cache/$archive.partial" | awk '{print $1}')" != "$expected" ]; then echo 'Node download checksum failed; nothing will run.'; exit 1; fi
      mv -f "$cache/$archive.partial" "$cache/$archive" || exit 1
    fi
    if [ "$(shasum -a 256 "$cache/$archive" | awk '{print $1}')" != "$expected" ]; then echo 'Cached Node checksum failed; ask IT to review .runtime.'; exit 1; fi
    if [ ! -x "$runtime_home/bin/node" ]; then tar -xzf "$cache/$archive" -C "$cache" || exit 1; fi
    if [ "$("$runtime_home/bin/node" --version)" != "$version" ] || [ ! -f "$runtime_home/bin/npm" ]; then echo 'Node/npm verification failed.'; exit 1; fi
  ) || return 1
  export PATH="$runtime_home/bin:$PATH"
}
salesgod_ensure_node

#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
xcrun clang -fobjc-arc -fblocks tests/hls-proxy.m -framework Foundation -framework Network -framework JavaScriptCore -o dist/hls-proxy-test
dist/hls-proxy-test "$PWD/Web/hls-cleaner.js"

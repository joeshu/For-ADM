#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm run build:web
sdk_path="$(xcrun --sdk iphoneos --show-sdk-path)"
mkdir -p dist/sdk
xcrun --sdk iphoneos clang -isysroot "$sdk_path" -target arm64-apple-ios15.0 -fobjc-arc -fblocks -Oz Sources/main.m -framework UIKit -framework Foundation -framework WebKit -framework AVKit -framework AVFoundation -framework CoreMedia -framework CoreGraphics -framework Security -framework Network -framework JavaScriptCore -Wl,-no_adhoc_codesign -Wl,-no_fixup_chains -Wl,-headerpad,0x1000 -o dist/sdk/Sanyuan
python3 tools/cross-build.py --binary dist/sdk/Sanyuan
python3 tools/check-ipa.py dist/Sanyuan-0.2.36-unsigned.ipa

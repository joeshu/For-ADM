#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm run build:web
sdk_path="$(xcrun --sdk iphoneos --show-sdk-path)"
toolchain_path="$(xcode-select -p)/Toolchains/XcodeDefault.xctoolchain"
mkdir -p dist/sdk dist/swift-runtime
swift_sources=()
while IFS= read -r swift_source; do swift_sources+=("$swift_source"); done < <(find DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit -name '*.swift' -type f | sort)
if [[ ${#swift_sources[@]} -eq 0 ]]; then
  echo "DetailPlayerStabilityKit has no Swift sources" >&2
  exit 1
fi
xcrun --sdk iphoneos swiftc -sdk "$sdk_path" -target arm64-apple-ios15.0 -module-name SanyuanPlayback \
  -parse-as-library -whole-module-optimization -O -emit-object -emit-module -emit-module-path dist/sdk/SanyuanPlayback.swiftmodule \
  -emit-objc-header -emit-objc-header-path dist/sdk/SanyuanPlayback-Swift.h \
  "${swift_sources[@]}" -o dist/sdk/playback.o
echo "Built the Swift playback module. Compiling the Objective-C host."
xcrun --sdk iphoneos clang -isysroot "$sdk_path" -I dist/sdk -target arm64-apple-ios15.0 -fobjc-arc -fblocks -Oz -c Sources/main.m -o dist/sdk/main.o
echo "Built the Objective-C host. Compiling the Cicada wrapper."
xcrun --sdk iphoneos clang -isysroot "$sdk_path" -target arm64-apple-ios15.0 -fobjc-arc -fblocks -Oz -c Sources/SYCicadaLivePlayer.m -o dist/sdk/cicada.o
echo "Built the Cicada wrapper. Linking the iOS app."
xcrun --sdk iphoneos swiftc -sdk "$sdk_path" -target arm64-apple-ios15.0 -module-name SanyuanApp \
  dist/sdk/main.o dist/sdk/cicada.o dist/sdk/playback.o \
  -framework UIKit -framework Foundation -framework WebKit -framework AVKit -framework AVFoundation \
  -framework CoreMedia -framework CoreGraphics -framework Security -framework Network -framework JavaScriptCore \
  -F Frameworks -framework CicadaPlayerSDK -framework alivcffmpeg \
  -Xlinker -rpath -Xlinker @executable_path/Frameworks -lz \
  -Xlinker -no_adhoc_codesign -Xlinker -no_fixup_chains -Xlinker -headerpad -Xlinker 0x1000 \
  -o dist/sdk/Sanyuan
echo "Linked the iOS app. Collecting the Swift runtime and packaging the IPA."
swift_libraries="$toolchain_path/usr/lib/swift/iphoneos"
if [[ ! -d "$swift_libraries" ]]; then swift_libraries="$toolchain_path/usr/lib/swift-5.0/iphoneos"; fi
if [[ ! -d "$swift_libraries" ]]; then
  echo "Could not find the iPhoneOS Swift standard libraries in $toolchain_path/usr/lib" >&2
  exit 1
fi
"$toolchain_path/usr/bin/swift-stdlib-tool" --copy --scan-executable dist/sdk/Sanyuan \
  --destination dist/swift-runtime --platform iphoneos --source-libraries "$swift_libraries"
python3 tools/cross-build.py --binary dist/sdk/Sanyuan --swift-support dist/swift-runtime
version="$(node -p "require('./package.json').version")"
python3 tools/check-ipa.py "dist/Sanyuan-${version}-unsigned.ipa"

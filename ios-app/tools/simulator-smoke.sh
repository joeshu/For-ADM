#!/bin/bash
# Uses a separately compiled simulator executable. The device IPA stays unsigned.
set -euo pipefail
cd "$(dirname "$0")/.."
simulator_failure() {
  status=$1; line=$2; command=$3
  trap - ERR
  set +e
  printf 'Simulator smoke failed at line %s: %s (exit %s)\n' "$line" "$command" "$status" >&2
  mkdir -p dist
  if [ -n "${sim_device:-}" ]; then
    xcrun simctl list devices available >&2
    xcrun simctl spawn "$sim_device" log show --last 2m --style compact --predicate 'process == "Sanyuan" OR eventMessage CONTAINS[c] "Sanyuan"' 2>&1 | tail -n 250 > dist/simulator-system.log
    xcrun simctl io "$sim_device" screenshot dist/simulator-failure.png >&2
  fi
  exit "$status"
}
trap 'simulator_failure "$?" "$LINENO" "$BASH_COMMAND"' ERR
sdk_path="$(xcrun --sdk iphonesimulator --show-sdk-path)"
sim_arch="$(uname -m)"
toolchain_path="$(xcode-select -p)/Toolchains/XcodeDefault.xctoolchain"
mkdir -p dist/simulator dist/simulator/sdk
cp -R dist/Payload/Sanyuan.app dist/simulator/
sim_app="$PWD/dist/simulator/Sanyuan.app"
rm -f "$sim_app"/Frameworks/libswift*.dylib
swift_sources=()
while IFS= read -r swift_source; do swift_sources+=("$swift_source"); done < <(find DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit -name '*.swift' -type f | sort)
if [[ ${#swift_sources[@]} -eq 0 ]]; then
  echo "DetailPlayerStabilityKit has no Swift sources" >&2
  exit 1
fi
sim_target="$sim_arch-apple-ios15.0-simulator"
xcrun --sdk iphonesimulator swiftc -sdk "$sdk_path" -target "$sim_target" -module-name SanyuanPlayback \
  -parse-as-library -whole-module-optimization -O -emit-object -emit-module \
  -emit-module-path dist/simulator/sdk/SanyuanPlayback.swiftmodule \
  -emit-objc-header -emit-objc-header-path dist/simulator/sdk/SanyuanPlayback-Swift.h \
  "${swift_sources[@]}" -o dist/simulator/sdk/playback.o
xcrun --sdk iphonesimulator clang -isysroot "$sdk_path" -I dist/simulator/sdk -target "$sim_target" \
  -DSY_SIMULATOR_SMOKE=1 -fobjc-arc -fblocks -Oz -c Sources/main.m -o dist/simulator/sdk/main.o
xcrun --sdk iphonesimulator clang -isysroot "$sdk_path" -target "$sim_target" \
  -fobjc-arc -fblocks -Oz -c Sources/SYCicadaLivePlayer.m -o dist/simulator/sdk/cicada.o
xcrun --sdk iphonesimulator swiftc -sdk "$sdk_path" -target "$sim_target" -module-name SanyuanSimulator \
  dist/simulator/sdk/main.o dist/simulator/sdk/cicada.o dist/simulator/sdk/playback.o \
  -framework UIKit -framework Foundation -framework WebKit -framework AVKit -framework AVFoundation \
  -framework CoreMedia -framework CoreGraphics -framework Security -framework Network -framework JavaScriptCore \
  -lz -Xlinker -rpath -Xlinker @executable_path/Frameworks -o "$sim_app/Sanyuan"
sim_swift_libraries="$toolchain_path/usr/lib/swift/iphonesimulator"
if [[ ! -f "$sim_swift_libraries/libswiftCore.dylib" ]]; then sim_swift_libraries="$toolchain_path/usr/lib/swift-5.0/iphonesimulator"; fi
if [[ ! -f "$sim_swift_libraries/libswiftCore.dylib" ]]; then
  echo "Could not find the iOS Simulator Swift standard libraries in $toolchain_path/usr/lib" >&2
  exit 1
fi
"$toolchain_path/usr/bin/swift-stdlib-tool" --copy --verbose --verbose --scan-executable "$sim_app/Sanyuan" \
  --unsigned-destination "$sim_app/Frameworks" --platform iphonesimulator --source-libraries "$sim_swift_libraries"
python3 - "$sim_app/Info.plist" <<'PY'
import sys,plistlib
p=sys.argv[1]
with open(p,'rb') as f:d=plistlib.load(f)
d['CFBundleSupportedPlatforms']=['iPhoneSimulator'];d.pop('UIRequiredDeviceCapabilities',None)
with open(p,'wb') as f:plistlib.dump(d,f)
PY
codesign --deep --force --sign - --timestamp=none "$sim_app"
sim_device="${SIMULATOR_UDID:-$(xcrun simctl list devices available --json | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["udid"] for k,v in d["devices"].items() if ".iOS-" in k for x in v if x.get("isAvailable") and x["name"].startswith("iPhone")))')}"
# Fresh GitHub runners normally have no booted device.
xcrun simctl boot "$sim_device" || true
xcrun simctl bootstatus "$sim_device" -b
xcrun simctl install "$sim_device" "$sim_app"
sim_data="$(xcrun simctl get_app_container "$sim_device" com.joeshu.sanyuan data)"
xcrun simctl launch "$sim_device" com.joeshu.sanyuan
sim_data="$(xcrun simctl get_app_container "$sim_device" com.joeshu.sanyuan data)"
for attempt in $(seq 1 200); do
  if [ -f "$sim_data/Library/Caches/sanyuan-smoke.json" ] && [ ! -f dist/simulator-smoke.json ]; then
    cp "$sim_data/Library/Caches/sanyuan-smoke.json" dist/simulator-smoke.json
    xcrun simctl io "$sim_device" screenshot dist/simulator-home.png
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-discover-smoke.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-discover-smoke.json" dist/simulator-discover-smoke.json
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-playback-smoke.json" ]; then
    [ -f dist/simulator-playback-smoke.json ] || cp "$sim_data/Library/Caches/sanyuan-playback-smoke.json" dist/simulator-playback-smoke.json
    [ -f dist/simulator-playback.png ] || xcrun simctl io "$sim_device" screenshot dist/simulator-playback.png
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-live-smoke.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-live-smoke.json" dist/simulator-live-smoke.json
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-live-video-smoke.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-live-video-smoke.json" dist/simulator-live-video-smoke.json
    live_video_status="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status", "unknown"))' dist/simulator-live-video-smoke.json)"
    if [ "$live_video_status" = "videoReady" ]; then
      xcrun simctl io "$sim_device" screenshot dist/simulator-live-video.png
    elif [ "$live_video_status" = "failed" ]; then
      cat dist/simulator-live-video-smoke.json >&2
      exit 1
    fi
  fi
  if [ -f dist/simulator-discover-smoke.json ] && [ -f dist/simulator-playback-smoke.json ] && [ -f dist/simulator-live-smoke.json ] && [ -f dist/simulator-live-video-smoke.json ] && [ -f dist/simulator-live-video.png ]; then
    cat dist/simulator-smoke.json dist/simulator-discover-smoke.json dist/simulator-playback-smoke.json dist/simulator-live-smoke.json dist/simulator-live-video-smoke.json
    python3 -c 'import json; s=json.load(open("dist/simulator-smoke.json")); d=json.load(open("dist/simulator-discover-smoke.json")); p=json.load(open("dist/simulator-playback-smoke.json")); l=json.load(open("dist/simulator-live-smoke.json")); v=json.load(open("dist/simulator-live-video-smoke.json")); assert s["encryptedPosterDecoder"], s; assert d["nativeDiscoverPage"] and d["bottomNavigationItems"]>=5 and d["paginationCursorIsString"], d; assert p["hlsProxyActive"] and p["inlinePlayback"] and p["nativePageController"], p; assert l["nativeLiveScreen"] and l["embeddedLiveScreen"] and l["pinnedPlayerHost"] and l["airplayRoutePicker"] and l["livePlayerAttachedToHost"] and l["livePlayerFillsHost"] and l["livePlayerResizesWithHost"] and l["avPlayerControllerEmbedded"] and l["avPlayerControllerResizesWithHost"] and l["routePickerAbovePlayer"] and l["categoryActionReachedBridge"] and l["categorySwitchReturnsToTop"] and l["fastSwitchUpdatesWithoutRebuild"] and l["gzipEPGDecoded"], l; assert v["status"]=="videoReady" and v["rendererAttached"] and v["rendererReady"] and v["playURLIsLoopback"] and v["presentationWidth"]>0 and v["presentationHeight"]>0, v'
    base_smoke_passed=1
    break
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-playback-error.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-playback-error.json" dist/simulator-playback-error.json
    break
  fi
  sleep 2
done
if [ "${base_smoke_passed:-0}" = "1" ]; then
  cat dist/simulator-smoke.json dist/simulator-discover-smoke.json dist/simulator-playback-smoke.json dist/simulator-live-smoke.json dist/simulator-live-video-smoke.json
  exit 0
fi
if [ -f "$sim_data/Library/Caches/sanyuan-playback-smoke-debug.json" ]; then
  cp "$sim_data/Library/Caches/sanyuan-playback-smoke-debug.json" dist/simulator-playback-debug.json
  cat dist/simulator-playback-debug.json >&2
fi
if [ -f "$sim_data/Library/Caches/sanyuan-navigation-smoke-debug.json" ]; then
  cp "$sim_data/Library/Caches/sanyuan-navigation-smoke-debug.json" dist/simulator-navigation-debug.json
  cat dist/simulator-navigation-debug.json >&2
fi
xcrun simctl spawn "$sim_device" log show --last 2m --style compact --predicate 'process == "Sanyuan" OR eventMessage CONTAINS[c] "Sanyuan"' 2>&1 | tail -n 250 > dist/simulator-system.log || true
find "$sim_data/Library/Logs/CrashReporter" -type f -iname '*sanyuan*' -print -exec cat {} \; >> dist/simulator-system.log 2>/dev/null || true
find "$HOME/Library/Logs/DiagnosticReports" -maxdepth 2 -type f \( -iname '*sanyuan*' -o -iname '*com.joeshu.sanyuan*' \) -print -exec cat {} \; >> dist/simulator-system.log 2>/dev/null || true
xcrun simctl io "$sim_device" screenshot dist/simulator-failure.png || true
printf '%s\n' 'Simulator did not start native media playback.' >&2
exit 1

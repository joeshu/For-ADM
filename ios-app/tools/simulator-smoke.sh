#!/bin/bash
# Uses a separately compiled simulator executable. The device IPA stays unsigned.
set -euo pipefail
cd "$(dirname "$0")/.."
sdk_path="$(xcrun --sdk iphonesimulator --show-sdk-path)"
sim_arch="$(uname -m)"
mkdir -p dist/simulator
cp -R dist/Payload/Sanyuan.app dist/simulator/
sim_app="$PWD/dist/simulator/Sanyuan.app"
xcrun --sdk iphonesimulator clang -isysroot "$sdk_path" -target "$sim_arch-apple-ios15.0-simulator" -DSY_SIMULATOR_SMOKE=1 -fobjc-arc -fblocks -Oz Sources/main.m -framework UIKit -framework Foundation -framework WebKit -framework AVKit -framework AVFoundation -framework CoreMedia -framework Security -framework Network -framework JavaScriptCore -o "$sim_app/Sanyuan"
python3 - "$sim_app/Info.plist" <<'PY'
import sys,plistlib
p=sys.argv[1]
with open(p,'rb') as f:d=plistlib.load(f)
d['CFBundleSupportedPlatforms']=['iPhoneSimulator'];d.pop('UIRequiredDeviceCapabilities',None)
with open(p,'wb') as f:plistlib.dump(d,f)
PY
codesign --force --sign - --timestamp=none "$sim_app"
sim_device="$(xcrun simctl list devices available --json | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["udid"] for k,v in d["devices"].items() if ".iOS-" in k for x in v if x.get("isAvailable") and x["name"].startswith("iPhone")))')"
# Fresh GitHub runners normally have no booted device.
xcrun simctl boot "$sim_device" || true
xcrun simctl bootstatus "$sim_device" -b
xcrun simctl install "$sim_device" "$sim_app"
xcrun simctl launch "$sim_device" com.joeshu.sanyuan
sim_data="$(xcrun simctl get_app_container "$sim_device" com.joeshu.sanyuan data)"
for attempt in $(seq 1 80); do
  if [ -f "$sim_data/Library/Caches/sanyuan-smoke.json" ] && [ ! -f dist/simulator-smoke.json ]; then
    cp "$sim_data/Library/Caches/sanyuan-smoke.json" dist/simulator-smoke.json
    xcrun simctl io "$sim_device" screenshot dist/simulator-home.png
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-playback-smoke.json" ]; then
    [ -f dist/simulator-playback-smoke.json ] || cp "$sim_data/Library/Caches/sanyuan-playback-smoke.json" dist/simulator-playback-smoke.json
    [ -f dist/simulator-playback.png ] || xcrun simctl io "$sim_device" screenshot dist/simulator-playback.png
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-live-smoke.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-live-smoke.json" dist/simulator-live-smoke.json
  fi
  if [ -f dist/simulator-playback-smoke.json ] && [ -f dist/simulator-live-smoke.json ]; then
    cat dist/simulator-smoke.json dist/simulator-playback-smoke.json dist/simulator-live-smoke.json
    python3 -c 'import json; p=json.load(open("dist/simulator-playback-smoke.json")); l=json.load(open("dist/simulator-live-smoke.json")); assert p["hlsProxyActive"] and p["inlinePlayback"], p; assert l["nativeLiveScreen"] and l["pinnedPlayerHost"] and l["airplayRoutePicker"] and l["categoryActionReachedBridge"], l'
    exit 0
  fi
  if [ -f "$sim_data/Library/Caches/sanyuan-playback-error.json" ]; then
    cp "$sim_data/Library/Caches/sanyuan-playback-error.json" dist/simulator-playback-error.json
    break
  fi
  sleep 2
done
xcrun simctl io "$sim_device" screenshot dist/simulator-failure.png || true
printf '%s\n' 'Simulator did not start native media playback.' >&2
exit 1

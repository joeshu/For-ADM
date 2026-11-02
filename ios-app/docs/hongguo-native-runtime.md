# Hongguo native preparation in Sanyuan 0.2.49

The app embeds Node.js Mobile 18.20.4 (pinned SHA-256 verified at build time), the Node host/runtime from joeshu/yqk-forward-widget commit 4b647fd4bb91a2eade8d1efd45defd92b5fd0725, and adapts the user-supplied HGTV-Node-1.0.5-r4 provider. The Python 1.0.5-r3 package was used as the catalogue, media-validation and range-proxy reference; Python is not a second bundled runtime.

Full playback uses a background native bridge: resolve video model, select a compatible rendition (prefer 360p for bounded startup/memory), prepare and validate a complete local MP4, decode an initial video frame using AVFoundation, map it to a capability URL on an app-only loopback server, and let the existing AVPlayer read it. A transient website MP4 path remains a fallback. Public preview is still a separate manually selected line.

The native bridge installs only this bundled provider, serializes preparation, removes obsolete queued requests, retains cached files, and limits completed cache storage to 256 MiB while retaining the current and previous file. Node caches at most 32 video models, rejecting model responses over 2 MiB. Each media response is bounded by the provider to 32 MiB. Playback URLs never expose source filesystem paths. Native Range/HEAD responses stream 512 KiB chunks rather than serializing the movie through the web bridge.

The app-local authenticated native HTTPS bridge follows the reference release's system-network transport. Model requests prefer this transport and retain the supplied Node transport for empty/transient failures (not permission denials); media downloads retain the Node transport and its recoverable-network fallback. It accepts only the provider website/API/CDN domains; system TLS validation stays enabled. The Node framework is not a browser UI, nor a second player. No Python or Node subprocess is spawned on iOS.

Fixes beyond the supplied Node package: locate moov by top-level box boundaries; modify only moov (never scan mdat for metadata markers); support CENC subsamples and continuous CTR state across encrypted spans; reject invalid sample boundaries and incomplete protected-track tables. A failed native frame decode evicts the bad media and resets the model session instead of repeatedly returning an apparently valid but unplayable file. An owned one-second synthetic encrypted video/audio fixture exercises media processing, localProxy ranges and complete FFmpeg decoding. The simulator test separately exercises Node Mobile signing, the authenticated native HTTPS request/body bridge with an owned model fixture, native file streaming and AVPlayer to the end of this fixture; fixture injection exists only in the simulator bundle and is removed before the separate real-episode test. A real-site test must never count that fixture as an episode.

Provider client/signature configuration is inherited from the already public user-owned reference. Upstream changes can invalidate it; no claim of perpetual or every-episode availability is made. A successful build alone does not prove device playback or the full catalogue. Reports distinguish synthetic integration checks, real-site playback and user-device validation.

References:
- https://github.com/joeshu/yqk-forward-widget/releases/tag/cctv-ios-host-4b647fd4bb91-41388762810
- https://github.com/joeshu/yqk-forward-widget/tree/4b647fd4bb91a2eade8d1efd45defd92b5fd0725/cctv-ios-host
- Node.js Mobile license: Resources/NodeMobile-LICENSE.txt

## Verification before the release build

The preview SDK build and simulator run succeeded: https://github.com/joeshu/For-ADM/actions/runs/41433964946 . The owned CENC fixture completed through the embedded Node runtime, native loopback file server and AVPlayer with video and audio. The separate real 108.33-second website sample played to the end with `nativePrepared:false`; that real-site success used the website compatibility fallback and is not evidence that the signed upstream model endpoint works in the cloud simulator. The user's supplied packages are known to work on their phone. Physical-device playback of later episodes in the integrated app still requires verification.

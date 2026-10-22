# HLS playback cleaning

Reference studied 2026-10-22:
- https://raw.githubusercontent.com/GodLike631/Shadow-Rocket/refs/heads/main/Module/Clean_M3U8.plugin
- https://raw.githubusercontent.com/GodLike631/Shadow-Rocket/refs/heads/main/Module/clean_m3u8.js

The reference is attributed to @huliys9 and uses segment URI signatures. This app independently implements a narrower subset of its opaque path signatures and explicit /video/adjump/ and /mov/AD/ paths. It does not execute or update remote scripts, install certificates, change device proxy routes, or MITM HTTPS.

Excluded rules include /stream/, whole CDN domains, generic numeric IDs, and filename-shape guesses. These can describe actual content. METHOD=NONE and original discontinuities/maps are retained. No segment removal for master, live, LL-HLS, encrypted or byte-range manifests. For eligible VOD, removal rolls back above 120 seconds, above 20% of duration, or if less than 30 seconds would remain. These limits reduce risk; URI rules cannot guarantee that every match is an advertisement.

The native player uses a random-token HTTP endpoint bound only to 127.0.0.1. It serves only URLs mapped from the selected HTTPS manifest; relative paths use the final redirected manifest URL. Nested variants, audio/subtitles, key and map URI attributes are rewritten through the same transport. Upstream TLS verification, headers, Range and Content-Range are preserved. Each new playback cancels the previous proxy session and replaces its token. Ordinary MP4 playback and disabling cleaning use the original direct path.

The switch in 我的 → 播放设置 defaults on and applies to the next playback. Ads burned into the video, changed signatures, and deliberately unsupported playlists may still contain ads. No access authorization or DRM checks are removed.

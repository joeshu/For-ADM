# Simulator video fixture

Self-generated, silent H.264 Baseline video: 160 × 90, 12 fps, 12 seconds.
The simulator build copies only the playlist and transport-stream segments into
`SmokeMedia/`. They are absent from the device IPA.

`SYSmokeMediaProtocol` supplies these bytes to the app's normal HLS proxy for the
`smoke.invalid` host. AVPlayer still requests the rewritten playlist and segments
over the real loopback listener. The smoke must observe a rendered first frame,
positive video dimensions and advancing playback before continuing to live tests.

Regenerate from this directory with FFmpeg:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=160x90:rate=12:duration=12' -an \
  -c:v libx264 -profile:v baseline -level:v 3.0 -pix_fmt yuv420p \
  -preset veryslow -crf 28 -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename segment-%02d.ts video.m3u8
```

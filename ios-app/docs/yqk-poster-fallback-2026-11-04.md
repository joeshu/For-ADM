# YQK/QNTV poster fallback probe

Checked on 2026-11-04 against the live YQK and QNTV home feeds. Both feeds returned 27 sections and 162 movie rows. The first seven shared-CDN covers returned HTTP 200 from both `yqk.j3kjn242sq.com` and `qntv.j3kjn242sq.com`, with identical byte counts; a representative 240×355 JPEG was 39,889 bytes and began with `FFD8FFE0`. The image endpoint labels that JPEG `application/octet-stream`, so decoding must inspect the bytes rather than depend on the MIME type.

Some later rows use their own cover host, such as `img.picbf.com`. The app only rewrites a URL when its host is exactly `yqk.j3kjn242sq.com`; other cover hosts remain untouched. The native poster loader receives both URLs and accepts whichever decodes first.

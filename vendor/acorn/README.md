# Acorn 8.15.0

Source: `https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz`, npm package `acorn@8.15.0`, `dist/acorn.js`.

SHA-256 of the vendored distribution:

```text
fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c
```

MIT license and copyright are preserved in `LICENSE` and embedded in generated scripts. The distribution is unmodified. The build uses its tokenizer to compile structural templates; the source audit also uses its parser to inspect webpack loader syntax without executing site code.

Only KKAPP, NCAT, HAPP and the aggregate script contain the lazy tokenizer wrapper. Other standalone sites do not bundle Acorn. No CDN, dynamic dependency download, npm install, or remote code execution is used in QX.

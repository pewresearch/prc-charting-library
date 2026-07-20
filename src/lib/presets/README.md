# `presets/`

**What lives here:** Example chart configuration presets for the dev examples app (was `Templates/`). Kinds: config objects.

**Layer + dependency rule:** Dev/examples only — not part of the runtime render stack. May import `@prc/charting-utilities`. Must **not** be imported by `controller/` or `charts/` in production paths.

**Admission test:** Is it a static example config, not runtime library code? If yes, here.

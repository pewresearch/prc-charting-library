# `data/maps/`

**What lives here:** Static geo data — GeoJSON/topology JSON files and Node scripts that generate them (was `lib/maps/`). Kinds: data, build scripts.

**Layer + dependency rule:** Not part of the render dependency stack. Consumed by `charts/maps/` via dynamic `import()` of JSON paths. No imports from other `src/lib/` layers.

**Admission test:** Is it static topology/geo data or a script that produces it? If yes, here — not in `charts/maps/` (which is React render code).

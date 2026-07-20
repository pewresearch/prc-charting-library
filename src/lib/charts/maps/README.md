# `charts/maps/`

**What lives here:** Map chart renderers (`AlbersUSA`, `World`, `HexUSA`, etc.), bubble layers/legends, and `getDisplayCentroid`. Kinds: component, utility.

**Layer + dependency rule:** Nested under `charts/`. Same import rules as `charts/`, plus may load static topology from `data/maps/` via dynamic JSON imports.

**Admission test:** Is it a geo/map mark renderer or map-specific helper? If yes, here — not in cartesian `charts/` root.

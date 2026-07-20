# `controller/`

**What lives here:** Chart orchestration entry points — `ChartBuilder`, `ChartBuilderWrapper`, `ChartBuilderTextWrapper`, `ChartBuilderRenderer`. Kinds: component.

**Layer + dependency rule:** Layer 5 (top compositor). May import all lower layers: `charts/`, `overlays/`, `labels/`, `animation/`, `store/`, `primitives/`, `@prc/charting-utilities`. Nothing in the library should import this folder.

**Admission test:** Does it compose chart type + chrome + store into the public render surface? If yes, here.

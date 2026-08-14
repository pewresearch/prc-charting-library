# `src/lib/` — layer map

Internal source for `@prc/charting-library`. Folders are ordered by **dependency layer** (low → high). Location encodes meaning: a file's folder tells you what it may import and what must not import it.

```
primitives → store → animation / labels → overlays → charts → controller
                                                              presets (examples)
                                                              data/maps (static)
```

| Folder                         | Layer | Role                                                                                                                        |
| ------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| [`primitives/`](./primitives/) | 0     | Low-level SVG/React primitives                                                                                              |
| [`store/`](./store/)           | 1     | Chart reactive store (`useChartStore`)                                                                                      |
| [`animation/`](./animation/)   | 2     | Transition engine + `Animated*` components + providers                                                                      |
| [`labels/`](./labels/)         | 2     | Label components + leader lines (coupled with `animation/`; layout compute lives in `@prc/charting-utilities/labelLayout/`) |
| [`overlays/`](./overlays/)     | 3     | Presentational chrome (legend, tooltip, axes, annotations)                                                                  |
| [`charts/`](./charts/)         | 4     | D3 chart mark renderers (one per chart type)                                                                                |
| [`controller/`](./controller/) | 5     | `ChartBuilder*` orchestration                                                                                               |
| [`presets/`](./presets/)       | —     | Example chart configs (dev/examples only)                                                                                   |
| [`data/maps/`](./data/maps/)   | —     | GeoJSON/topology data + generation scripts                                                                                  |

## Admission rules

1. **Default:** a file lives in the folder for its **rendering role / layer**.
2. **Sibling vs nested:** a top-level sibling (`labels/`, `animation/`) requires a **cohesive, engine-backed subsystem** with its own internal API — not just "it's drawn on top." Presentational chrome belongs in `overlays/` even when visually overlaid.
3. **Nested subfolders** (`labels/leader-line/`, `charts/maps/`) when a cluster exceeds ~5–6 files or has a distinct concern.
4. **Framework-agnostic label compute** lives in `@prc/charting-utilities/labelLayout/`.

Each folder has its own README with the precise admission rules for that layer.

**Adding a new chart type?** See the Cursor skill [`.cursor/skills/charting-library-new-chart-type/SKILL.md`](../../../../.cursor/skills/charting-library-new-chart-type/SKILL.md) and its [architecture reference](../../../../.cursor/skills/charting-library-new-chart-type/architecture.md).

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
| `scales/`                      | —     | One scale hook that three charts share. Do not add files. Scale math goes in `@prc/charting-utilities` `compute/`.          |

## Rules

The source of truth is [`.cursor/rules/charting-architecture.mdc`](../../../../.cursor/rules/charting-architecture.mdc). It covers this package, `@prc/charting-utilities`, and `prc-chart-builder`. `npm run lint:repo` checks the rules marked **(lint)**.

1. **Layer direction.** A layer does not import a higher layer. `controller/` is the only layer that can import all layers below it.
2. **A renderer calls compute.** A file in `charts/` does not build scales or mark geometry inline when a second chart can use them. That compute lives in `@prc/charting-utilities` `compute/`, in a file named for what it computes, not for a chart type.
3. **One entry, layer barrels inside.** [`index.ts`](./index.ts) is the public surface. `src/index.js` (editor) and `src/view.js` (frontend) wrap it. Each layer folder has an `index.ts` barrel. Inside the library, import through it: `from '../overlays'`. In a folder, import a sibling by its file (`./Legend`), not through `'.'`, so the barrel does not import itself. The `charting-inner-barrel` lint skips this package. It still applies to `@prc/charting-utilities` and `@prc/chart-builder`.
4. **Package boundary (lint).** Import `@prc/charting-utilities` by name. Other packages import this one as `@prc/charting-library`, not by a relative path into `src/`.
5. **Helpers for `prc-chart-builder` (lint).** `prc-chart-builder` does not import `@prc/charting-utilities`. [`index.ts`](./index.ts) has one block that re-exports the `@prc/charting-utilities` helpers that chart-builder uses. To give chart-builder one more helper, add its name to that block. The lint code `charting-library-export` fails a chart-builder import of a name that `index.ts` does not export. The editor build does not find that error, because the editor reads this package from the `window.prcChartingLibrary` global.

When you add a file to a layer, add its exports to that folder's `index.ts`.

## Where a file goes

1. **Default:** a file lives in the folder for its **rendering role / layer**.
2. **Sibling vs nested:** a top-level sibling (`labels/`, `animation/`) requires a **cohesive, engine-backed subsystem** with its own internal API — not just "it's drawn on top." Presentational chrome belongs in `overlays/` even when visually overlaid.
3. **Nested subfolders** (`labels/leader-line/`, `charts/maps/`) when a cluster exceeds ~5–6 files or has a distinct concern.
4. **Framework-agnostic compute** does not live in this package. It goes in `@prc/charting-utilities` (`compute/`, or `labelLayout/` for the label engine).

Each folder has its own README with the precise admission rules for that layer.

**Adding a new chart type?** See the Cursor skill [`.cursor/skills/charting-library-new-chart-type/SKILL.md`](../../../../.cursor/skills/charting-library-new-chart-type/SKILL.md) and its [architecture reference](../../../../.cursor/skills/charting-library-new-chart-type/architecture.md).

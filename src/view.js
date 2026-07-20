/**
 * @prc/charting-library — Preact Script Module entry.
 *
 * Compiled to build/view.js as an ES module. Registered with WordPress as the
 * `@prc/charting-library` Script Module and consumed by frontend view scripts
 * (currently just plugins/prc-chart-builder/src/chart/view.js) via a top-level
 * static import.
 *
 * Two parallel export paths:
 *   1. ES module named exports — modern Script Module consumers
 *      `import { ChartBuilderRenderer } from '@prc/charting-library'`
 *   2. window.prcChartingLibrary — compat shim for the prc-custom-charts
 *      fallback and any consumer that still does a runtime window lookup.
 *      Slice 2 keeps this shim alive; prc-custom-charts dual-build is a
 *      follow-up ticket.
 *
 * publicPath must be set BEFORE any lazy chunk imports (maps). On Lando local
 * dev webpack's `output.publicPath: 'auto'` handles chunk URLs from
 * import.meta.url; on VIP production the legacy window.prcChartingLibraryConfig
 * global is honored when present (set by wp_localize_script on the editor
 * classic-script handle; a dedicated frontend setter is a follow-up).
 *
 * The chart debug surface (debug.setData, debug.setChart, randomize, update,
 * getBlockMarkdown, …) now lives in prc-chart-builder/src/debug/index.js and
 * is exposed at window.prcChartBuilder.debug. It was moved there because the
 * Interactivity store it operates on, and the wp.blocks/wp.data APIs needed
 * by getBlockMarkdown, are prc-chart-builder concerns, not charting-library
 * concerns.
 */

import * as chartingLibrary from './lib';
import './publicPath';

if (typeof window !== 'undefined') {
	window.prcChartingLibrary = { ...chartingLibrary };
}

export * from './lib';

/**
 * @prc/charting-library - PRC Charting Library
 *
 * All exports are automatically exposed to window.prcChartingLibrary via webpack output.library.
 *
 * CRITICAL: The publicPath import must be first to set __webpack_public_path__
 * before any chunks load. This is required for WordPress VIP where main bundles
 * are served from _static paths but chunks remain in the plugin directory.
 */

// CRITICAL: Must be first import to set publicPath before any chunks load
import './publicPath'

export * from './lib'

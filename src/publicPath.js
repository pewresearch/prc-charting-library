/**
 * Set webpack publicPath for chunk loading
 *
 * This file **must** be imported before anything else to ensure chunks load correctly.
 *
 * WordPress VIP serves main bundles from _static optimized paths, but chunks remain
 * in the plugin directory. We use wp_localize_script to pass the build URL from PHP.
 */

if (
  typeof window !== 'undefined' &&
  typeof window.prcChartingLibraryConfig !== 'undefined' &&
  typeof window.prcChartingLibraryConfig.buildUrl !== 'undefined'
) {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = window.prcChartingLibraryConfig.buildUrl
}

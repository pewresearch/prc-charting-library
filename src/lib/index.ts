export { ChartBuilderWrapper, ChartBuilderTextWrapper, ChartBuilderRenderer } from './controller';
export { default as useChartStore } from './store';
export type { ChartStoreSlice } from './store';
export {
	baseConfig,
	randomDataPoints,
	randomDate,
	randomDataTime,
	computeRegressionStats,
	getRegressionFn,
	REGRESSION_FNS,
	useRegressionLine,
	useRegressionLines,
} from '@prc/charting-utilities';

// Helpers for prc-chart-builder. It does not import @prc/charting-utilities:
// that entry has React hooks, and the view.js Script Module build rejects
// react. Add a name here when chart-builder needs one more helper.
export {
	canonicalRowValue,
	chartTypeSupportsSeriesMask,
	DEFAULT_FONT_FAMILY,
	generateSegmentKey,
	generateTickLabelKey,
	getGroupColorDomain,
	getLinearRampStops,
	getPatternEditorOption,
	getPatternType,
	getPositioningScale,
	getRowDisplayText,
	getThresholdLegendLabels,
	isHatchingPattern,
	MAP_REGION_PRESETS,
	patternFromEditorOption,
	patternPrimaryPaintField,
	patternSupportsStrokeWidth,
	readPatternPrimaryPaint,
	readPatternStrokeWidth,
	readPlotBandLabelRotation,
	resolveLegendTextAnchor,
	resolveTickLabelEntry,
	scalePositionToDisplay,
	scalePositionToLayout,
	stripRichText,
	withPatternPrimaryPaint,
	withPatternStrokeWidth,
} from '@prc/charting-utilities';

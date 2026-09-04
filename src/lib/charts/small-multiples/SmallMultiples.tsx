/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-nested-ternary */
// React Dependencies
import { useCallback, useContext, useEffect, useMemo, useRef, useState, RefObject } from 'react';
// External Dependencies
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { GridColumns, GridRows } from '@visx/grid';
import { LegendOrdinal } from '@visx/legend';
import { Circle, LinePath, Pie as VisxPie } from '@visx/shape';
import { scaleBand, scaleLinear, scaleOrdinal, scaleTime } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { voronoi } from '@visx/voronoi';
import { extent, max, min } from 'd3-array';
import * as Curve from '@visx/curve';
// Internal Dependencies
import type {
	BaseConfig,
	DeclutterLabelInput,
	FlatData,
	Size,
	SmallMultiplesGroupPanel,
	TableData,
} from '@prc/charting-utilities';
import {
	DataContext,
	DEFAULT_FONT_FAMILY,
	useSize,
	computeLabelDeclutter,
	generateElementKey,
	getChartDimensions,
	getAxisProps,
	getBarLabelFill,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getGridProps,
	getLabelFill,
	getLabelFormat,
	getLabelMaxWidth,
	getLabelProps,
	getLegendProps,
	getLocalPoint,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getTooltipVisible,
	hasAuthorLabelOverride,
	isLabelVisible,
	newDateByFormat,
	positionBarLabel,
	buildLineChartLabelId,
	getFirstLastLabelPlacement,
	getLineLabelContent,
	shouldShowLinePoint,
	linearBarBaseline,
	facetDataByColumn,
	facetDataByGroup,
	computeSharedDomain,
	computePanelRects,
	resolveEffectiveColumns,
	planPanelAxes,
	computeColumnBarRects,
	resolveBandDomain,
	computeHorizontalBarRects,
	computeBarPanelHeight,
	resolveSliceDomain,
	resolveShapePaint,
	generateSegmentKey,
	resolveSegmentPaint,
	resolveGhostStroke,
	computeWaffleCells,
	computeWaffleLayout,
	resolveWaffleMax,
	resolveWaffleCellSize,
} from '@prc/charting-utilities';
import {
	AnnotationsLayer,
	ClickableLegend,
	ClickableTicks,
	DrawingsLayer,
	getPositioningScale,
	PlotBands,
	StyledLegend,
	StyledTooltip,
} from '../../overlays';
import {
	AnimatedArc,
	AnimatedArea,
	AnimatedBar,
	AnimatedBarLabel,
	AnimatedCircle,
	AnimatedLabel,
	AnimatedLinePath,
	PieRevealProvider,
	PIE_FULL_TURN,
	TransitionProvider,
	type AnimationFamily,
} from '../../animation';
import { DraggableLabel, getDeclutterOffset, LeaderLineProvider, LeaderLineUnderlay } from '../../labels';
import { PanelTitleLabel } from './PanelTitleLabel';
import WaffleMarks from '../waffle/WaffleMarks';

type CurveType = typeof Curve;
type AxisKey = 'independent' | 'dependent';

type SmTooltipData = {
	x: string | number | Date;
	y: number;
	category: string;
	key: string;
	color: string;
	customTooltip?: string;
	customHeader?: string | null;
	highlightX?: number;
	highlightY?: number;
};

const DEFAULT_SERIES_COLOR = '#456A83';
const MIN_PANEL_WIDTH = 120;
const DEFAULT_POINT_SIZE = 3;
const DEFAULT_LEFT_INSET = 32;
/** Extra room for category tick labels on horizontal-bar panels. */
const DEFAULT_BAR_LEFT_INSET = 72;
const DEFAULT_BOTTOM_INSET = 20;
const DEFAULT_BAR_ROW_HEIGHT = 28;
/** Locked cell height (~legacy 400px / 2 rows + gapY 32). */
const DEFAULT_PANEL_HEIGHT = 184;
const PIE_PAD = 8;

/**
 * Small multiples: shared chrome/scale, one panel per data column — or, when
 * a grouping column is active (`dataRender.groupBreaksActive` +
 * `groupBreaksCategory`), one panel per group value with one series per
 * data column (multi-series panels).
 */
const SmallMultiples = () => {
	const { data, config, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const {
		layout,
		dataRender,
		independentAxis,
		dependentAxis,
		colors,
		line,
		bar,
		nodes,
		pie: pieConfig,
		legend,
		tooltip,
		labels,
		shapes,
		plotBands,
		annotations,
		drawings,
		smallMultiples,
		waffle: waffleConfig,
	} = config;

	const { width, parentClass, overflowX, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth } = getChartDimensions(size, layout);
	const padLeft = padding?.left ?? 0;
	const padTop = padding?.top ?? 0;
	const padBottom = padding?.bottom ?? 0;
	const padRight = padding?.right ?? 0;
	const gridWidth = Math.max(0, innerWidth || chartWidth || width);
	const designGridWidth = Math.max(0, width - padLeft - padRight);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	const tooltipVisible = getTooltipVisible(layout, chartWidth, tooltip);
	const labelProps = labels ? getLabelProps(labels) : {};

	// Carried for Phase 2 linked-hover.
	const [, setHoveredX] = useState<string | number | Date | null>(null);
	const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
	const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
	const tooltipTimeout = useRef<number>(0);

	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<SmTooltipData>();

	const clearTooltipTimeout = useCallback(() => {
		if (tooltipTimeout.current) {
			window.clearTimeout(tooltipTimeout.current);
			tooltipTimeout.current = 0;
		}
	}, []);

	const scheduleHideTooltip = useCallback(() => {
		clearTooltipTimeout();
		tooltipTimeout.current = window.setTimeout(() => {
			hideTooltip();
			setHoveredSegment(null);
		}, 300);
	}, [clearTooltipTimeout, hideTooltip]);

	const groupKey =
		dataRender?.groupBreaksActive && dataRender?.groupBreaksCategory ? dataRender.groupBreaksCategory : null;

	// Normalize both facet modes to panels-with-series.
	const panels: SmallMultiplesGroupPanel[] = useMemo(() => {
		const categories = dataRender?.categories?.length ? dataRender.categories : undefined;
		if (groupKey) {
			return facetDataByGroup(data, groupKey, categories, dataRender?.groupBreaksCategoryValues);
		}
		return facetDataByColumn(data, categories).map((panel) => ({
			key: panel.key,
			series: [{ key: panel.key, rows: panel.rows }],
		}));
	}, [data, dataRender?.categories, groupKey, dataRender?.groupBreaksCategoryValues]);

	const allSeries = useMemo(() => panels.flatMap((p) => p.series), [panels]);

	const sm = {
		...{
			panelType: 'line' as const,
			columns: 3,
			panelHeight: DEFAULT_PANEL_HEIGHT,
			minPanelWidth: MIN_PANEL_WIDTH,
			sharedScale: true,
			axisTreatment: 'minimal' as const,
			emphasisMode: 'own-series' as const,
			ghost: { stroke: '#E6E7E8', strokeWidth: 1.5, opacity: 1 },
			panelGap: { x: 24, y: 32 },
			panelTitle: {
				active: true,
				fontSize: 13,
				fontWeight: 700,
				fontFamily: DEFAULT_FONT_FAMILY,
				fill: '#2a2a2a',
				padding: 8,
				textAlign: 'center',
			},
		},
		...smallMultiples,
		ghost: {
			...{ stroke: '#E6E7E8', strokeWidth: 1.5, opacity: 1 },
			...smallMultiples?.ghost,
		},
		panelGap: { ...{ x: 24, y: 32 }, ...smallMultiples?.panelGap },
		panelTitle: {
			...{
				active: true,
				fontSize: 13,
				fontWeight: 700,
				fontFamily: DEFAULT_FONT_FAMILY,
				fill: '#2a2a2a',
				padding: 8,
				textAlign: 'center',
			},
			...smallMultiples?.panelTitle,
		},
		customTitles: smallMultiples?.customTitles,
	};

	const titlePad = sm.panelTitle.active ? sm.panelTitle.padding + sm.panelTitle.fontSize : 0;
	const isColumnPanel = sm.panelType === 'column';
	const isBarPanel = sm.panelType === 'bar';
	const isPiePanel = sm.panelType === 'pie';
	const isWafflePanel = sm.panelType === 'waffle';
	const isLinePanel = sm.panelType === 'line';
	const isPartToWholePanel = isPiePanel || isWafflePanel;
	const isBandPanel = isColumnPanel || isBarPanel;
	const animationFamily: AnimationFamily = isPartToWholePanel ? 'pie' : isLinePanel ? 'line' : 'bar';
	const panelOrientation = isBarPanel ? 'horizontal' : 'vertical';
	const leftInset = isPartToWholePanel ? 0 : isBarPanel ? DEFAULT_BAR_LEFT_INSET : DEFAULT_LEFT_INSET;

	const bandDomain = useMemo(() => (isBandPanel ? resolveBandDomain(allSeries) : []), [isBandPanel, allSeries]);

	const sliceDomain = useMemo(() => {
		if (isPiePanel || isWafflePanel) {
			return resolveSliceDomain(panels, legend?.categories);
		}
		return [];
	}, [isWafflePanel, isPiePanel, panels, legend?.categories]);

	const sliceColorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: sliceDomain,
				range: colors?.length ? colors : [DEFAULT_SERIES_COLOR],
			}),
		[sliceDomain, colors]
	);

	const legendProps = useMemo(() => (legend ? getLegendProps(legend) : null), [legend]);

	const configuredPanelHeight =
		typeof sm.panelHeight === 'number' && sm.panelHeight > 0 ? sm.panelHeight : DEFAULT_PANEL_HEIGHT;

	// Horizontal bars grow with category count so each row stays readable.
	const panelHeight = isBarPanel
		? computeBarPanelHeight({
				bandCount: bandDomain.length,
				rowHeight: DEFAULT_BAR_ROW_HEIGHT,
				titlePad,
				bottomInset: dependentAxis?.active ? DEFAULT_BOTTOM_INSET : 0,
			})
		: configuredPanelHeight;

	const minPanelWidth =
		typeof sm.minPanelWidth === 'number' && sm.minPanelWidth > 0 ? sm.minPanelWidth : MIN_PANEL_WIDTH;

	const columns = resolveEffectiveColumns({
		columns: sm.columns || 3,
		chartWidth: gridWidth,
		minPanelWidth,
		gapX: sm.panelGap.x,
	});

	const { rects, totalHeight: gridHeight } = useMemo(
		() =>
			computePanelRects({
				width: gridWidth,
				panelHeight,
				panelCount: panels.length,
				columns,
				gapX: sm.panelGap.x,
				gapY: sm.panelGap.y,
				titlePad,
			}),
		[gridWidth, panelHeight, panels.length, columns, sm.panelGap.x, sm.panelGap.y, titlePad]
	);

	const designColumns = Math.max(1, sm.columns || 3);
	const designPanelRects = useMemo(
		() =>
			computePanelRects({
				width: designGridWidth,
				panelHeight,
				panelCount: panels.length,
				columns: designColumns,
				gapX: sm.panelGap.x,
				gapY: sm.panelGap.y,
				titlePad,
			}).rects,
		[designGridWidth, panelHeight, panels.length, designColumns, sm.panelGap.x, sm.panelGap.y, titlePad]
	);

	const panelBottomInset = isPartToWholePanel ? 0 : dependentAxis?.active ? DEFAULT_BOTTOM_INSET : 0;
	const chartHeight = gridHeight + padTop + padBottom;

	useEffect(() => {
		const setGeometry = wpEditorFunctions?.smallMultiples?.setDrawingGeometry;
		if (!setGeometry) {
			return undefined;
		}
		setGeometry({
			chartWidth: chartWidth || width,
			chartHeight,
			layout,
			panels,
			panelRects: rects,
			designPanelRects,
			gridOffset: { x: padLeft, y: padTop },
			titlePad,
			leftInset,
			bottomInset: panelBottomInset,
		});
		return () => {
			setGeometry(null);
		};
	}, [
		chartWidth,
		width,
		chartHeight,
		layout,
		panels,
		rects,
		designPanelRects,
		padLeft,
		padTop,
		titlePad,
		leftInset,
		panelBottomInset,
		wpEditorFunctions?.smallMultiples?.setDrawingGeometry,
	]);

	const valueDomain = useMemo(() => {
		if (dependentAxis?.domain?.length === 2) {
			return dependentAxis.domain as [number, number];
		}
		if (sm.sharedScale) {
			return computeSharedDomain(allSeries, {
				showZero: dependentAxis?.showZero,
			});
		}
		return null;
	}, [allSeries, sm.sharedScale, dependentAxis?.showZero, dependentAxis?.domain]);

	// Continuous time scale (line panels only). Band/pie still use categorical x,
	// but tooltip headers should format when the author marked x as time data.
	const isTimeScale = !isBandPanel && !isPartToWholePanel && independentAxis?.scale === 'time';
	const isTimeData = independentAxis?.scale === 'time' || dataRender?.xScale === 'time';
	const xKey = dataRender?.x || 'x';

	const getXDate = useMemo(
		() => (d: FlatData) => newDateByFormat(d[xKey], dataRender?.xFormat) as Date,
		[xKey, dataRender?.xFormat]
	);
	const getXNumber = useMemo(() => (d: FlatData) => Number(d[xKey]), [xKey]);

	const xDomain = useMemo(() => {
		if (isColumnPanel) {
			return bandDomain;
		}
		if (isBarPanel || isPartToWholePanel) {
			return valueDomain ?? ([0, 1] as [number, number]);
		}
		if (independentAxis?.domain?.length === 2) {
			if (isTimeScale) {
				return independentAxis.domain.map((v) =>
					v instanceof Date ? v : newDateByFormat(String(v), dataRender?.xFormat)
				) as [Date, Date];
			}
			return independentAxis.domain as [number, number];
		}
		const allRows = allSeries.flatMap((s) => s.rows);
		if (!allRows.length) {
			return isTimeScale ? ([new Date(), new Date()] as [Date, Date]) : ([0, 1] as [number, number]);
		}
		if (isTimeScale) {
			return extent(allRows, getXDate) as [Date, Date];
		}
		const lo = min(allRows, getXNumber) ?? 0;
		const hi = max(allRows, getXNumber) ?? 1;
		return [lo, hi] as [number, number];
	}, [
		isColumnPanel,
		isBarPanel,
		isPartToWholePanel,
		bandDomain,
		valueDomain,
		allSeries,
		isTimeScale,
		getXDate,
		getXNumber,
		independentAxis?.domain,
		dataRender?.xFormat,
	]);

	const getSeriesColor = (seriesIndex: number) => colors?.[seriesIndex] || DEFAULT_SERIES_COLOR;
	const strokeWidth = line?.strokeWidth ?? 2;
	const strokeDasharray = line?.strokeDasharray || undefined;
	const showPoints = !!line?.showPoints;
	const showFirstLastPointsOnly = !!line?.showFirstLastPointsOnly;
	const showArea = !!line?.showArea;
	const areaFillOpacity = line?.areaFillOpacity ?? 0.4;
	const pointSize = nodes?.pointSize ?? DEFAULT_POINT_SIZE;
	const pointStrokeWidth = nodes?.pointStrokeWidth ?? 1;
	const interpolationKey = (line?.interpolation || 'curveLinear') as keyof CurveType;
	// Visx curve factories vary by type; cast matches Line.tsx usage for AreaClosed/LinePath.
	const lineCurve = (Curve[interpolationKey] ?? Curve.curveLinear) as typeof Curve.curveLinear;
	const barPadding = bar?.barGroupPadding ?? 0.2;
	const barStroke = bar?.hasRectStroke ? bar.rectStrokeColor || '#ffffff' : undefined;
	const barStrokeWidth = bar?.hasRectStroke ? (bar.rectStrokeWidth ?? 1) : 0;
	const rowCount = rects.length ? Math.max(...rects.map((r) => r.row)) + 1 : 1;
	const axisTreatment = sm.axisTreatment === 'full' ? 'full' : 'minimal';
	const ghostsActive = sm.emphasisMode === 'highlight' && sm.panelType === 'line' && !groupKey;
	const ghostPaint = resolveGhostStroke({
		deselectedColor: dataRender?.deselectedColor,
		deselectedOpacity: dataRender?.deselectedOpacity,
		ghostStroke: sm.ghost.stroke,
		ghostOpacity: sm.ghost.opacity,
	});
	const panelTitleCustomizations = sm.customTitles;
	const showSharedLegend = isPartToWholePanel && !!legend?.active && !!legendProps && sliceDomain.length > 0;
	const isSegmentMode =
		isLinePanel && (shapes?.segmentsActive === true || Object.keys(shapes?.segmentStyles ?? {}).length > 0);
	const labelsActive = !!labels?.active;
	const tooltipActive = !!tooltip?.active;

	const onTickClick = wpEditorFunctions?.tickLabels?.onClick;
	const independentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="independent" onTickClick={onTickClick} />
	);
	const dependentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="dependent" onTickClick={onTickClick} />
	);
	// Only force pointer styling in the editor; leave frontend hit-testing alone
	// so hover/tooltip wiring can land without fighting pointer-events: none.
	const editorPointerStyle = (enabled: boolean) =>
		enabled ? ({ cursor: 'pointer', pointerEvents: 'all' } as const) : undefined;

	const showMarkTooltip = useCallback(
		(payload: SmTooltipData, left: number, top: number) => {
			clearTooltipTimeout();
			setHoveredX(payload.x);
			showTooltip({
				tooltipLeft: left,
				tooltipTop: top,
				tooltipData: payload,
			});
		},
		[clearTooltipTimeout, showTooltip]
	);

	/** Match Line's getIndependentValue so tooltip.dateFormat applies (all panel types). */
	const resolveTooltipX = useCallback(
		(x: SmTooltipData['x']) =>
			isTimeData && !(x instanceof Date) ? (newDateByFormat(String(x), dataRender?.xFormat) as Date) : x,
		[isTimeData, dataRender?.xFormat]
	);

	const emptyOffsets = useMemo(() => new Map<string, { dx: number; dy: number }>(), []);
	const showLeaderLines = !!(labels?.autoDeclutter && labels?.declutterLeaderLines);
	const siblingMarkOpacity = (category: string) =>
		tooltipData && tooltipVisible && tooltip?.deemphasizeSiblings && tooltipData.category !== category
			? (tooltip.deemphasizeOpacity ?? 0.3)
			: 1;

	return (
		<TransitionProvider data={data} family={animationFamily}>
			<div
				style={{
					position: 'relative',
					overflowX: overflowX as React.CSSProperties['overflowX'],
				}}
			>
				<svg
					ref={svgRef}
					width={chartWidth || width}
					height={chartHeight}
					role="img"
					aria-label="Small multiples chart"
					className="cb__small-multiples"
					// Match Line/Bar: when tooltip.active is false (incl. editor drag via
					// setIsDragging → config.tooltip.active), disable SVG hit-testing so
					// voronoi/mark hover cannot fire. Editor drag targets (labels, panel
					// titles, annotations, clickable marks) set pointerEvents: 'all' and
					// still receive events under a parent with pointer-events: none.
					style={{
						pointerEvents: tooltipActive || wpEditorFunctions?.shapes ? 'auto' : 'none',
					}}
					onMouseLeave={() => {
						setHoveredX(null);
						scheduleHideTooltip();
					}}
				>
					<LeaderLineProvider>
						<Group left={padLeft} top={padTop}>
							{(showLeaderLines || (labelsActive && !!wpEditorFunctions?.labels)) && (
								<LeaderLineUnderlay />
							)}
							{panels.map((panel, index) => {
								const rect = rects[index];
								if (!rect) {
									return null;
								}

								const axisPlan = planPanelAxes({
									axisTreatment,
									col: rect.col,
									row: rect.row,
									columns,
									rowCount,
									dependentAxisActive: !isPartToWholePanel && !!dependentAxis?.active,
									independentAxisActive: !isPartToWholePanel && !!independentAxis?.active,
									leftInset,
									bottomInset: DEFAULT_BOTTOM_INSET,
									orientation: panelOrientation,
								});

								const plotWidth = Math.max(0, rect.plotWidth - axisPlan.leftInset);
								const plotHeight = Math.max(0, rect.plotHeight - axisPlan.bottomInset);

								const panelValueDomain =
									valueDomain ??
									computeSharedDomain(panel.series, {
										showZero: dependentAxis?.showZero,
									});

								const seriesCount = panel.series.length || 1;
								// Pie panels use the first series' rows as slices (x=category, y=value).
								const pieRows = (panel.series[0]?.rows ?? []).filter(
									(row) => typeof row.y === 'number' && Number.isFinite(row.y)
								);
								const pieCategory = dataRender?.categories?.[0] || panel.series[0]?.key || panel.key;

								const bandXScale = scaleBand<string>({
									domain: bandDomain,
									range: [0, plotWidth],
									padding: barPadding,
								});
								const bandYScale = scaleBand<string>({
									domain: bandDomain,
									range: [0, plotHeight],
									padding: barPadding,
								});
								const continuousXScale = isTimeScale
									? scaleTime({
											domain: xDomain as [Date, Date],
											range: [0, plotWidth],
										})
									: scaleLinear({
											domain: (isBarPanel ? panelValueDomain : xDomain) as [number, number],
											range: [0, plotWidth],
										});
								const continuousYScale = scaleLinear({
									domain: panelValueDomain,
									range: [plotHeight, 0],
									nice: !dependentAxis?.domain,
								});

								const getX = (d: FlatData) =>
									(isTimeScale ? continuousXScale(getXDate(d)) : continuousXScale(getXNumber(d))) ??
									0;
								const getY = (d: FlatData) => continuousYScale(Number(d.y)) ?? 0;
								const areaBaseline = linearBarBaseline(continuousYScale);

								const leftAxisConfig = isBarPanel ? independentAxis : dependentAxis;
								const bottomAxisConfig = isBarPanel ? dependentAxis : independentAxis;
								const leftScale = isBarPanel ? bandYScale : continuousYScale;
								const bottomScale = isBarPanel
									? continuousXScale
									: isColumnPanel
										? bandXScale
										: continuousXScale;
								const leftAxisKey: AxisKey = isBarPanel ? 'independent' : 'dependent';
								const bottomAxisKey: AxisKey = isBarPanel ? 'dependent' : 'independent';
								const leftTicksComponent =
									leftAxisKey === 'independent' ? independentTicksComponent : dependentTicksComponent;
								const bottomTicksComponent =
									bottomAxisKey === 'independent'
										? independentTicksComponent
										: dependentTicksComponent;

								const leftAxisProps =
									!isPartToWholePanel &&
									leftAxisConfig &&
									getAxisProps(leftAxisConfig, leftScale, dataRender?.xFormat, leftTicksComponent);
								const bottomAxisProps =
									!isPartToWholePanel &&
									bottomAxisConfig &&
									getAxisProps(
										bottomAxisConfig,
										bottomScale,
										dataRender?.xFormat,
										bottomTicksComponent
									);

								const panelGroupValue = groupKey ? panel.key : null;

								const showLeftAxis = isPartToWholePanel
									? false
									: isBarPanel
										? axisPlan.showIndependentAxis
										: axisPlan.showDependentAxis;
								const showBottomAxis = isPartToWholePanel
									? false
									: isBarPanel
										? axisPlan.showDependentAxis
										: axisPlan.showIndependentAxis;

								const valueGridProps =
									!isPartToWholePanel &&
									dependentAxis &&
									getGridProps(
										dependentAxis,
										isBarPanel ? continuousXScale : continuousYScale,
										plotWidth,
										plotHeight
									);
								const categoryGridProps =
									!isPartToWholePanel &&
									independentAxis &&
									getGridProps(
										independentAxis,
										isBarPanel ? bandYScale : isColumnPanel ? bandXScale : continuousXScale,
										plotWidth,
										plotHeight
									);

								const pieRadius = Math.max(0, Math.min(plotWidth, plotHeight) / 2 - PIE_PAD);

								const lineVoronoiSites = isLinePanel
									? panel.series.flatMap((series, seriesIndex) =>
											series.rows.map((row) => {
												const { body, header } = getCustomTooltip(row, series.key);
												return {
													...row,
													category: series.key,
													color: getSeriesColor(seriesIndex),
													customTooltip: body,
													customHeader: header,
												};
											})
										)
									: [];
								const lineVoronoi =
									isLinePanel && tooltipActive && lineVoronoiSites.length
										? voronoi<FlatData & { category: string; color: string }>({
												x: (d) => getX(d),
												y: (d) => getY(d),
												width: plotWidth,
												height: plotHeight,
											})(lineVoronoiSites)
										: null;

								const handleLinePanelMove = (event: React.MouseEvent) => {
									if (!tooltipActive || !lineVoronoi || !svgRef.current) {
										return;
									}
									clearTooltipTimeout();
									const point = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
									setCursorPosition(point);
									const localX = point.x - padLeft - rect.x - axisPlan.leftInset;
									const localY = point.y - padTop - rect.y - titlePad;
									const maxRadius = Math.max(plotWidth, plotHeight) * 0.15;
									const nearest = lineVoronoi.find(localX, localY, maxRadius);
									if (!nearest) {
										return;
									}
									const site = nearest.data as FlatData & {
										category: string;
										color: string;
										customTooltip?: string;
										customHeader?: string | null;
									};
									showMarkTooltip(
										{
											x: site.x,
											y: Number(site.y),
											category: site.category,
											key: site.category,
											color: site.color,
											customTooltip: site.customTooltip,
											customHeader: site.customHeader,
											highlightX: rect.x + axisPlan.leftInset + getX(site),
											highlightY: rect.y + titlePad + getY(site),
										},
										point.x,
										point.y
									);
								};

								const lineLabelOffsets =
									isLinePanel && labelsActive && labels?.autoDeclutter
										? (() => {
												const inputs = panel.series.flatMap((series, seriesIndex) =>
													series.rows.flatMap((row, pointIndex) => {
														if (!isLabelVisible(row, series.key)) {
															return [];
														}
														const { content } = getLineLabelContent(
															row,
															series.key,
															pointIndex,
															series.rows.length,
															labels
														);
														if (!content) {
															return [];
														}
														const placement = getFirstLastLabelPlacement({
															pointIndex,
															pointCount: series.rows.length,
															labels,
															fallbackTextAnchor:
																(
																	labelProps as {
																		textAnchor?: 'start' | 'middle' | 'end';
																	}
																).textAnchor ?? labels.textAnchor,
														});
														return [
															{
																id: buildLineChartLabelId(
																	seriesIndex,
																	series.key,
																	row,
																	pointIndex
																),
																x: getX(row),
																y: getY(row),
																text: content,
																fontSize: labels.fontSize,
																fontFamily: labels.fontFamily,
																fontWeight: labels.fontWeight,
																maxWidth: getLabelMaxWidth(row, series.key),
																textAnchor: placement.textAnchor,
																dominantBaseline:
																	(labelProps as { dominantBaseline?: string })
																		.dominantBaseline ?? 'middle',
																defaultDx: placement.defaultDx,
																defaultDy: placement.defaultDy,
																locked: hasAuthorLabelOverride(row, series.key),
															},
														];
													})
												) as DeclutterLabelInput[];
												return computeLabelDeclutter(inputs, {
													padding: labels.declutterPadding ?? 4,
													lockX: false,
													iterations: 160,
													anchorStrengthX: 0.35,
													anchorStrengthY: 0.35,
													innerWidth: plotWidth,
													innerHeight: plotHeight,
													omitWithin: labels.declutterOmitWithin,
												});
											})()
										: emptyOffsets;

								const renderLineLabel = (
									LabelComponent: typeof AnimatedLabel | typeof DraggableLabel,
									series: { key: string; rows: FlatData[] },
									seriesIndex: number,
									row: FlatData,
									pointIndex: number,
									anchorX: number,
									anchorY: number,
									keyPrefix: string
								) => {
									if (!labels) {
										return null;
									}
									if (!isLabelVisible(row, series.key) && !wpEditorFunctions?.labels) {
										return null;
									}
									const { content: labelContent, defaultLabel } = getLineLabelContent(
										row,
										series.key,
										pointIndex,
										series.rows.length,
										labels
									);
									if (!labelContent) {
										return null;
									}
									const labelId = buildLineChartLabelId(seriesIndex, series.key, row, pointIndex);
									const placement = getFirstLastLabelPlacement({
										pointIndex,
										pointCount: series.rows.length,
										labels,
										fallbackTextAnchor:
											(labelProps as { textAnchor?: 'start' | 'middle' | 'end' }).textAnchor ??
											labels.textAnchor,
									});
									const { dx, dy, hidden } = getDeclutterOffset(
										lineLabelOffsets,
										labelId,
										placement.defaultDx,
										placement.defaultDy
									);
									if (hidden) {
										return null;
									}
									return (
										<LabelComponent
											key={`${keyPrefix}-${labelId}`}
											x={anchorX}
											y={anchorY}
											dataPoint={row}
											category={series.key}
											defaultDx={dx}
											defaultDy={dy}
											chartInnerWidth={plotWidth}
											chartInnerHeight={plotHeight}
											defaultLabel={defaultLabel}
											fill={getLabelFill({
												labelColor: labels.color,
												seriesColor: getSeriesColor(seriesIndex),
											})}
											leaderLine={
												showLeaderLines ? { enabled: true, anchorRadius: pointSize } : undefined
											}
											{...labelProps}
											textAnchor={placement.textAnchor}
										>
											{labelContent}
										</LabelComponent>
									);
								};

								const plotClipId = `cb-sm-plot-clip-${String(panel.key).replace(/\s+/g, '-')}`;
								// Pad clip by marker/stroke so axis-sitting nodes aren't half-cut,
								// while still containing mid-resize overflow inside the cell.
								const plotClipPad = Math.max(
									strokeWidth,
									showPoints ? pointSize + pointStrokeWidth : 0
								);

								return (
									<Group
										key={panel.key}
										left={rect.x}
										top={rect.y}
										className="cb__small-multiples__panel"
										data-panel-key={panel.key}
										data-panel-col={rect.col}
										data-panel-row={rect.row}
									>
										{sm.panelTitle.active && (
											<PanelTitleLabel
												panelKey={panel.key}
												defaultLabel={panel.key}
												positioningScale={{
													...getPositioningScale({
														context: 'panel',
														panelKey: panel.key,
														layout,
														chartWidth: chartWidth || width,
														chartHeight,
														panels,
														panelRects: rects,
														designPanelRects,
														gridOffset: { x: padLeft, y: padTop },
														titlePad,
														leftInset,
														bottomInset: panelBottomInset,
													}),
													// Already inside the panel Group — offsets are cell-local.
													originX: 0,
													originY: 0,
												}}
												fontSize={sm.panelTitle.fontSize}
												fontWeight={sm.panelTitle.fontWeight}
												fontFamily={sm.panelTitle.fontFamily}
												fill={sm.panelTitle.fill}
												textAlign={sm.panelTitle.textAlign}
												customization={panelTitleCustomizations?.[panel.key]}
											/>
										)}
										<defs>
											<clipPath id={plotClipId}>
												<rect
													x={-plotClipPad}
													y={-plotClipPad}
													width={plotWidth + plotClipPad * 2}
													height={plotHeight + plotClipPad * 2}
												/>
											</clipPath>
										</defs>
										<Group
											top={titlePad}
											left={axisPlan.leftInset}
											onMouseMove={isLinePanel ? handleLinePanelMove : undefined}
											onMouseLeave={tooltipActive ? scheduleHideTooltip : undefined}
										>
											{isLinePanel && tooltipActive && (
												<rect
													width={plotWidth}
													height={plotHeight}
													fill="transparent"
													style={{ pointerEvents: 'all' }}
												/>
											)}
											{isLinePanel && plotBands?.active && (
												<PlotBands
													plotBands={plotBands}
													independentScale={continuousXScale}
													innerHeight={plotHeight}
												/>
											)}
											{axisPlan.showDependentGrid &&
												valueGridProps &&
												(isBarPanel ? (
													<GridColumns {...valueGridProps} />
												) : (
													<GridRows {...valueGridProps} />
												))}
											{axisPlan.showIndependentGrid &&
												categoryGridProps &&
												(isBarPanel ? (
													<GridRows {...categoryGridProps} />
												) : (
													<GridColumns {...categoryGridProps} />
												))}
											{!showBottomAxis && !isBarPanel && !isPartToWholePanel && (
												<line
													x1={0}
													x2={plotWidth}
													y1={plotHeight}
													y2={plotHeight}
													stroke="#2a2a2a"
													strokeWidth={1}
												/>
											)}
											{/* Match Line.tsx: axes under marks so points/lines sit on top. */}
											{showLeftAxis && leftAxisProps && (
												<g style={{ pointerEvents: onTickClick ? 'auto' : 'none' }}>
													<AxisLeft {...leftAxisProps} />
												</g>
											)}
											{showBottomAxis && bottomAxisProps && (
												<g style={{ pointerEvents: onTickClick ? 'auto' : 'none' }}>
													<AxisBottom {...bottomAxisProps} top={plotHeight} />
												</g>
											)}
											{/* Clip marks only — keeps axis ticks outside the plot from being cut. */}
											<g clipPath={`url(#${plotClipId})`}>
												{ghostsActive &&
													panels.map((sibling) => {
														if (sibling.key === panel.key) {
															return null;
														}
														return sibling.series.map((siblingSeries) => (
															<LinePath
																key={`ghost-${sibling.key}-${siblingSeries.key}`}
																data={siblingSeries.rows}
																x={getX}
																y={getY}
																curve={lineCurve}
																stroke={ghostPaint.stroke}
																strokeWidth={sm.ghost.strokeWidth}
																strokeOpacity={ghostPaint.opacity}
																strokeDasharray={strokeDasharray}
																fill="none"
															/>
														));
													})}
												{isLinePanel &&
													panel.series.map((series, seriesIndex) => {
														const seriesColor = getSeriesColor(seriesIndex);
														const linePoints = series.rows.map((row) => ({
															x: getX(row),
															y: getY(row),
														}));
														const areaPoints = series.rows.map((row) => ({
															x: getX(row),
															y0: areaBaseline,
															y1: getY(row),
														}));
														const renderMarker = (
															row: FlatData,
															pointIndex: number,
															// eslint-disable-next-line @typescript-eslint/no-explicit-any
															cx: any,
															// eslint-disable-next-line @typescript-eslint/no-explicit-any
															cy: any,
															entranceDelay = 0,
															entranceDuration: number | undefined = undefined
														) => {
															if (
																!shouldShowLinePoint({
																	showPoints,
																	showFirstLastPointsOnly,
																	index: pointIndex,
																	pointCount: series.rows.length,
																})
															) {
																return null;
															}
															const shapeKey = generateElementKey(
																row.x,
																series.key,
																panelGroupValue
															);
															const defaultFill =
																nodes?.pointFill === 'inherit'
																	? seriesColor
																	: (nodes?.pointFill ?? 'white');
															const defaultStroke =
																nodes?.pointStroke === 'inherit'
																	? seriesColor
																	: (nodes?.pointStroke ?? seriesColor);
															const paint = resolveShapePaint(
																shapes?.customStyles?.[shapeKey],
																{
																	fill: defaultFill,
																	stroke: defaultStroke,
																	strokeWidth: pointStrokeWidth,
																	opacity: 1,
																}
															);
															return (
																<AnimatedCircle
																	key={`pt-${panel.key}-${series.key}-${pointIndex}`}
																	cx={cx}
																	cy={cy}
																	r={pointSize}
																	entranceDelay={entranceDelay}
																	entranceDuration={entranceDuration}
																	fill={showPoints ? paint.fill : 'transparent'}
																	stroke={showPoints ? paint.stroke : 'transparent'}
																	strokeWidth={showPoints ? paint.strokeWidth : 0}
																	fillOpacity={
																		showPoints
																			? (nodes?.pointFillOpacity ?? 1) *
																				siblingMarkOpacity(series.key)
																			: 1
																	}
																	opacity={
																		(paint.opacity ?? 1) *
																		siblingMarkOpacity(series.key)
																	}
																	style={editorPointerStyle(
																		!!wpEditorFunctions?.shapes
																	)}
																	onClick={(event: React.MouseEvent) => {
																		wpEditorFunctions?.shapes?.onClick?.(
																			row,
																			series.key,
																			defaultFill,
																			event.currentTarget,
																			panelGroupValue
																		);
																	}}
																/>
															);
														};
														return (
															<Group key={`line-${panel.key}-${series.key}`}>
																{showArea && series.rows.length > 1 && (
																	<AnimatedArea
																		points={areaPoints}
																		curve={lineCurve}
																		family="area"
																		fill={seriesColor}
																		fillOpacity={
																			areaFillOpacity *
																			siblingMarkOpacity(series.key)
																		}
																	/>
																)}
																{series.rows.length > 1 &&
																	(isSegmentMode ? (
																		series.rows
																			.slice(0, -1)
																			.map((startPoint, segIdx) => {
																				const endPoint =
																					series.rows[segIdx + 1];
																				const segmentKey = generateSegmentKey(
																					startPoint.x,
																					endPoint.x,
																					series.key
																				);
																				const paint = resolveSegmentPaint(
																					shapes?.segmentStyles?.[segmentKey],
																					{
																						stroke: seriesColor,
																						strokeWidth: ghostsActive
																							? strokeWidth + 1
																							: strokeWidth,
																						opacity: 1,
																						strokeDasharray,
																					}
																				);
																				const x1 = getX(startPoint);
																				const y1 = getY(startPoint);
																				const x2 = getX(endPoint);
																				const y2 = getY(endPoint);
																				const d = `M ${x1} ${y1} L ${x2} ${y2}`;
																				const isHovered =
																					hoveredSegment === segmentKey;
																				return (
																					<g
																						key={`seg-${panel.key}-${series.key}-${segIdx}`}
																					>
																						{wpEditorFunctions?.segments && (
																							<path
																								d={d}
																								stroke="transparent"
																								strokeWidth={
																									(paint.strokeWidth ??
																										2) + 8
																								}
																								fill="none"
																								style={{
																									cursor: 'pointer',
																								}}
																								onMouseEnter={() =>
																									setHoveredSegment(
																										segmentKey
																									)
																								}
																								onMouseLeave={() =>
																									setHoveredSegment(
																										null
																									)
																								}
																								onClick={(
																									event: React.MouseEvent
																								) => {
																									wpEditorFunctions.segments.onClick?.(
																										startPoint,
																										endPoint,
																										series.key,
																										event.currentTarget
																									);
																								}}
																							/>
																						)}
																						<AnimatedLinePath
																							points={[
																								{ x: x1, y: y1 },
																								{ x: x2, y: y2 },
																							]}
																							stroke={
																								isHovered
																									? '#007cba'
																									: paint.stroke
																							}
																							strokeWidth={
																								isHovered
																									? (paint.strokeWidth ??
																											2) + 2
																									: paint.strokeWidth
																							}
																							strokeOpacity={
																								(paint.opacity ?? 1) *
																								siblingMarkOpacity(
																									series.key
																								)
																							}
																							strokeDasharray={
																								paint.strokeDasharray
																							}
																							style={editorPointerStyle(
																								!!wpEditorFunctions?.line
																							)}
																							onClick={(
																								event: React.MouseEvent
																							) => {
																								wpEditorFunctions?.line?.onClick?.(
																									event.currentTarget
																								);
																							}}
																						/>
																					</g>
																				);
																			})
																	) : (
																		<AnimatedLinePath
																			points={linePoints}
																			curve={lineCurve}
																			stroke={seriesColor}
																			strokeWidth={
																				ghostsActive
																					? strokeWidth + 1
																					: strokeWidth
																			}
																			strokeOpacity={siblingMarkOpacity(
																				series.key
																			)}
																			strokeDasharray={strokeDasharray}
																			style={editorPointerStyle(
																				!!wpEditorFunctions?.line
																			)}
																			onClick={(event: React.MouseEvent) => {
																				wpEditorFunctions?.line?.onClick?.(
																					event.currentTarget
																				);
																			}}
																		>
																			{(glide) =>
																				showPoints
																					? series.rows.map(
																							(row, pointIndex) => {
																								const { cx, cy } =
																									glide.pointAt(
																										pointIndex
																									);
																								return renderMarker(
																									row,
																									pointIndex,
																									cx,
																									cy,
																									glide.entranceDelay,
																									glide.entranceDuration
																								);
																							}
																						)
																					: null
																			}
																		</AnimatedLinePath>
																	))}
																{showPoints &&
																	(isSegmentMode || series.rows.length <= 1) &&
																	series.rows.map((row, pointIndex) =>
																		renderMarker(
																			row,
																			pointIndex,
																			getX(row),
																			getY(row)
																		)
																	)}
															</Group>
														);
													})}
												{isColumnPanel &&
													panel.series.map((series, seriesIndex) => {
														const seriesColor = getSeriesColor(seriesIndex);
														const seriesBars = computeColumnBarRects({
															rows: series.rows,
															bandDomain,
															yDomain: panelValueDomain,
															plotWidth,
															plotHeight,
															padding: barPadding,
														});
														return seriesBars.map((b) => {
															const dataPoint = series.rows.find(
																(row) => String(row.x) === b.key
															) || {
																x: b.key,
																y: b.value,
																[series.key]: b.value,
															};
															const shapeKey = generateElementKey(
																b.key,
																series.key,
																panelGroupValue
															);
															const paint = resolveShapePaint(
																shapes?.customStyles?.[shapeKey],
																{
																	fill: seriesColor,
																	stroke: barStroke,
																	strokeWidth: barStrokeWidth,
																	opacity: 1,
																}
															);
															const { body: customTooltip, header: customHeader } =
																getCustomTooltip(dataPoint, series.key);
															const barGeom = {
																x: b.x + (b.width / seriesCount) * seriesIndex,
																y: b.y,
																width: b.width / seriesCount,
																height: b.height,
																value: b.value,
																key: series.key,
																color: seriesColor,
																index: seriesIndex,
															};
															const customLabel =
																getCustomLabelText(dataPoint, series.key) ||
																getCustomLabel(dataPoint, series.key) ||
																getLabelFormat(b.value, series.key, labels, null);
															return (
																<g key={`col-${panel.key}-${series.key}-${b.key}`}>
																	<AnimatedBar
																		orientation="vertical"
																		x={barGeom.x}
																		y={barGeom.y}
																		width={barGeom.width}
																		height={barGeom.height}
																		fill={paint.fill}
																		stroke={paint.stroke}
																		strokeWidth={paint.strokeWidth}
																		opacity={
																			(paint.opacity ?? 1) *
																			siblingMarkOpacity(series.key)
																		}
																		style={editorPointerStyle(
																			!!wpEditorFunctions?.shapes
																		)}
																		onMouseLeave={
																			tooltipActive
																				? scheduleHideTooltip
																				: undefined
																		}
																		onMouseMove={(event: React.MouseEvent) => {
																			if (!tooltipActive || !svgRef.current) {
																				return;
																			}
																			const coords = getLocalPoint(
																				svgRef.current,
																				event
																			) || {
																				x: 0,
																				y: 0,
																			};
																			setCursorPosition(coords);
																			showMarkTooltip(
																				{
																					x: b.key,
																					y: b.value,
																					category: series.key,
																					key: series.key,
																					color: seriesColor,
																					customTooltip,
																					customHeader,
																				},
																				coords.x,
																				coords.y
																			);
																		}}
																		onClick={(event: React.MouseEvent) => {
																			wpEditorFunctions?.shapes?.onClick?.(
																				dataPoint,
																				series.key,
																				seriesColor,
																				event.currentTarget,
																				panelGroupValue
																			);
																		}}
																	/>
																	{labelsActive && !!b.value && (
																		<AnimatedBarLabel
																			{...positionBarLabel(
																				barGeom,
																				labels,
																				labels.labelCutoff,
																				'vertical',
																				'single'
																			)}
																			dataPoint={dataPoint}
																			category={series.key}
																			defaultDx={0}
																			defaultDy={0}
																			chartInnerWidth={plotWidth}
																			chartInnerHeight={plotHeight}
																			fill={getBarLabelFill(
																				labels.color,
																				labels.labelPositionBar,
																				b.value,
																				labels.labelCutoff,
																				seriesColor,
																				seriesColor
																			)}
																			{...labelProps}
																		>
																			{customLabel}
																		</AnimatedBarLabel>
																	)}
																</g>
															);
														});
													})}
												{isBarPanel &&
													panel.series.map((series, seriesIndex) => {
														const seriesColor = getSeriesColor(seriesIndex);
														const seriesBars = computeHorizontalBarRects({
															rows: series.rows,
															bandDomain,
															xDomain: panelValueDomain,
															plotWidth,
															plotHeight,
															padding: barPadding,
														});
														return seriesBars.map((b) => {
															const dataPoint = series.rows.find(
																(row) => String(row.x) === b.key
															) || {
																x: b.key,
																y: b.value,
																[series.key]: b.value,
															};
															const shapeKey = generateElementKey(
																b.key,
																series.key,
																panelGroupValue
															);
															const paint = resolveShapePaint(
																shapes?.customStyles?.[shapeKey],
																{
																	fill: seriesColor,
																	stroke: barStroke,
																	strokeWidth: barStrokeWidth,
																	opacity: 1,
																}
															);
															const { body: customTooltip, header: customHeader } =
																getCustomTooltip(dataPoint, series.key);
															const barGeom = {
																x: b.x,
																y: b.y + (b.height / seriesCount) * seriesIndex,
																width: b.width,
																height: b.height / seriesCount,
																value: b.value,
																key: series.key,
																color: seriesColor,
																index: seriesIndex,
															};
															const customLabel =
																getCustomLabelText(dataPoint, series.key) ||
																getCustomLabel(dataPoint, series.key) ||
																getLabelFormat(b.value, series.key, labels, null);
															return (
																<g key={`hbar-${panel.key}-${series.key}-${b.key}`}>
																	<AnimatedBar
																		orientation="horizontal"
																		x={barGeom.x}
																		y={barGeom.y}
																		width={barGeom.width}
																		height={barGeom.height}
																		fill={paint.fill}
																		stroke={paint.stroke}
																		strokeWidth={paint.strokeWidth}
																		opacity={
																			(paint.opacity ?? 1) *
																			siblingMarkOpacity(series.key)
																		}
																		style={editorPointerStyle(
																			!!wpEditorFunctions?.shapes
																		)}
																		onMouseLeave={
																			tooltipActive
																				? scheduleHideTooltip
																				: undefined
																		}
																		onMouseMove={(event: React.MouseEvent) => {
																			if (!tooltipActive || !svgRef.current) {
																				return;
																			}
																			const coords = getLocalPoint(
																				svgRef.current,
																				event
																			) || {
																				x: 0,
																				y: 0,
																			};
																			setCursorPosition(coords);
																			showMarkTooltip(
																				{
																					x: b.key,
																					y: b.value,
																					category: series.key,
																					key: series.key,
																					color: seriesColor,
																					customTooltip,
																					customHeader,
																				},
																				coords.x,
																				coords.y
																			);
																		}}
																		onClick={(event: React.MouseEvent) => {
																			wpEditorFunctions?.shapes?.onClick?.(
																				dataPoint,
																				series.key,
																				seriesColor,
																				event.currentTarget,
																				panelGroupValue
																			);
																		}}
																	/>
																	{labelsActive && !!b.value && (
																		<AnimatedBarLabel
																			{...positionBarLabel(
																				barGeom,
																				labels,
																				labels.labelCutoff,
																				'horizontal',
																				'single'
																			)}
																			dataPoint={dataPoint}
																			category={series.key}
																			defaultDx={0}
																			defaultDy={0}
																			chartInnerWidth={plotWidth}
																			chartInnerHeight={plotHeight}
																			fill={getBarLabelFill(
																				labels.color,
																				labels.labelPositionBar,
																				b.value,
																				labels.labelCutoff,
																				seriesColor,
																				seriesColor
																			)}
																			{...labelProps}
																		>
																			{customLabel}
																		</AnimatedBarLabel>
																	)}
																</g>
															);
														});
													})}
												{isPiePanel && pieRadius > 0 && (
													<Group left={plotWidth / 2} top={plotHeight / 2}>
														<PieRevealProvider
															pieStartAngle={0}
															pieEndAngle={PIE_FULL_TURN}
														>
															<VisxPie
																data={pieRows}
																pieValue={(d: FlatData) => Number(d.y) || 0}
																outerRadius={pieRadius}
															>
																{(pie) =>
																	pie.arcs.map((arc, arcIndex) => {
																		const sliceKey = String(arc.data.x);
																		const sliceColor = sliceColorScale(sliceKey);
																		const shapeKey = generateElementKey(
																			sliceKey,
																			pieCategory,
																			panelGroupValue
																		);
																		const paint = resolveShapePaint(
																			shapes?.customStyles?.[shapeKey],
																			{
																				fill: sliceColor,
																				stroke: pieConfig?.hasPathStroke
																					? pieConfig.pathStrokeColor
																					: undefined,
																				strokeWidth: pieConfig?.hasPathStroke
																					? (pieConfig.pathStrokeWidth ?? 1)
																					: 0,
																				opacity: 1,
																			}
																		);
																		const [centroidX, centroidY] =
																			pie.path.centroid(arc);
																		const hasSpaceForLabel =
																			arc.endAngle - arc.startAngle >= 0.1;
																		const {
																			body: customTooltip,
																			header: customHeader,
																		} = getCustomTooltip(arc.data, pieCategory);
																		const defaultLabel = getLabelFormat(
																			Number(arc.data.y),
																			sliceKey,
																			labels,
																			null
																		);
																		const customLabel =
																			getCustomLabelText(arc.data, pieCategory) ||
																			getCustomLabel(arc.data, pieCategory) ||
																			defaultLabel;
																		return (
																			<g
																				key={`pie-${panel.key}-${sliceKey}-${arcIndex}`}
																			>
																				<AnimatedArc
																					startAngle={arc.startAngle}
																					endAngle={arc.endAngle}
																					buildArc={(s, e) =>
																						pie.path({
																							...arc,
																							startAngle: s,
																							endAngle: e,
																						}) || ''
																					}
																					fill={paint.fill}
																					stroke={paint.stroke}
																					strokeWidth={paint.strokeWidth}
																					opacity={
																						(paint.opacity ?? 1) *
																						siblingMarkOpacity(sliceKey)
																					}
																					style={editorPointerStyle(
																						!!wpEditorFunctions?.shapes
																					)}
																					onMouseLeave={
																						tooltipActive
																							? scheduleHideTooltip
																							: undefined
																					}
																					onMouseMove={(
																						event: React.MouseEvent
																					) => {
																						if (
																							!tooltipActive ||
																							!svgRef.current
																						) {
																							return;
																						}
																						const coords = getLocalPoint(
																							svgRef.current,
																							event
																						) || { x: 0, y: 0 };
																						setCursorPosition(coords);
																						showMarkTooltip(
																							{
																								x: sliceKey,
																								y: Number(arc.data.y),
																								category: pieCategory,
																								key: pieCategory,
																								color: sliceColor,
																								customTooltip,
																								customHeader,
																							},
																							coords.x,
																							coords.y
																						);
																					}}
																					onClick={(
																						event: React.MouseEvent
																					) => {
																						wpEditorFunctions?.shapes?.onClick?.(
																							arc.data,
																							pieCategory,
																							sliceColor,
																							event.currentTarget,
																							panelGroupValue
																						);
																					}}
																				/>
																				{labelsActive && hasSpaceForLabel && (
																					<AnimatedLabel
																						x={centroidX}
																						y={centroidY}
																						dataPoint={arc.data}
																						category={pieCategory}
																						defaultDx={0}
																						defaultDy={0}
																						chartInnerWidth={plotWidth}
																						chartInnerHeight={plotHeight}
																						defaultLabel={defaultLabel}
																						fill={getLabelFill({
																							labelColor: labels.color,
																							seriesColor: sliceColor,
																						})}
																						{...labelProps}
																					>
																						{customLabel}
																					</AnimatedLabel>
																				)}
																			</g>
																		);
																	})
																}
															</VisxPie>
														</PieRevealProvider>
													</Group>
												)}
												{isWafflePanel &&
													(() => {
														const panelValue = Number(panel.series[0]?.rows[0]?.y) || 0;
														const legacySize = waffleConfig?.gridSize;
														const waffleColumns = waffleConfig?.columns ?? legacySize ?? 10;
														const rows = waffleConfig?.rows ?? legacySize ?? 10;
														const cellGap = waffleConfig?.cellGap ?? 0.1;
														const labelReserve = 24;
														const cellSize = resolveWaffleCellSize({
															mode: waffleConfig?.cellSizeMode ?? 'clamp',
															cellSize: waffleConfig?.cellSize ?? 14,
															columns: waffleColumns,
															rows,
															cellGap,
															availableWidth: plotWidth,
															availableHeight: Math.max(0, plotHeight - labelReserve),
														});
														const waffleMax = resolveWaffleMax(
															'portion',
															[{ key: panel.key, value: panelValue }],
															waffleConfig?.max ?? null
														);
														const waffleLayout = computeWaffleLayout({
															columns: waffleColumns,
															rows,
															cellSize,
															cellGap,
														});
														const waffleCells = computeWaffleCells({
															mode: 'portion',
															categories: [
																{
																	key: panel.key,
																	value: panelValue,
																},
															],
															columns: waffleColumns,
															rows,
															max: waffleMax,
														}).cells;
														const fillPercent = Math.round((panelValue / waffleMax) * 100);
														const panelRow =
															panel.series[0]?.rows[0] ||
															({ x: panel.key, y: panelValue } as FlatData);
														const panelColor = sliceColorScale(panel.key);
														const dataByCategory = new Map([[panel.key, panelRow]]);
														// Shape clicks key off the series/panel (same as SM bar/line),
														// not dataRender.categories[0] which is only correct for whole pie.
														const categoryKey = panel.series[0]?.key || panel.key;
														const gridLeft = (plotWidth - waffleLayout.width) / 2;
														const gridTop =
															(plotHeight - waffleLayout.height) / 2 + labelReserve / 2;

														return (
															<Group left={gridLeft} top={gridTop}>
																<text
																	x={waffleLayout.width / 2}
																	y={-8}
																	textAnchor="middle"
																	fill={panelColor}
																	fontSize={16}
																	fontWeight={700}
																>
																	{`${fillPercent}%`}
																</text>
																<WaffleMarks
																	cells={waffleCells}
																	layout={waffleLayout}
																	cellShape={waffleConfig?.cellShape ?? 'square'}
																	cellRadius={waffleConfig?.cellRadius ?? 3}
																	emptyFill={waffleConfig?.emptyFill ?? '#E6E7E8'}
																	colorScale={() => panelColor}
																	categoryKey={categoryKey}
																	dataByCategory={dataByCategory}
																	dataRender={dataRender}
																	customStyles={shapes?.customStyles}
																	wpEditorFunctions={wpEditorFunctions}
																	tooltipActive={tooltipActive}
																	onCellMouseMove={(event, row) => {
																		if (!tooltipActive || !svgRef.current) {
																			return;
																		}
																		const coords = getLocalPoint(
																			svgRef.current,
																			event
																		) || { x: 0, y: 0 };
																		setCursorPosition(coords);
																		const { body, header } = getCustomTooltip(
																			row,
																			categoryKey
																		);
																		showMarkTooltip(
																			{
																				x: panel.key,
																				y: Number(row.y) || panelValue,
																				category: categoryKey,
																				key: categoryKey,
																				color: panelColor,
																				customTooltip: body,
																				customHeader: header,
																			},
																			coords.x,
																			coords.y
																		);
																	}}
																	onCellMouseLeave={
																		tooltipActive ? scheduleHideTooltip : undefined
																	}
																/>
															</Group>
														);
													})()}
											</g>
										</Group>
										{/* Outside the plot clip so first/last "outside" labels are not cut. */}
										{isLinePanel && labelsActive && (
											<Group top={titlePad} left={axisPlan.leftInset}>
												{panel.series.map((series, seriesIndex) =>
													series.rows.map((row, pointIndex) =>
														renderLineLabel(
															wpEditorFunctions?.labels ? DraggableLabel : AnimatedLabel,
															series,
															seriesIndex,
															row,
															pointIndex,
															getX(row),
															getY(row),
															wpEditorFunctions?.labels
																? `drag-label-${panel.key}`
																: `line-label-${panel.key}`
														)
													)
												)}
											</Group>
										)}
									</Group>
								);
							})}
							{tooltipOpen &&
								tooltipData &&
								tooltipVisible &&
								typeof tooltipData.highlightX === 'number' &&
								typeof tooltipData.highlightY === 'number' && (
									<g pointerEvents="none">
										<Circle
											cx={tooltipData.highlightX}
											cy={tooltipData.highlightY}
											r={pointSize + 2}
											fill={tooltipData.color}
											fillOpacity={showPoints ? 0.1 : 1}
											stroke={tooltipData.color}
											strokeOpacity={0.1}
											strokeWidth={2}
										/>
										<Circle
											cx={tooltipData.highlightX}
											cy={tooltipData.highlightY}
											r={pointSize + 1}
											fill="transparent"
											stroke="white"
											strokeWidth={2}
										/>
									</g>
								)}
						</Group>
					</LeaderLineProvider>
					{!!annotations?.active && (
						<AnnotationsLayer
							config={annotations}
							width={chartWidth || width}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth || width}
							panels={panels}
							panelRects={rects}
							designPanelRects={designPanelRects}
							gridOffset={{ x: padLeft, y: padTop }}
							titlePad={titlePad}
							leftInset={leftInset}
							bottomInset={panelBottomInset}
						/>
					)}
					{!!drawings?.active && (
						<DrawingsLayer
							config={drawings}
							width={chartWidth || width}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth || width}
							panels={panels}
							panelRects={rects}
							designPanelRects={designPanelRects}
							gridOffset={{ x: padLeft, y: padTop }}
							titlePad={titlePad}
							leftInset={leftInset}
							bottomInset={panelBottomInset}
						/>
					)}
				</svg>
				{showSharedLegend && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth || width}>
						<LegendOrdinal
							{...legendProps}
							scale={sliceColorScale}
							domain={
								legend.categories?.length
									? legend.categories.map(String).filter((k) => sliceDomain.includes(k))
									: sliceDomain
							}
						>
							{(legendLabels) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => sliceColorScale(String(label.datum))}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendOrdinal>
					</StyledLegend>
				)}
				{tooltipOpen && tooltipData && tooltipVisible && tooltip && (
					<StyledTooltip
						top={tooltipTop}
						left={tooltipLeft}
						tooltip={tooltip}
						cursorX={cursorPosition?.x}
						cursorY={cursorPosition?.y}
						containerRef={svgRef}
						isMobile={isMobileTooltip}
					>
						<>
							{tooltip.headerActive && (
								<div style={{ marginBottom: '10px' }}>
									<strong>
										{tooltipData.customHeader
											? tooltipData.customHeader
											: getTooltipHeaderFormat(
													{
														x: resolveTooltipX(tooltipData.x),
														category: tooltipData.category,
													},
													tooltip
												)}
									</strong>
								</div>
							)}
						</>
						<div
							dangerouslySetInnerHTML={{
								__html: tooltipData.customTooltip
									? tooltipData.customTooltip
									: getTooltipFormat(
											{
												x: resolveTooltipX(tooltipData.x),
												y: tooltipData.y,
												category: tooltipData.category,
												color: tooltipData.color,
												data: tooltipData,
											},
											tooltip,
											dataRender
										),
							}}
						/>
					</StyledTooltip>
				)}
			</div>
		</TransitionProvider>
	);
};

export default SmallMultiples;

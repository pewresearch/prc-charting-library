/* eslint-disable @wordpress/no-setting-ds-tokens */
/* eslint-disable @wordpress/no-unknown-ds-tokens */
/* eslint-disable no-nested-ternary */
/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { BaseConfig, FlatData, Size, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	generateElementKey as generateElementKeyUtil,
	getChartDimensions,
	getCustomTooltip,
	getGroupValue,
	getLabelFill,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	isLabelVisible,
	newDateByFormat,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
	scaleAxisNumTicks,
	useSize,
} from '@prc/charting-utilities';
import {
	AnnotationsLayer,
	ClickableLegend,
	ClickableTicks,
	DrawingsLayer,
	PlotBands,
	StyledLegend,
	StyledTooltip,
} from '../overlays';
import { AnimatedArea, AnimatedCircle, AnimatedLinePath, AnimatedLabel, TransitionProvider } from '../animation';
import { DraggableLabel } from '../labels';
import {
	buildLineChartLabelId,
	buildLineChartLabelInputs,
	DirectSeriesLegendLabels,
	getDeclutterOffset,
	getLineLabelContent,
	LeaderLineProvider,
	LeaderLineUnderlay,
	useDirectSeriesLegend,
	useLabelDeclutter,
} from '../labels';

import { AxisBottom, AxisLeft } from '@visx/axis';
import * as Curve from '@visx/curve';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleLinear, scaleOrdinal, scaleTime } from '@visx/scale';
import {
	// Line as VerticalLine,
	Circle,
} from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import { ascending, descending, extent, max } from 'd3-array';

import styled from '@emotion/styled';

type CurveType = typeof Curve;

// Animated marker (PRC-17 slice 3f). For curve-mode lines its cx/cy are fed
// from the host AnimatedLinePath's shared point-array spring (so the marker
// stays glued to the path); for single-point / segment-mode it receives plain
// numbers and springs its own pop/fade entrance.
const StyledAnimatedCircle = styled(AnimatedCircle)`
	&:focus {
		outline: none;
	}
`;

/**
 * Normalize a value for use in keys.
 * Converts Date objects to ISO strings for consistent keys across editor and frontend.
 * @param value
 */
function normalizeKeyValue(value: any): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	return String(value);
}

/**
 * Generate a unique key for a line segment.
 * Handles Date objects by converting to ISO strings.
 * @param startX
 * @param endX
 * @param category
 */
function generateSegmentKey(startX: any, endX: any, category: string): string {
	const start = normalizeKeyValue(startX);
	const end = normalizeKeyValue(endX);
	return `${start}::${end}::${category}`;
}

/**
 * Generate a unique key for a shape (circle/node).
 * Handles Date objects by converting to ISO strings.
 * Supports optional group value for group-aware keys.
 * @param x
 * @param category
 * @param groupValue
 */
function generateShapeKey(x: any, category: string, groupValue: string | null = null): string {
	return generateElementKeyUtil(x, category, groupValue);
}

const Line = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const {
		dependentAxis,
		independentAxis,
		line,
		layout,
		colors,
		nodes,
		dataRender,
		tooltip,
		labels,
		shapes,
		legend,
		plotBands,
		voronoi: voronoiConfig,
		events,
		annotations,
		drawings,
	} = config;

	// SIZE AND LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);

	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const scaledNumTicks = useMemo(
		() => scaleAxisNumTicks(independentAxis.tickCount || 5, chartWidth, width),
		[independentAxis.tickCount, chartWidth, width]
	);

	// DATA PROCESSING
	const flattenedData = useMemo(
		() =>
			data.reduce((acc: string | any[], curr: any) => {
				return acc.concat(curr);
			}, []),
		[data]
	);
	flattenedData.sort((a: FlatData, b: FlatData) => {
		if (dataRender.sortOrder === 'ascending') {
			if (independentAxis.scale === 'time') {
				return ascending(
					newDateByFormat(a[dataRender.x], dataRender.xFormat) as Date,
					newDateByFormat(b[dataRender.x], dataRender.xFormat) as Date
				);
			}
			return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
		}
		if (dataRender.sortOrder === 'descending') {
			return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
		}
		return 0;
	});

	// to render the voronoi, we need to flatten the data further,
	// assigning each point its own polygon

	const voronoiData = useMemo(
		() =>
			flattenedData
				.map((d: FlatData) =>
					// eslint-disable-next-line array-callback-return
					dataRender.categories.map((c: string, i: number) => {
						if (d[c]) {
							const { body: _lineTip, header: _lineHdr } = getCustomTooltip(d, c);
							return {
								x: d.x,
								y: d[c],
								category: c,
								label: d.__labels?.[c] ? d.__labels[c] : '',
								tooltip: _lineTip,
								tooltipHeader: _lineHdr,
								color: resolveCategoryColor({
									category: c,
									fallback: colors[i],
									dataRender,
								}),
							};
						}
					})
				)
				.flat()
				.filter(Boolean),
		[dataRender, flattenedData, colors]
	);

	// DATA ACCESSORS

	const getIndependentValue = useCallback(
		(d: FlatData) => {
			if (independentAxis.scale === 'time') {
				return newDateByFormat(d[dataRender.x], dataRender.xFormat) as Date;
			}
			return d[dataRender.x] as number;
		},
		[dataRender, independentAxis]
	);

	const getDependentValue = useCallback((d: FlatData) => d[dataRender.y] as number, [dataRender]);

	// SCALES, VORONOI, INTERPOLATION
	const timeScale = useMemo(
		() =>
			scaleTime({
				domain: extent(flattenedData, getIndependentValue) as [Date, Date],
				range: [0, innerWidth],
			}),
		[innerWidth, flattenedData, getIndependentValue]
	);
	const linearScale = useMemo(
		() =>
			scaleLinear({
				domain: independentAxis.domain
					? independentAxis.domain
					: [0, max(flattenedData, getIndependentValue) || 0],
				range: [0, innerWidth],
			}),
		[innerWidth, independentAxis, flattenedData, getIndependentValue]
	);
	const independentScale = independentAxis.scale === 'time' ? timeScale : linearScale;
	const dependentScale = useMemo(
		() =>
			scaleLinear({
				domain: dependentAxis.domain ? dependentAxis.domain : [0, max(flattenedData, getDependentValue) || 0],
				range: [innerHeight, 0],
				nice: true,
			}),
		[innerHeight, flattenedData, dependentAxis, getDependentValue]
	);
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: dataRender.categories,
				range: colors,
			}),
		[dataRender.categories, colors]
	);
	const voronoiLayout = useMemo(
		() =>
			voronoi<FlatData>({
				x: (d) => independentScale(getIndependentValue(d)),
				y: (d) => dependentScale(getDependentValue(d)),
				width: innerWidth,
				height: innerHeight,
			})(voronoiData),
		[innerWidth, innerHeight, independentScale, dependentScale, voronoiData, getIndependentValue, getDependentValue]
	);
	const interpolation: keyof CurveType = line.interpolation;

	// When segment mode is active, render individual straight segments so
	// per-segment color/dash customization works. When off, render a single
	// LinePath so the curve interpolation setting is respected.
	// segmentsActive is the explicit opt-in flag; falling back to checking
	// segmentStyles ensures charts saved before the flag existed still work.
	const isSegmentMode = shapes?.segmentsActive === true || Object.keys(shapes?.segmentStyles ?? {}).length > 0;

	// GET SHARED LAYOUT PROPS
	const onTickClick = wpEditorFunctions?.tickLabels?.onClick;
	const independentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="independent" onTickClick={onTickClick} />
	);
	const dependentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="dependent" onTickClick={onTickClick} />
	);
	const {
		dependentAxisProps,
		independentAxisProps,
		dependentGridProps,
		independentGridProps,
		voronoiProps,
		ariaProps,
		legendProps,
		tooltipVisible,
		annotationsVisible,
		labelProps,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'line chart',
				config,
				data: flattenedData,
				size,
				tableData,
				dependentScale,
				independentScale,
				independentTicksComponent,
				dependentTicksComponent,
			}),
		[
			config,
			flattenedData,
			size,
			tableData,
			dependentScale,
			independentScale,
			independentTicksComponent,
			dependentTicksComponent,
		]
	);

	const lineLabelDeclutterInputs = useMemo(() => {
		if (!labels.active || !labels.autoDeclutter) {
			return [];
		}
		return buildLineChartLabelInputs({
			categories: dataRender.categories,
			flattenedData,
			labels,
			labelProps,
			independentScale,
			dependentScale,
			getIndependentValue,
		});
	}, [
		labels,
		dataRender.categories,
		flattenedData,
		labelProps,
		independentScale,
		dependentScale,
		getIndependentValue,
	]);

	const lineLabelOffsets = useLabelDeclutter(
		lineLabelDeclutterInputs,
		{
			padding: labels.declutterPadding ?? 4,
			lockX: false,
			iterations: 160,
			anchorStrengthX: 0.35,
			anchorStrengthY: 0.35,
			innerWidth,
			innerHeight,
		},
		!!(labels.active && labels.autoDeclutter)
	);

	const { isDirectLegend, directSeriesDeclutterInputs, directSeriesOffsets, labelScales } = useDirectSeriesLegend({
		legend,
		labels,
		dataRender,
		flattenedData,
		innerWidth,
		innerHeight,
		padding,
		layout,
		independentScale,
		dependentScale,
		getIndependentValue,
	});

	const renderLineChartLabel = (
		key: string,
		LabelComponent: typeof AnimatedLabel | typeof DraggableLabel,
		{
			anchorX,
			anchorY,
			labelId,
			dataPoint,
			category,
			defaultLabel,
			labelContent,
			seriesColor,
		}: {
			anchorX: number;
			anchorY: number;
			labelId: string;
			dataPoint: FlatData;
			category: string;
			defaultLabel: string;
			labelContent: string;
			seriesColor: string;
		}
	) => {
		const { dx, dy } = getDeclutterOffset(
			lineLabelOffsets,
			labelId,
			labels.labelPositionDX,
			labels.labelPositionDY
		);

		return (
			<LabelComponent
				key={key}
				x={anchorX}
				y={anchorY}
				dataPoint={dataPoint}
				category={category}
				defaultDx={dx}
				defaultDy={dy}
				chartInnerWidth={innerWidth}
				chartInnerHeight={innerHeight}
				defaultLabel={defaultLabel}
				fill={getLabelFill({ labelColor: labels.color, seriesColor })}
				leaderLine={
					labels.autoDeclutter && labels.declutterLeaderLines
						? { enabled: true, anchorRadius: nodes.pointSize }
						: undefined
				}
				{...labelProps}
			>
				{labelContent}
			</LabelComponent>
		);
	};

	// TOOLTIP AND HANDLERS
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();

	// Track cursor position for better tooltip positioning
	const [cursorPosition, setCursorPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);

	// Track hovered segment for editor visual feedback
	// Key format: "categoryIndex-segmentIndex" e.g., "0-3" for category 0, segment 3
	const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

	let tooltipTimeout: number = 0;

	const handleMouseMove = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (tooltipTimeout) clearTimeout(tooltipTimeout);
			if (!svgRef.current) return;

			// Use our iframe-aware utility function to get point coordinates
			const point = getLocalPoint(svgRef.current, event);

			if (!point) {
				return;
			}

			// Store SVG-relative cursor position for tooltip positioning
			setCursorPosition({ x: point.x, y: point.y });

			const adjustedX = point.x - padding.left;
			const adjustedY = point.y - padding.top;

			// Use a max search radius to avoid showing tooltips when cursor is
			// far from any data point. Scale the radius relative to chart size
			// so it works at different viewport widths.
			const maxSearchRadius = Math.max(innerWidth, innerHeight) * 0.15;
			const closest = voronoiLayout.find(adjustedX, adjustedY, maxSearchRadius);
			if (closest) {
				showTooltip({
					tooltipLeft: independentScale(getIndependentValue(closest.data)),
					tooltipTop: dependentScale(getDependentValue(closest.data)),
					tooltipData: closest.data,
				});
			} else {
				hideTooltip();
			}
		},
		[
			independentScale,
			dependentScale,
			showTooltip,
			hideTooltip,
			voronoiLayout,
			getDependentValue,
			getIndependentValue,
			innerWidth,
			innerHeight,
			layout,
			tooltipTimeout,
			wpEditorFunctions,
			tooltip.active,
			tooltipVisible,
			padding,
			data.length,
			setCursorPosition,
		]
	);
	const handleOnClick = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (events.click) {
				if (!svgRef.current) return;

				// find the nearest polygon to the current mouse position
				const point = getLocalPoint(svgRef.current, event);
				if (!point) return;
				const closest = voronoiLayout.find(point.x - padding.left, point.y - padding.top);
				if (closest) {
					events.click(closest.data, event);
				}
			}
		},
		[voronoiLayout, layout, events.click]
	);

	const handleMouseLeave = useCallback(() => {
		// eslint-disable-next-line react-hooks/exhaustive-deps
		tooltipTimeout = window.setTimeout(() => {
			hideTooltip();
		}, 300);
	}, [hideTooltip]);

	return (
		<TransitionProvider data={data} family="line">
			<div
				style={{
					position: 'relative',
					overflowX: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={chartWidth}
					height={height}
					ref={svgRef}
					style={{
						pointerEvents: tooltip.active ? 'auto' : 'none',
					}}
					{...ariaProps}
				>
					<LeaderLineProvider>
						<Group
							top={padding.top}
							left={padding.left}
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
							onClick={handleOnClick}
							role="presentation"
						>
							{/* Invisible rect to capture mouse events across the entire chart area.
              Without this, SVG <g> elements only receive events on child elements,
              leaving empty space unresponsive to hover/voronoi detection. */}
							<rect
								width={innerWidth}
								height={innerHeight}
								fill="transparent"
								style={{ pointerEvents: 'all' }}
							/>
							{plotBands.active && (
								<PlotBands
									plotBands={plotBands}
									independentScale={independentScale}
									innerHeight={innerHeight}
								/>
							)}
							<GridRows {...dependentGridProps} />
							<GridColumns {...independentGridProps} />
							{voronoiConfig.active &&
								voronoiLayout
									.polygons()
									.map((polygon, i) => (
										<VoronoiPolygon
											{...voronoiProps}
											key={`polygon-${i}`}
											polygon={polygon}
											fillOpacity={tooltipData === polygon.data ? 0.1 : 0}
										/>
									))}
							{dependentAxis.active && (
								<g style={{ pointerEvents: 'none' }}>
									<AxisLeft {...dependentAxisProps} />
								</g>
							)}
							{independentAxis.active && (
								<g style={{ pointerEvents: 'none' }}>
									<AxisBottom {...independentAxisProps} top={innerHeight} numTicks={scaledNumTicks} />
								</g>
							)}
							{(labels.autoDeclutter && labels.declutterLeaderLines) ||
							(labels.active && wpEditorFunctions?.labels) ? (
								<LeaderLineUnderlay />
							) : null}
							{/* iterate over each category and render a line for each */}
							{dataRender.categories.map((category: string, i: number) => {
								// it's not guaranteed that all categories have the same number of data points
								// so we need to filter out any data points that don't have a value for the current category
								const filteredData = flattenedData.filter(
									(d: FlatData) => d[category] || d[category] !== ''
								);
								const seriesColor = resolveCategoryColor({
									category,
									fallback: colors[i],
									dataRender,
								});
								const seriesOpacity = resolveCategoryOpacity({
									category,
									dataRender,
								});

								// Marker renderer shared by curve mode (where `cx`/`cy` are
								// fed from the AnimatedLinePath shared point-array spring so
								// the marker stays glued to the path — Option A) and the
								// segment / single-point fallback (plain numeric `cx`/`cy`,
								// so the marker springs its own pop/fade entrance).
								// `cx`/`cy` may be a number or a react-spring animated value.
								const renderMarker = (
									d: FlatData,
									j: number,
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									cx: any,
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									cy: any,
									entranceDelay = 0,
									entranceDuration: number | undefined = undefined
								) => {
									const groupValue = getGroupValue(d, dataRender);
									const shapeKey = generateShapeKey(d.x, category, groupValue);
									const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
									const defaultColor = nodes.pointFill === 'inherit' ? seriesColor : 'white';
									const defaultStroke = seriesColor;
									const shapeFill = customShapeStyles.fill || defaultColor;
									const shapeStroke = customShapeStyles.stroke || defaultStroke;
									const shapeStrokeWidth = customShapeStyles.strokeWidth ?? nodes.pointStrokeWidth;
									const shapeOpacity = (customShapeStyles.opacity ?? 1) * seriesOpacity;
									return (
										<StyledAnimatedCircle
											key={j}
											tabIndex={0}
											r={nodes.pointSize}
											cx={cx}
											cy={cy}
											entranceDelay={entranceDelay}
											entranceDuration={entranceDuration}
											stroke={shapeStroke}
											strokeWidth={shapeStrokeWidth}
											fill={shapeFill}
											opacity={shapeOpacity}
											style={{
												cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
												pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
											}}
											onClick={(event: React.MouseEvent) => {
												if (wpEditorFunctions?.shapes?.onClick) {
													wpEditorFunctions.shapes.onClick(
														d,
														category,
														defaultColor,
														event.currentTarget,
														groupValue
													);
												}
											}}
											fillOpacity={
												tooltipData &&
												tooltipVisible &&
												tooltip.deemphasizeSiblings &&
												tooltipData.category !== category
													? tooltip.deemphasizeOpacity
													: 1
											}
											onBlur={() => {
												tooltipTimeout = window.setTimeout(() => {
													hideTooltip();
												}, 300);
											}}
											onFocus={() => {
												if (tooltipTimeout) clearTimeout(tooltipTimeout);
												const { body: _focusTip, header: _focusHdr } = getCustomTooltip(
													d,
													category
												);
												showTooltip({
													tooltipLeft: independentScale(getIndependentValue(d)),
													tooltipTop: dependentScale(d[category]),
													tooltipData: {
														x: d.x,
														y: d[category],
														category,
														color: seriesColor,
														tooltip: _focusTip,
														tooltipHeader: _focusHdr,
													},
												});
											}}
										/>
									);
								};

								return (
									<g key={`line-group-${i}`}>
										{line.showArea && (
											<AnimatedArea
												key={`area-${i}`}
												points={filteredData.map((d: FlatData) => ({
													x: independentScale(getIndependentValue(d)) ?? 0,
													y0: dependentScale(dependentScale.domain()[0]) ?? 0,
													y1: dependentScale(d[category]) ?? 0,
												}))}
												strokeWidth={0}
												fill={seriesColor}
												fillOpacity={line.areaFillOpacity * seriesOpacity}
												curve={Curve[interpolation]}
												style={{
													cursor: wpEditorFunctions?.line ? 'pointer' : undefined,
													pointerEvents: wpEditorFunctions?.line ? 'all' : 'none',
												}}
												onClick={(event: React.MouseEvent<SVGPathElement>) => {
													wpEditorFunctions?.line?.onClick?.(event.currentTarget);
												}}
											/>
										)}
										{/* Line rendering: single curved LinePath when no segment styles,
								    individual straight segments when segment styles exist */}
										{filteredData.length > 1 &&
											(isSegmentMode ? (
												/* --- Segment mode: straight segments with per-segment customization --- */
												filteredData
													.slice(0, -1)
													.map((startPoint: FlatData, segIdx: number) => {
														const endPoint = filteredData[segIdx + 1];
														const segmentKey = generateSegmentKey(
															startPoint.x,
															endPoint.x,
															category
														);
														const hoverKey = `${i}-${segIdx}`;

														// Get custom segment styles
														const customSegmentStyles =
															shapes?.segmentStyles?.[segmentKey] || {};

														// Calculate coordinates
														const x1 = independentScale(getIndependentValue(startPoint));
														const y1 = dependentScale(startPoint[category]);
														const x2 = independentScale(getIndependentValue(endPoint));
														const y2 = dependentScale(endPoint[category]);

														// Skip if coordinates are invalid
														if (
															x1 === undefined ||
															y1 === undefined ||
															x2 === undefined ||
															y2 === undefined
														) {
															return null;
														}

														// Determine if this segment is hovered (editor mode only)
														const isHovered =
															wpEditorFunctions?.segments && hoveredSegment === hoverKey;

														// Apply custom styles with fallbacks
														const segmentStroke = customSegmentStyles.stroke || seriesColor;
														const segmentStrokeWidth =
															customSegmentStyles.strokeWidth ?? line.strokeWidth;
														const segmentOpacity = customSegmentStyles.opacity ?? 1;
														const segmentDasharray =
															customSegmentStyles.strokeDasharray || line.strokeDasharray;

														// Tooltip deemphasis
														const isDeemphasized =
															tooltipData &&
															tooltipVisible &&
															tooltip.deemphasizeSiblings &&
															tooltipData.category !== category;

														// Hover highlight styling
														const displayStrokeWidth = isHovered
															? segmentStrokeWidth + 2
															: tooltipData &&
																  tooltipVisible &&
																  tooltip.deemphasizeSiblings &&
																  tooltipData.category === category
																? segmentStrokeWidth + 1
																: segmentStrokeWidth;

														// Generate path d attribute for the segment
														const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;

														return (
															<g key={`segment-${i}-${segIdx}`}>
																{/* Invisible hit area for easier clicking (editor mode only) */}
																{wpEditorFunctions?.segments && (
																	<path
																		d={pathD}
																		stroke="transparent"
																		strokeWidth={16}
																		fill="none"
																		style={{
																			cursor: 'pointer',
																			pointerEvents: 'all',
																		}}
																		onMouseEnter={() => setHoveredSegment(hoverKey)}
																		onMouseLeave={() => setHoveredSegment(null)}
																		onClick={(event: React.MouseEvent) => {
																			wpEditorFunctions.segments.onClick(
																				startPoint,
																				endPoint,
																				category,
																				seriesColor,
																				event.currentTarget
																			);
																		}}
																	/>
																)}
																{/* Visible segment path */}
																<path
																	d={pathD}
																	stroke={isHovered ? '#007cba' : segmentStroke}
																	strokeWidth={displayStrokeWidth}
																	strokeOpacity={
																		(isDeemphasized
																			? tooltip.deemphasizeOpacity
																			: segmentOpacity) * seriesOpacity
																	}
																	strokeDasharray={segmentDasharray}
																	fill="none"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	style={{
																		pointerEvents: 'none',
																		transition: wpEditorFunctions?.segments
																			? 'stroke 0.15s ease, stroke-width 0.15s ease'
																			: undefined,
																	}}
																/>
															</g>
														);
													})
											) : (
												/* --- Curve mode: single AnimatedLinePath respecting interpolation setting.
										   Owns the shared point-array spring; markers (showPoints) are rendered
										   via the render-prop and glued to the path (Option A). --- */
												<AnimatedLinePath
													key={`line-path-${i}`}
													points={filteredData.map((d: FlatData) => ({
														x: independentScale(getIndependentValue(d)) ?? 0,
														y: dependentScale(d[category]) ?? 0,
													}))}
													stroke={seriesColor}
													strokeWidth={line.strokeWidth}
													strokeDasharray={line.strokeDasharray || undefined}
													strokeOpacity={
														(tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														tooltipData.category !== category
															? tooltip.deemphasizeOpacity
															: 1) * seriesOpacity
													}
													strokeLinejoin="round"
													curve={Curve[interpolation]}
													style={{
														cursor: wpEditorFunctions?.line ? 'pointer' : undefined,
														pointerEvents: wpEditorFunctions?.line ? 'all' : 'none',
													}}
													onClick={(event: React.MouseEvent<SVGPathElement>) => {
														wpEditorFunctions?.line?.onClick?.(event.currentTarget);
													}}
												>
													{(glide) =>
														line.showPoints
															? filteredData.map((d: FlatData, j: number) => {
																	const { cx, cy } = glide.pointAt(j);
																	return renderMarker(
																		d,
																		j,
																		cx,
																		cy,
																		glide.entranceDelay,
																		glide.entranceDuration
																	);
																})
															: null
													}
												</AnimatedLinePath>
											))}
										{/* Markers for segment mode / single-point series (no host
								    line spring to glue to — own pop/fade entrance). Curve-mode
								    markers are rendered inside AnimatedLinePath above. */}
										{line.showPoints &&
											(isSegmentMode || filteredData.length <= 1) &&
											filteredData?.map((d: FlatData, j: number) =>
												renderMarker(
													d,
													j,
													independentScale(getIndependentValue(d)),
													dependentScale(d[category])
												)
											)}
										{labels.active &&
											!wpEditorFunctions?.labels &&
											filteredData?.map((d: FlatData, j: number) => {
												if (!isLabelVisible(d, category)) {
													return null;
												}

												const { content: labelContent, defaultLabel } = getLineLabelContent(
													d,
													category,
													j,
													filteredData.length,
													labels
												);

												if (!labelContent) return null;

												const labelId = buildLineChartLabelId(i, category, d, j);

												return renderLineChartLabel(`line-group-${j}-label`, AnimatedLabel, {
													anchorX: independentScale(getIndependentValue(d)),
													anchorY: dependentScale(d[category]),
													labelId,
													dataPoint: d,
													category,
													defaultLabel,
													labelContent,
													seriesColor,
												});
											})}
										{tooltipData && tooltipVisible && (
											<g>
												<Circle
													cx={tooltipLeft}
													cy={tooltipTop}
													r={nodes.pointSize + 2}
													fill={resolveCategoryColor({
														category: tooltipData.category || '',
														fallback: colorScale(tooltipData.category || ''),
														dataRender,
													})}
													fillOpacity={line.showPoints ? 0.1 : 1}
													stroke={resolveCategoryColor({
														category: tooltipData.category || '',
														fallback: colorScale(tooltipData.category || ''),
														dataRender,
													})}
													strokeOpacity={0.1}
													strokeWidth={2}
													pointerEvents="none"
												/>
												<Circle
													cx={tooltipLeft}
													cy={tooltipTop}
													r={nodes.pointSize + 1}
													fill="transparent"
													stroke="white"
													strokeWidth={2}
													pointerEvents="none"
												/>
											</g>
										)}
									</g>
								);
							})}
						</Group>
						{annotationsVisible && (
							<AnnotationsLayer
								config={annotations}
								width={chartWidth}
								height={height}
								layout={layout}
								chartWidth={chartWidth}
							/>
						)}
						{drawings?.active && !wpEditorFunctions && (
							<DrawingsLayer
								config={drawings}
								width={chartWidth}
								height={height}
								layout={layout}
								chartWidth={chartWidth}
							/>
						)}
						{/* Render draggable labels outside main Group to avoid event capture */}
						{labels.active && wpEditorFunctions?.labels && (
							<Group top={padding.top} left={padding.left}>
								{dataRender.categories.map((category: string, i: number) => {
									const filteredData = flattenedData.filter(
										(d: FlatData) => d[category] || d[category] !== ''
									);
									const seriesColor = resolveCategoryColor({
										category,
										fallback: colors[i],
										dataRender,
									});
									return filteredData?.map((d: FlatData, j: number) => {
										const { content: labelContent, defaultLabel } = getLineLabelContent(
											d,
											category,
											j,
											filteredData.length,
											labels
										);

										if (!labelContent) return null;

										const labelId = buildLineChartLabelId(i, category, d, j);

										return renderLineChartLabel(`draggable-line-label-${i}-${j}`, DraggableLabel, {
											anchorX: independentScale(getIndependentValue(d)),
											anchorY: dependentScale(d[category]),
											labelId,
											dataPoint: d,
											category,
											defaultLabel,
											labelContent,
											seriesColor,
										});
									});
								})}
							</Group>
						)}
						{isDirectLegend && (
							<DirectSeriesLegendLabels
								inputs={directSeriesDeclutterInputs}
								offsets={directSeriesOffsets}
								legend={legend}
								colors={colors}
								dataRender={dataRender}
								padding={padding}
								chartInnerWidth={innerWidth}
								chartInnerHeight={innerHeight}
								labelScales={labelScales}
							/>
						)}
					</LeaderLineProvider>
				</svg>
				{legend.active && legend.variation !== 'direct' && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
						<LegendOrdinal
							{...legendProps}
							scale={scaleOrdinal<string, string>({
								domain: dataRender.categories,
								range: colors,
							})}
							domain={legend.categories.length > 0 ? legend.categories : colorScale.domain()}
						>
							{(legendLabels) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) =>
										resolveCategoryColor({
											category: label.datum,
											fallback: colorScale(label.datum),
											dataRender,
										})
									}
									shapeStyle={(label) =>
										legendCategoryShapeStyle(label, dataRender, legendProps.shapeStyle)
									}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendOrdinal>
					</StyledLegend>
				)}
				{tooltipOpen && tooltipData && tooltipVisible && (
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
								<div
									style={{
										marginBottom: '10px',
									}}
								>
									<strong>
										{tooltipData.tooltipHeader
											? tooltipData.tooltipHeader
											: getTooltipHeaderFormat(
													{
														x: getIndependentValue(tooltipData),
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
								__html: tooltipData.tooltip
									? tooltipData.tooltip
									: getTooltipFormat(
											{
												x: getIndependentValue(tooltipData),
												y: getDependentValue(tooltipData),
												category: tooltipData.category,
												color: resolveCategoryColor({
													category: tooltipData.category || '',
													fallback: colorScale(tooltipData.category || ''),
													dataRender,
												}),
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

export default Line;

// REACT
import { useCallback, useContext, useMemo, useRef, RefObject, CSSProperties } from 'react';

// INTERNAL
import { DataContext } from '@prc/charting-utilities';
import {
	scaleAxisNumTicks,
	useSize,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	isLabelVisible,
	getGroupValue,
	generateElementKey,
} from '@prc/charting-utilities';
import {
	getAxisProps,
	getChartDimensions,
	getGridProps,
	getLabelFormat,
	getLabelProps,
	getVoronoiProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getTooltipVisible,
	getLocalPoint,
	getSharedProps,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
} from '@prc/charting-utilities';
import { newDateByFormat, getLabelFill } from '@prc/charting-utilities';
import {
	StyledTooltip,
	StyledLegend,
	PlotBands,
	AnnotationsLayer,
	DrawingsLayer,
	ClickableTicks,
	ClickableLegend,
} from '../overlays';
import { AnimatedArea, AnimatedCircle, AnimatedLinePath, AnimatedLabel, TransitionProvider } from '../animation';
import { DraggableLabel } from '../labels';
import { DirectSeriesLegendLabels, getStackedSeriesDependentValue, useDirectSeriesLegend } from '../labels';
// TYPES
import type { FlatData } from '@prc/charting-utilities';
import type { Size } from '@prc/charting-utilities';
import type { BaseConfig } from '@prc/charting-utilities';
import type { TableData } from '@prc/charting-utilities';
// VISX
import { Circle, AreaStack } from '@visx/shape';
import * as Curve from '@visx/curve';
import { Group } from '@visx/group';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleTime, scaleLinear, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import { LegendOrdinal } from '@visx/legend';
import { max, extent, ascending, descending } from 'd3-array';
import styled from '@emotion/styled';

// Animated stacked-area marker (PRC-17 slice 3f). Its cx/cy are fed from the
// host AnimatedLinePath's shared point-array spring (the stack's top line), so
// each marker stays glued to its boundary line on data changes (Option A).
const StyledAnimatedCircle = styled(AnimatedCircle)`
	&:focus {
		outline: none;
	}
	&:focus-visible {
		outline: 2px solid #007cba;
		outline-offset: 2px;
	}
`;

type CurveType = typeof Curve;

const StackedArea = () => {
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
		shapes,
		events,
		dataRender,
		tooltip,
		labels,
		legend,
		plotBands,
		voronoi: voronoiConfig,
		annotations,
		drawings,
	} = config;

	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	let size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	let isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	let scaledNumTicks = useMemo(
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
	// for each object in the flattenedData array, create a new object where each value adds the previous value
	const stackedVoronoiData = useMemo(
		() =>
			flattenedData
				.map((d: FlatData) =>
					dataRender.categories.map((c: string, i) => {
						const sumOfYs = dataRender.categories.slice(0, i + 1).reduce((acc, curr) => {
							return Number(acc) + Number(d[curr]);
						}, 0);

						if (d[c]) {
							const { body: _areaTip, header: _areaHdr } = getCustomTooltip(d, c);
							return {
								x: d.x,
								y: d[c],
								ySum: sumOfYs,
								category: c,
								label: d['__labels']?.[c] ? d['__labels'][c] : '',
								tooltip: _areaTip,
								tooltipHeader: _areaHdr,
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
			} else {
				return d[dataRender.x] as number;
			}
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
				domain: dependentAxis.domain,
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
				y: (d) => dependentScale(d.ySum),
				width: innerWidth,
				height: innerHeight,
			})(stackedVoronoiData),
		[
			innerWidth,
			innerHeight,
			independentScale,
			dependentScale,
			stackedVoronoiData,
			getIndependentValue,
			getDependentValue,
		]
	);
	const interpolation: keyof CurveType = line.interpolation;

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
		labelProps,
		annotationsVisible,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'stacked area chart',
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

	const getSeriesDependentValue = useCallback(
		(d: FlatData, _category: string, categoryIndex: number) =>
			getStackedSeriesDependentValue(d, dataRender.categories, categoryIndex),
		[dataRender.categories]
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
		getSeriesDependentValue,
	});

	// TOOLTIP AND HANDLERS
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();

	let tooltipTimeout: number = 0;
	const handleMouseMove = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (tooltipTimeout) clearTimeout(tooltipTimeout);
			if (!svgRef.current) return;

			// find the nearest polygon to the current mouse position
			const point = getLocalPoint(svgRef.current, event);
			if (!point) return;
			// Use a max search radius to avoid showing tooltips when cursor is
			// far from any data point.
			const maxSearchRadius = Math.max(innerWidth, innerHeight) * 0.15;
			const closest = voronoiLayout.find(point.x - padding.left, point.y - padding.top, maxSearchRadius);
			if (closest) {
				showTooltip({
					tooltipLeft: independentScale(getIndependentValue(closest.data)),
					tooltipTop: dependentScale(closest.data.ySum),
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
		]
	);
	const handleMouseLeave = useCallback(() => {
		// eslint-disable-next-line react-hooks/exhaustive-deps
		tooltipTimeout = window.setTimeout(() => {
			hideTooltip();
		}, 300);
	}, [hideTooltip]);

	// Render a stacked-area point marker glued to its stack's top line. `s` is
	// an AreaStack datum (`s.data` is the source row, `s[1]` is the cumulative
	// top = ySum). `cx`/`cy` come from the host AnimatedLinePath's shared
	// spring so the marker rides the boundary line as it morphs (Option A).
	const renderStackMarker = (
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		s: any,
		category: string,
		seriesColor: string,
		seriesOpacity: number,
		j: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		cx: any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		cy: any,
		entranceDelay = 0,
		entranceDuration: number | undefined = undefined
	) => {
		const d = s.data as FlatData;
		const ySum = s[1] as number;
		const groupValue = getGroupValue(d, dataRender);
		const shapeKey = generateElementKey(d.x, category, groupValue);
		const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
		const defaultColor = nodes.pointFill === 'inherit' ? seriesColor : 'white';
		const defaultStroke = seriesColor;
		const shapeFill = customShapeStyles.fill || defaultColor;
		const shapeStroke = customShapeStyles.stroke || defaultStroke;
		const shapeStrokeWidth = customShapeStyles.strokeWidth ?? nodes.pointStrokeWidth;
		const shapeOpacity = (customShapeStyles.opacity ?? 1) * seriesOpacity;
		return (
			<StyledAnimatedCircle
				key={`stacked-area-point-${category}-${j}`}
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
						wpEditorFunctions.shapes.onClick(d, category, defaultColor, event.currentTarget, groupValue);
					}
				}}
				fillOpacity={
					tooltipData && tooltipVisible && tooltip.deemphasizeSiblings && tooltipData.category !== category
						? tooltip.deemphasizeOpacity
						: 1
				}
				tabIndex={wpEditorFunctions?.shapes ? 0 : undefined}
				onFocus={() => {
					if (tooltipTimeout) clearTimeout(tooltipTimeout);
					const { body: _afTip, header: _afHdr } = getCustomTooltip(d, category);
					showTooltip({
						tooltipLeft: independentScale(getIndependentValue(d)),
						tooltipTop: dependentScale(ySum),
						tooltipData: {
							x: d.x,
							y: d[category],
							category,
							color: seriesColor,
							tooltip: _afTip,
							tooltipHeader: _afHdr,
						},
					});
				}}
				onBlur={() => {
					tooltipTimeout = window.setTimeout(() => {
						hideTooltip();
					}, 300);
				}}
			/>
		);
	};

	return (
		<TransitionProvider data={data} family="line">
			<div style={{ position: 'relative', overflow: overflow as CSSProperties['overflowX'] }}>
				<svg
					width={chartWidth}
					height={height}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<Group
						top={padding.top}
						left={padding.left}
						role="presentation"
						onMouseMove={handleMouseMove}
						onMouseLeave={handleMouseLeave}
					>
						{/* Invisible rect to capture mouse events across the entire chart area */}
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
						<AreaStack
							keys={dataRender.categories}
							data={flattenedData}
							x={(d: any) => independentScale(getIndependentValue(d.data))}
							y0={(d) => dependentScale(d[0])}
							y1={(d) => dependentScale(d[1])}
							curve={Curve[interpolation]}
						>
							{({ stacks }) => {
								// Two passes preserve z-order: ALL areas first, then all
								// lines (each line also renders its own markers via the
								// shared-spring render-prop). Markers therefore sit above
								// every area, exactly as before, while staying glued to
								// their stack's top line (Option A).
								const areas = stacks.map((stack, i) => {
									const category = stack.key;
									const seriesColor = resolveCategoryColor({
										category,
										fallback: colors[i],
										dataRender,
									});
									const seriesOpacity = resolveCategoryOpacity({
										category,
										dataRender,
									});
									const filteredStackData = stack.filter(
										(d: any) => d.data[category] !== '' || d.data[category]
									);

									return (
										<AnimatedArea
											key={`stack-${category}`}
											points={filteredStackData.map((d: any) => ({
												x: independentScale(getIndependentValue(d.data)),
												y0: dependentScale(d[0]),
												y1: dependentScale(d[1]),
											}))}
											curve={Curve[interpolation]}
											strokeWidth={0}
											fill={seriesColor}
											fillOpacity={line.areaFillOpacity * seriesOpacity}
										/>
									);
								});
								const lines = stacks.map((stack, i) => {
									const category = stack.key;
									const seriesColor = resolveCategoryColor({
										category,
										fallback: colors[i],
										dataRender,
									});
									const seriesOpacity = resolveCategoryOpacity({
										category,
										dataRender,
									});
									const filteredStackData = stack.filter(
										(d: any) => d.data[category] !== '' || d.data[category]
									);
									return (
										<AnimatedLinePath
											key={`line-${category}`}
											points={filteredStackData.map((d: any) => ({
												x: independentScale(getIndependentValue(d.data)),
												y: dependentScale(d[1]),
											}))}
											strokeWidth={
												tooltipData &&
												tooltipVisible &&
												tooltip.deemphasizeSiblings &&
												tooltipData.category === category
													? line.strokeWidth + 1
													: line.strokeWidth
											}
											stroke={seriesColor}
											strokeOpacity={
												(tooltipData &&
												tooltipVisible &&
												tooltip.deemphasizeSiblings &&
												tooltipData.category !== category
													? tooltip.deemphasizeOpacity
													: 1) * seriesOpacity
											}
											curve={Curve[interpolation]}
											strokeDasharray={line.strokeDasharray}
										>
											{(glide) =>
												line.showPoints
													? filteredStackData.map((s: any, j: number) => {
															const { cx, cy } = glide.pointAt(j);
															return renderStackMarker(
																s,
																category,
																seriesColor,
																seriesOpacity,
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
									);
								});
								return (
									<g>
										{areas}
										{lines}
									</g>
								);
							}}
						</AreaStack>
						{labels.active &&
							!wpEditorFunctions?.labels &&
							dataRender.categories.map((category: string, categoryIndex: number) => {
								const filteredData = flattenedData.filter(
									(d: FlatData) => d[category] || d[category] !== ''
								);
								return filteredData?.map((d: FlatData, j: number) => {
									// Check visibility - don't render if hidden
									if (!isLabelVisible(d, category)) {
										return null;
									}

									const customLabelText = getCustomLabelText(d, category);
									const customLabel = customLabelText || getCustomLabel(d, category);

									// Calculate stacked Y position (sum of all previous categories + current)
									const ySum = dataRender.categories
										.slice(0, categoryIndex + 1)
										.reduce((acc: number, curr: string) => {
											return Number(acc) + Number(d[curr]);
										}, 0);

									// Generate default label
									const defaultLabel = getLabelFormat(d[category], category, labels, null);

									// Determine label content
									let labelContent = '';
									if (customLabel) {
										labelContent = customLabel;
									} else if (
										labels.showFirstLastPointsOnly &&
										(j === 0 || j === filteredData.length - 1)
									) {
										labelContent = defaultLabel;
									} else if (!labels.showFirstLastPointsOnly) {
										labelContent = defaultLabel;
									}

									// Don't render if no content
									if (!labelContent) return null;

									return (
										<AnimatedLabel
											key={`stacked-area-label-${categoryIndex}-${j}`}
											x={independentScale(getIndependentValue(d))}
											y={dependentScale(ySum)}
											dataPoint={d}
											category={category}
											defaultDx={labels.labelPositionDX}
											defaultDy={labels.labelPositionDY}
											chartInnerWidth={innerWidth}
											chartInnerHeight={innerHeight}
											defaultLabel={defaultLabel}
											fill={getLabelFill({
												labelColor: labels.color,
												seriesColor: colorScale(category),
											})}
											{...labelProps}
										>
											{labelContent}
										</AnimatedLabel>
									);
								});
							})}
						{/* Stacked-area point markers are rendered inside each stack's
					    AnimatedLinePath (above) so they glide with their boundary
					    line on data changes (Option A). */}
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
							{dataRender.categories.map((category: string, categoryIndex: number) => {
								const filteredData = flattenedData.filter(
									(d: FlatData) => d[category] || d[category] !== ''
								);
								return filteredData?.map((d: FlatData, j: number) => {
									const customLabelText = getCustomLabelText(d, category);
									const customLabel = customLabelText || getCustomLabel(d, category);

									// Calculate stacked Y position (sum of all previous categories + current)
									const ySum = dataRender.categories
										.slice(0, categoryIndex + 1)
										.reduce((acc, curr) => {
											return Number(acc) + Number(d[curr]);
										}, 0);

									// Generate default label
									const defaultLabel = getLabelFormat(d[category], category, labels, null);

									// Determine label content
									let labelContent = '';
									if (customLabel) {
										labelContent = customLabel;
									} else if (
										labels.showFirstLastPointsOnly &&
										(j === 0 || j === filteredData.length - 1)
									) {
										labelContent = defaultLabel;
									} else if (!labels.showFirstLastPointsOnly) {
										labelContent = defaultLabel;
									}

									// Don't render if no content
									if (!labelContent) return null;

									return (
										<DraggableLabel
											key={`draggable-stacked-area-label-${categoryIndex}-${j}`}
											x={independentScale(getIndependentValue(d))}
											y={dependentScale(ySum)}
											dataPoint={d}
											category={category}
											defaultDx={labels.labelPositionDX}
											defaultDy={labels.labelPositionDY}
											chartInnerWidth={innerWidth}
											chartInnerHeight={innerHeight}
											defaultLabel={defaultLabel}
											fill={getLabelFill({
												labelColor: labels.color,
												seriesColor: colorScale(category),
											})}
											{...labelProps}
										>
											{labelContent}
										</DraggableLabel>
									);
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

export default StackedArea;

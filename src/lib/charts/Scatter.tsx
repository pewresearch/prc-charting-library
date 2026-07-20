import { useCallback, useContext, useMemo, useRef, RefObject, useState, CSSProperties } from 'react';

import {
	DataContext,
	scaleAxisNumTicks,
	useSize,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	isLabelVisible,
	getChartDimensions,
	getLabelFormat,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	newDateByFormat,
	getLabelFill,
	useRegressionLine,
	useRegressionLines,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
} from '@prc/charting-utilities';
import {
	StyledTooltip,
	StyledLegend,
	AnnotationsLayer,
	DrawingsLayer,
	ClickableTicks,
	ClickableLegend,
} from '../overlays';
import { AnimatedCircle, AnimatedLinePath, AnimatedLabel, TransitionProvider } from '../animation';
import { DraggableLabel } from '../labels';
import {
	buildScatterLabelId,
	buildScatterLabelInputs,
	getDeclutterOffset,
	LeaderLineProvider,
	LeaderLineUnderlay,
	useLabelDeclutter,
} from '../labels';
import type { FlatData, Size, BaseConfig, TableData } from '@prc/charting-utilities';

import { Circle } from '@visx/shape';
import { Group } from '@visx/group';
import styled from '@emotion/styled';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleTime, scaleLinear, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import { max, extent } from 'd3-array';
import { LegendOrdinal } from '@visx/legend';

// Standalone scatter points (PRC-17 slice 3g). Tooltip halos stay static visx
// `<Circle>` — they track the cursor, not the data.
const StyledAnimatedCircle = styled(AnimatedCircle)`
	&:focus {
		outline: none;
	}
`;

const Scatter = () => {
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
		layout,
		colors,
		nodes,
		dataRender,
		tooltip,
		labels,
		shapes,
		legend,
		voronoi: voronoiConfig,
		regression: regressionConfig,
		annotations,
		drawings,
	} = config;

	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>) as Size;
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

	// to render the voronoi, we need to flatten the data further,
	// assigning each point its own polygon, also filtering out null, udnefined, empty values
	const voronoiData = useMemo(
		() =>
			flattenedData
				.map((d: FlatData) =>
					// eslint-disable-next-line array-callback-return
					dataRender.categories.map((c: string) => {
						if (d[c]) {
							const { body: _sctTip, header: _sctHdr } = getCustomTooltip(d, c);
							return {
								x: d.x,
								y: d[c],
								category: c,
								colorGroup: dataRender.groupBreaksCategory
									? d[dataRender.groupBreaksCategory]
									: undefined,
								label: d.__labels?.[c] ? d.__labels[c] : '',
								tooltip: _sctTip,
								tooltipHeader: _sctHdr,
							};
						}
					})
				)
				.flat()
				.filter(Boolean),
		[dataRender, flattenedData]
	);

	// Combined (single) regression — used when perGroupBreak is false.
	const { regressionData } = useRegressionLine(voronoiData, regressionConfig);
	// Per-group regression — splits by colorGroup when groupBreaksCategory is set (long/tagged
	// data format, e.g. a "Region" column), otherwise splits by category (wide format).
	const regressionGroupByKey = dataRender.groupBreaksActive ? 'colorGroup' : 'category';
	const { regressionDataByCategory } = useRegressionLines(voronoiData, regressionConfig, regressionGroupByKey);
	// Convenience alias — perGroupBreak is the user-facing name for this mode.
	const perGroupBreak = regressionConfig.perGroupBreak;

	// Tracks which regression line is hovered in editor mode (key = category or 'combined').
	const [hoveredRegressionKey, setHoveredRegressionKey] = useState<string | null>(null);

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

	const getDependentValue = useCallback((d: FlatData) => d[dataRender.y] as number, [dataRender.y]);

	// SCALES, VORONOI
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
	// When groupBreaksCategory is set, unique values of that column drive color grouping.
	// This works for point-based charts (scatter, bee-swarm, bubble) where there are no
	// visual break lines — color is the sole grouping cue.
	const groupColorDomain = useMemo(() => {
		if (!dataRender.groupBreaksCategory) return [];
		const values = new Set<string>();
		flattenedData.forEach((d: FlatData) => {
			const v = d[dataRender.groupBreaksCategory!];
			if (v !== null && v !== undefined && v !== '') values.add(String(v));
		});
		return Array.from(values).sort();
	}, [dataRender.groupBreaksCategory, flattenedData]);

	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: groupColorDomain.length > 0 ? groupColorDomain : dataRender.categories,
				range: colors,
			}),
		[groupColorDomain, dataRender.categories, colors]
	);

	// Pre-compute legend domain to avoid nested ternary in JSX.
	// When groupBreaksCategory is active, prefer a user-saved custom order in
	// legend.categories (same items, different order) over the raw derived domain.
	const legendDomain = useMemo(() => {
		if (dataRender.groupBreaksCategory) {
			// If the user has saved a custom legend order that matches the current
			// group values (same set, possibly different order), honour it.
			if (legend.categories.length > 0 && legend.categories.length === groupColorDomain.length) {
				const sortedSaved = [...legend.categories].sort();
				const sortedDerived = [...groupColorDomain].sort();
				if (JSON.stringify(sortedSaved) === JSON.stringify(sortedDerived)) {
					return legend.categories;
				}
			}
			return groupColorDomain;
		}
		if (legend.categories.length > 0) return legend.categories;
		return colorScale.domain();
	}, [dataRender.groupBreaksCategory, groupColorDomain, legend.categories, colorScale]);

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
				chartType: 'scatter plot chart',
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
	const scatterLabelDeclutterInputs = useMemo(() => {
		if (!labels.active || !labels.autoDeclutter) {
			return [];
		}
		return buildScatterLabelInputs({
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

	const scatterLabelOffsets = useLabelDeclutter(
		scatterLabelDeclutterInputs,
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

	let tooltipTimeout: number = 0;
	const handleMouseMove = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (tooltipTimeout) clearTimeout(tooltipTimeout);
			if (!svgRef.current) return;

			// find the nearest polygon to the current mouse position
			const point = getLocalPoint(svgRef.current, event);
			if (!point) return;

			// Store SVG-relative cursor position for tooltip positioning
			setCursorPosition({ x: point.x, y: point.y });

			// Use a max search radius to avoid showing tooltips when cursor is
			// far from any data point.
			const maxSearchRadius = Math.max(innerWidth, innerHeight) * 0.15;
			const closest = voronoiLayout.find(point.x - padding.left, point.y - padding.top, maxSearchRadius);
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
		]
	);
	const handleMouseLeave = useCallback(() => {
		// eslint-disable-next-line react-hooks/exhaustive-deps
		tooltipTimeout = window.setTimeout(() => {
			hideTooltip();
		}, 300);
	}, [hideTooltip]);

	return (
		<TransitionProvider data={data} family="circle">
			<div
				style={{
					position: 'relative',
					overflow: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={chartWidth}
					height={height}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<LeaderLineProvider>
						<Group
							top={padding.top}
							left={padding.left}
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
							role="presentation"
						>
							{/* Invisible rect to capture mouse events across the entire chart area */}
							<rect
								width={innerWidth}
								height={innerHeight}
								fill="transparent"
								style={{ pointerEvents: 'all' }}
							/>
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

							{/* iterate over each category and render a series of nodes for each */}
							{dataRender.categories.map((category: string, i: number) => {
								// it's not guaranteed that all categories have the same number of data points
								// so we need to filter out any data points that don't have a value for the current category
								const filteredData = flattenedData.filter(
									(d: FlatData) => d[category] || d[category] !== ''
								);
								return (
									<g key={`scatter-category-${i}`}>
										{filteredData?.map((d: FlatData, j: number) => {
											// Get custom shape styles (group-aware key)
											const groupValue = getGroupValue(d, dataRender);
											const shapeKey = generateElementKey(d.x, category, groupValue);
											// When groupBreaksCategory is set, color is driven by the
											// grouping column — skip stale per-point custom styles.
											const customShapeStyles = dataRender.groupBreaksCategory
												? {}
												: shapes?.customStyles?.[shapeKey] || {};
											const categoryKey = dataRender.groupBreaksCategory
												? String(d[dataRender.groupBreaksCategory] ?? '')
												: category;
											const fallbackColor = dataRender.groupBreaksCategory
												? colorScale(categoryKey)
												: colors[i];
											const defaultColor = resolveCategoryColor({
												category: categoryKey,
												fallback: fallbackColor,
												dataRender,
											});
											const categoryOpacity = resolveCategoryOpacity({
												category: categoryKey,
												dataRender,
											});

											// Apply custom styles with fallbacks
											const shapeFill = customShapeStyles.fill || defaultColor;
											const shapeStroke = customShapeStyles.stroke || defaultColor;
											const shapeStrokeWidth =
												customShapeStyles.strokeWidth ?? nodes.pointStrokeWidth;
											const markOpacity = (customShapeStyles.opacity ?? 1) * categoryOpacity;

											return (
												<StyledAnimatedCircle
													key={`scatter-category-${i}-node-${j}`}
													tabIndex={0}
													r={nodes.pointSize}
													cx={independentScale(getIndependentValue(d)) ?? 0}
													cy={dependentScale(d[category]) ?? 0}
													stroke={shapeStroke}
													strokeWidth={shapeStrokeWidth}
													opacity={markOpacity}
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
													strokeOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														(dataRender.groupBreaksCategory
															? tooltipData.colorGroup !==
																d[dataRender.groupBreaksCategory]
															: tooltipData.category !== category)
															? tooltip.deemphasizeOpacity
															: 1
													}
													fill={shapeFill}
													fillOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														(dataRender.groupBreaksCategory
															? tooltipData.colorGroup !==
																d[dataRender.groupBreaksCategory]
															: tooltipData.category !== category)
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
														const { body: _sfTip, header: _sfHdr } = getCustomTooltip(
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
																colorGroup: dataRender.groupBreaksCategory
																	? d[dataRender.groupBreaksCategory]
																	: undefined,
																color: resolveCategoryColor({
																	category: categoryKey,
																	fallback: fallbackColor,
																	dataRender,
																}),
																tooltip: _sfTip,
																tooltipHeader: _sfHdr,
															},
														});
													}}
												/>
											);
										})}
										{labels.active &&
											!wpEditorFunctions?.labels &&
											filteredData?.map((d: FlatData, j: number) => {
												// Check visibility - don't render if hidden
												if (!isLabelVisible(d, category)) {
													return null;
												}

												// Check for custom label text (from popover customization)
												const customLabelText = getCustomLabelText(d, category);
												// Legacy custom label support
												const customLabel = customLabelText || getCustomLabel(d, category);

												// Generate default label
												const defaultLabel = getLabelFormat(
													d[category],
													category,
													labels,
													null
												);

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

												const labelCategoryKey = dataRender.groupBreaksCategory
													? String(d[dataRender.groupBreaksCategory] ?? '')
													: category;
												const labelFallbackColor = dataRender.groupBreaksCategory
													? colorScale(labelCategoryKey)
													: colors[i];
												const pointColorForLabel = resolveCategoryColor({
													category: labelCategoryKey,
													fallback: labelFallbackColor,
													dataRender,
												});
												const inlineLabelFill = getLabelFill({
													labelColor: labels.color,
													seriesColor: pointColorForLabel,
												});

												const anchorX = independentScale(getIndependentValue(d));
												const anchorY = dependentScale(d[category]);
												const labelId = buildScatterLabelId(i, category, d, j);
												const { dx, dy } = getDeclutterOffset(
													scatterLabelOffsets,
													labelId,
													labels.labelPositionDX,
													labels.labelPositionDY
												);

												return (
													<AnimatedLabel
														key={`scatter-label-${i}-${j}`}
														x={anchorX}
														y={anchorY}
														dataPoint={d}
														category={category}
														defaultDx={dx}
														defaultDy={dy}
														chartInnerWidth={innerWidth}
														chartInnerHeight={innerHeight}
														defaultLabel={defaultLabel}
														fill={inlineLabelFill}
														labelId={labelId}
														leaderLine={
															labels.autoDeclutter && labels.declutterLeaderLines
																? { enabled: true, anchorRadius: nodes.pointSize }
																: undefined
														}
														{...labelProps}
													>
														{labelContent}
													</AnimatedLabel>
												);
											})}
									</g>
								);
							})}

							{/* Regression lines — rendered outside the category loop to avoid duplication */}
							{regressionConfig.active &&
								(() => {
									const regressionX = (d: any) =>
										independentScale(independentAxis.scale === 'time' ? new Date(d[0]) : d[0]);
									const regressionY = (d: any) => dependentScale(d[1]);

									if (perGroupBreak) {
										// When groupBreaksCategory is active the groups are the unique values
										// of that column (e.g. "Democrats", "Republicans"). Otherwise the groups
										// are the category column names (e.g. "y1", "y2").
										const groupKeys = Object.keys(regressionDataByCategory);
										return (
											<>
												{groupKeys.map((groupKey: string) => {
													const catData = regressionDataByCategory[groupKey];
													if (!catData || catData.length < 2) return null;

													// Resolve default color: use colorScale for group-break mode
													// (where groupKey is a group value), or colors[i] for
													// category-column mode.
													const regressionFallback = dataRender.groupBreaksCategory
														? colorScale(groupKey)
														: colors[dataRender.categories.indexOf(groupKey)];
													const defaultColor = resolveCategoryColor({
														category: groupKey,
														fallback: regressionFallback ?? colors[0],
														dataRender,
													});

													const catStyles =
														regressionConfig.groupBreakStyles?.[groupKey] || {};
													const stroke = catStyles.stroke || defaultColor;
													const strokeWidth =
														catStyles.strokeWidth ?? regressionConfig.strokeWidth;
													const strokeDasharray =
														catStyles.strokeDasharray ?? regressionConfig.strokeDasharray;
													const isHovered =
														wpEditorFunctions?.regression &&
														hoveredRegressionKey === groupKey;

													const points = catData.map(
														(d: any) => `${regressionX(d)},${regressionY(d)}`
													);
													const pathD = `M ${points.join(' L ')}`;

													return (
														<g
															key={`regression-${groupKey}`}
															className="regression-line-group"
														>
															{wpEditorFunctions?.regression && (
																<path
																	d={pathD}
																	stroke="transparent"
																	strokeWidth={16}
																	fill="none"
																	style={{
																		cursor: 'pointer',
																		pointerEvents: 'all',
																	}}
																	onMouseEnter={() =>
																		setHoveredRegressionKey(groupKey)
																	}
																	onMouseLeave={() => setHoveredRegressionKey(null)}
																	onClick={(event: React.MouseEvent) => {
																		wpEditorFunctions.regression.onClick(
																			groupKey,
																			stroke,
																			event.currentTarget
																		);
																	}}
																/>
															)}
															<AnimatedLinePath
																className="regression-line"
																points={catData.map((d: any) => ({
																	x: regressionX(d),
																	y: regressionY(d),
																}))}
																stroke={isHovered ? '#007cba' : stroke}
																strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
																strokeDasharray={strokeDasharray}
																style={{
																	pointerEvents: 'none',
																	transition: wpEditorFunctions?.regression
																		? 'stroke 0.15s ease, stroke-width 0.15s ease'
																		: undefined,
																}}
															/>
														</g>
													);
												})}
											</>
										);
									}

									// Combined mode — single regression line across all data.
									const catStyles = regressionConfig.groupBreakStyles?.combined || {};
									const stroke = catStyles.stroke || regressionConfig.stroke;
									const strokeWidth = catStyles.strokeWidth ?? regressionConfig.strokeWidth;
									const strokeDasharray =
										catStyles.strokeDasharray ?? regressionConfig.strokeDasharray;
									const isHovered =
										wpEditorFunctions?.regression && hoveredRegressionKey === 'combined';

									const points = regressionData.map(
										(d: any) => `${regressionX(d)},${regressionY(d)}`
									);
									const pathD = `M ${points.join(' L ')}`;

									return (
										<g className="regression-line-group">
											{wpEditorFunctions?.regression && (
												<path
													d={pathD}
													stroke="transparent"
													strokeWidth={16}
													fill="none"
													style={{
														cursor: 'pointer',
														pointerEvents: 'all',
													}}
													onMouseEnter={() => setHoveredRegressionKey('combined')}
													onMouseLeave={() => setHoveredRegressionKey(null)}
													onClick={(event: React.MouseEvent) => {
														wpEditorFunctions.regression.onClick(
															'combined',
															stroke,
															event.currentTarget
														);
													}}
												/>
											)}
											<AnimatedLinePath
												className="regression-line"
												points={regressionData.map((d: any) => ({
													x: regressionX(d),
													y: regressionY(d),
												}))}
												stroke={isHovered ? '#007cba' : stroke}
												strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
												strokeDasharray={strokeDasharray}
												style={{
													pointerEvents: 'none',
													transition: wpEditorFunctions?.regression
														? 'stroke 0.15s ease, stroke-width 0.15s ease'
														: undefined,
												}}
											/>
										</g>
									);
								})()}

							{tooltipData && tooltipVisible && (
								<g>
									<Circle
										cx={tooltipLeft}
										cy={tooltipTop + 1}
										r={nodes.pointSize + 2}
										fill={'transparent'}
										fillOpacity={0.1}
										stroke="black"
										strokeOpacity={0.1}
										strokeWidth={2}
										pointerEvents="none"
									/>
									<Circle
										cx={tooltipLeft}
										cy={tooltipTop}
										r={nodes.pointSize + 1}
										fill={'transparent'}
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
								{dataRender.categories.map((category: string, i: number) => {
									const filteredData = flattenedData.filter(
										(d: FlatData) => d[category] || d[category] !== ''
									);
									return filteredData?.map((d: FlatData, j: number) => {
										// Check for custom label text (from popover customization)
										const customLabelText = getCustomLabelText(d, category);
										// Legacy custom label support
										const customLabel = customLabelText || getCustomLabel(d, category);

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

										const pointColor = resolveCategoryColor({
											category: dataRender.groupBreaksCategory
												? String(d[dataRender.groupBreaksCategory] ?? '')
												: category,
											fallback: dataRender.groupBreaksCategory
												? colorScale(String(d[dataRender.groupBreaksCategory] ?? ''))
												: colors[i],
											dataRender,
										});
										const draggableLabelFill = getLabelFill({
											labelColor: labels.color,
											seriesColor: pointColor,
										});

										const editorAnchorX = independentScale(getIndependentValue(d));
										const editorAnchorY = dependentScale(d[category]);
										const editorLabelId = buildScatterLabelId(i, category, d, j);
										const { dx: editorDx, dy: editorDy } = getDeclutterOffset(
											scatterLabelOffsets,
											editorLabelId,
											labels.labelPositionDX,
											labels.labelPositionDY
										);

										return (
											<DraggableLabel
												key={`draggable-scatter-label-${i}-${j}`}
												x={editorAnchorX}
												y={editorAnchorY}
												dataPoint={d}
												category={category}
												defaultDx={editorDx}
												defaultDy={editorDy}
												chartInnerWidth={innerWidth}
												chartInnerHeight={innerHeight}
												defaultLabel={defaultLabel}
												fill={draggableLabelFill}
												labelId={editorLabelId}
												leaderLine={
													labels.autoDeclutter && labels.declutterLeaderLines
														? { enabled: true, anchorRadius: nodes.pointSize }
														: undefined
												}
												{...labelProps}
											>
												{labelContent}
											</DraggableLabel>
										);
									});
								})}
							</Group>
						)}
					</LeaderLineProvider>
				</svg>
				{legend.active && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
						<LegendOrdinal {...legendProps} scale={colorScale} domain={legendDomain}>
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
													category: dataRender.groupBreaksCategory
														? String(tooltipData.colorGroup ?? '')
														: tooltipData.category || '',
													fallback: dataRender.groupBreaksCategory
														? colorScale(tooltipData.colorGroup ?? '')
														: colorScale(tooltipData.category || ''),
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

export default Scatter;

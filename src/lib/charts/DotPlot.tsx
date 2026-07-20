// TODO: add labels, add option to connect nodes
// INTERNAL
import {
	DataContext,
	generateElementKey,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getGroupedData,
	getGroupPositioningHorizontal,
	getGroupValue,
	getLabelFormat,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
	useSize,
} from '@prc/charting-utilities';
import { DiffColumn } from './DiffColumn';
import {
	AnnotationsLayer,
	DrawingsLayer,
	BreakLine,
	ClickableLegend,
	ClickableTicks,
	StyledLegend,
	StyledTooltip,
} from '../overlays';
import { AnimatedCircle, AnimatedLinePath, AnimatedLabel, TransitionProvider, useAnimationConfig } from '../animation';
import { DraggableLabel } from '../labels';
import {
	buildAllDotPlotLabelInputs,
	buildDotPlotLabelId,
	getDeclutterOffset,
	LeaderLineProvider,
	LeaderLineUnderlay,
	useLabelDeclutter,
} from '../labels';

// TYPES
import type { BaseConfig, FlatData, GroupedData, Size, TableData } from '@prc/charting-utilities';

// REACT
import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

// VISX
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleLinear, scaleOrdinal, scalePoint } from '@visx/scale';
import { Circle, Line } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
// import { dotPlotConfig, dotPlotData } from '../presets/dotPlotErrors'
// OTHER LIBRARIES
import styled from '@emotion/styled';
import { max, min } from 'd3-array';

const md5Hash = require('md5-hash');

// Standalone dots (PRC-17 slice 3g). Tooltip halos stay static visx `<Circle>`.
const StyledAnimatedCircle = styled(AnimatedCircle)`
	&:focus {
		outline: none;
	}
`;

const DotPlot = () => {
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
		dotPlot,
		labels: labelConfig,
		shapes,
		legend,
		diffColumn,
		errorBars: errorBarsConfig,
		annotations,
		drawings,
		voronoi: voronoiConfig,
	} = config;

	// Connector lines are a "follow" (secondary) element: they wait for the
	// dots (the primary `circle` entrance) to finish popping in, then draw on.
	// The circle family's resolved follow timing supplies the absolute wait —
	// the sequencing math lives in the hook, not here.
	const { initial: dotEntrance } = useAnimationConfig('circle');
	const connectorEntranceDelay = dotEntrance.follow.enabled ? dotEntrance.follow.delay : 0;
	const connectorEntranceDuration = dotEntrance.follow.duration;

	// SIZE AND LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout, diffColumn);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	// DATA PROCESSING
	const flattenedData = getFlattenedData(data);

	// GROUP BREAKS PROCESSING
	const groupedData: GroupedData[] = useMemo(
		() => getGroupedData(flattenedData, dataRender),
		[flattenedData, dataRender]
	);

	// get all unique categories
	const categories = dataRender.categories;

	// DATA ACCESSORS

	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x], [dataRender.x]);
	const getDependentValue = (d: FlatData) => d.y;

	// SCALES
	const independentScale = useMemo(() => {
		const allValues = groupedData.flatMap(({ data }) => data.map(getIndependentValue));
		return scalePoint<string>({
			domain: allValues,
			range: [0, innerHeight],
			padding: 0.5,
		});
	}, [groupedData, getIndependentValue, innerHeight]);

	// GROUP POSITIONING - Calculate actualContentHeight
	const { groupPositioning, actualContentHeight } = useMemo(
		() => getGroupPositioningHorizontal(groupedData, dataRender, independentScale, innerHeight),
		[groupedData, dataRender, independentScale, innerHeight]
	);

	const chartHeight = useMemo(() => {
		return dataRender.groupBreaksActive ? actualContentHeight + padding.top + padding.bottom : height;
	}, [actualContentHeight, padding.top, padding.bottom, height]);

	const dependentScale = useMemo(
		() =>
			scaleLinear({
				// domain: [0, max(flattenedData, getDependentValue) || 0],
				domain: dependentAxis.domain,
				range: [0, innerWidth],
				nice: true,
			}),
		[innerWidth, dependentAxis.domain]
	);
	const colorScale = scaleOrdinal<string, string>({
		domain: categories as string[],
		range: colors,
	});

	dependentScale.rangeRound([0, innerWidth]);
	independentScale.rangeRound([innerHeight, 0]);

	// GET SHARED LAYOUT PROPS
	// For shared props, we use the first group's data (or flattened if no grouping)
	const sharedPropsData = groupedData.length > 0 ? groupedData[0].data : [];
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
		ariaProps,
		legendProps,
		tooltipVisible,
		annotationsVisible,
		labelProps,
		voronoiProps,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'dot plot chart',
				config,
				data: sharedPropsData,
				size,
				tableData,
				dependentScale,
				independentScale,
				actualContentHeight,
				independentTicksComponent,
				dependentTicksComponent,
			}),
		[
			config,
			sharedPropsData,
			size,
			tableData,
			dependentScale,
			independentScale,
			actualContentHeight,
			independentTicksComponent,
			dependentTicksComponent,
		]
	);

	// One voronoi site per (row × category) with pixel coords matching each group's groupScale
	type DotPlotVoronoiDatum = FlatData & {
		category: string;
		tooltip: string;
		cx: number;
		cy: number;
	};

	const dotPlotLabelDeclutterInputs = useMemo(() => {
		if (!labelConfig.active || !labelConfig.autoDeclutter) {
			return [];
		}
		return buildAllDotPlotLabelInputs({
			groupPositioning,
			categories,
			labels: labelConfig,
			labelProps,
			dependentScale,
			getIndependentValue,
		});
	}, [labelConfig, groupPositioning, categories, labelProps, dependentScale, getIndependentValue]);

	const dotPlotLabelOffsets = useLabelDeclutter(
		dotPlotLabelDeclutterInputs,
		{
			padding: labelConfig.declutterPadding ?? 4,
			// DotPlot is a horizontal chart: labels should only spread along the
			// value axis (x). lockY prevents cross-row vertical collision from
			// pushing labels off their rows, and locks each label's y to its row.
			lockY: true,
			iterations: 160,
			anchorStrengthX: 0.5,
			innerWidth,
			// Use actualContentHeight, not innerHeight: DotPlot can render taller
			// than layout.height when groupBreaksActive, and the wrong bound causes
			// clamping to misfire for lower groups.
			innerHeight: actualContentHeight,
		},
		!!(labelConfig.active && labelConfig.autoDeclutter)
	);

	// TOOLTIP AND HANDLERS
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<DotPlotVoronoiDatum>();
	const tooltipTimeoutRef = useRef<number | undefined>(undefined);

	const voronoiData = useMemo(() => {
		const points: DotPlotVoronoiDatum[] = [];
		groupPositioning.forEach((groupPos) => {
			const { data: groupRowData, startY, height: groupBandHeight } = groupPos;
			const groupScale = scalePoint<string>({
				domain: groupRowData.map(getIndependentValue),
				range: [startY, startY + groupBandHeight],
				padding: 0.5,
			});
			categories.forEach((category: string) => {
				const filteredData = groupRowData.filter((d: FlatData) => d[category] || d[category] !== '');
				filteredData.forEach((d: FlatData) => {
					const val = d[category];
					if (val === null || val === undefined || val === '') return;
					const cx = dependentScale(val as number);
					const cy = groupScale(getIndependentValue(d)) || 0;
					const { body: resolvedTip, header: resolvedHdr } = getCustomTooltip(d, category);

					points.push({
						...d,
						y: val as number,
						category,
						tooltip: resolvedTip,
						tooltipHeader: resolvedHdr,
						cx,
						cy,
					});
				});
			});
		});
		return points;
	}, [groupPositioning, categories, dependentScale, getIndependentValue]);

	const voronoiPlotHeight = actualContentHeight;

	const voronoiLayout = useMemo(() => {
		if (voronoiData.length === 0) return null;
		return voronoi<DotPlotVoronoiDatum>({
			x: (d) => d.cx,
			y: (d) => d.cy,
			width: innerWidth,
			height: voronoiPlotHeight,
		})(voronoiData);
	}, [voronoiData, innerWidth, voronoiPlotHeight]);

	const handleMouseMove = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (tooltipTimeoutRef.current) {
				clearTimeout(tooltipTimeoutRef.current);
				tooltipTimeoutRef.current = undefined;
			}
			if (!svgRef.current || !voronoiLayout) return;

			const point = getLocalPoint(svgRef.current, event);
			if (!point) return;

			const maxSearchRadius = Math.max(innerWidth, voronoiPlotHeight) * 0.15;
			const closest = voronoiLayout.find(point.x - padding.left, point.y - padding.top, maxSearchRadius);
			if (closest) {
				showTooltip({
					tooltipLeft: closest.data.cx,
					tooltipTop: closest.data.cy,
					tooltipData: closest.data,
				});
			} else {
				hideTooltip();
			}
		},
		[voronoiLayout, innerWidth, voronoiPlotHeight, padding.left, padding.top, showTooltip, hideTooltip]
	);

	const handleMouseLeave = useCallback(() => {
		tooltipTimeoutRef.current = window.setTimeout(() => {
			hideTooltip();
		}, 300);
	}, [hideTooltip]);

	return (
		<TransitionProvider data={data} family="circle">
			<div style={{ position: 'relative', overflow: overflow as CSSProperties['overflowX'] }}>
				<svg
					width={chartWidth}
					height={chartHeight}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<LeaderLineProvider>
						<Group
							top={padding.top}
							left={padding.left}
							role="presentation"
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
						>
							<rect
								width={innerWidth}
								height={actualContentHeight}
								fill="transparent"
								style={{ pointerEvents: 'all' }}
							/>
							{voronoiConfig.active &&
								voronoiLayout &&
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
							{/* Render order: grid > axes > chart plot */}

							{/* 1. Grid columns */}
							<GridColumns {...dependentGridProps} />

							{/* 2. Grid rows for each group */}
							{groupPositioning.map((groupPos, groupIndex) => {
								const { group, data, startY, height } = groupPos;

								const gridScale = scalePoint<string>({
									domain: data.map(getIndependentValue),
									range: [0, height],
									padding: 0.5,
								});

								return (
									<Group key={`grid-rows-${groupIndex}-${group}`} top={startY}>
										<GridRows
											scale={gridScale}
											width={innerWidth}
											stroke={independentGridProps.stroke}
											strokeWidth={independentGridProps.strokeWidth}
											strokeOpacity={independentGridProps.strokeOpacity}
											strokeDasharray={independentGridProps.strokeDasharray}
											numTicks={data.length}
										/>
									</Group>
								);
							})}

							{/* 3. Axes */}
							{independentAxis.active && (
								<>
									{groupPositioning.map((groupPos, groupIndex) => {
										const { data, startY, height } = groupPos;

										const groupScale = scalePoint<string>({
											domain: data.map(getIndependentValue),
											range: [startY, startY + height],
											padding: 0.5,
										});

										return (
											<AxisLeft
												key={`axis-${groupIndex}`}
												{...independentAxisProps}
												tickValues={data.map(getIndependentValue)}
												numTicks={data.length}
												scale={groupScale}
											/>
										);
									})}
								</>
							)}
							{dependentAxis.active && <AxisBottom {...dependentAxisProps} top={actualContentHeight} />}

							{(labelConfig.autoDeclutter && labelConfig.declutterLeaderLines) ||
							(labelConfig.active && wpEditorFunctions?.labels) ? (
								<LeaderLineUnderlay />
							) : null}

							{/* 4. Chart plot elements */}
							{groupPositioning.map((groupPos, groupIndex) => {
								const { group, data, startY, height, breakHeight } = groupPos;

								const groupScale = scalePoint<string>({
									domain: data.map(getIndependentValue),
									range: [startY, startY + height],
									padding: 0.5,
								});

								return (
									<Group key={`group-${groupIndex}-${group}`}>
										<Group>
											{/* Render connecting lines if enabled */}
											{dotPlot.connectPoints && (
												<g>
													{data?.map((d: FlatData, i: number) => {
														const values: number[] = categories.map(
															(category: string) => d[category]
														);
														const minVal = min(values) as number;
														const maxVal = max(values) as number;

														// check that minVal and maxVal are not empty, then create connecting line
														if (minVal != null && maxVal != null) {
															const rowY = groupScale(d[dataRender.x]) ?? 0;
															return (
																<AnimatedLinePath
																	key={`dot-plot-connector-${groupIndex}-${i}`}
																	points={[
																		{
																			x: dependentScale(minVal) ?? 0,
																			y: rowY,
																		},
																		{
																			x: dependentScale(maxVal) ?? 0,
																			y: rowY,
																		},
																	]}
																	stroke={dotPlot.connectingLine.stroke}
																	strokeWidth={dotPlot.connectingLine.strokeWidth}
																	strokeDasharray={
																		dotPlot.connectingLine.strokeDasharray
																	}
																	entranceDelay={connectorEntranceDelay}
																	entranceDuration={connectorEntranceDuration}
																/>
															);
														}
													})}
												</g>
											)}

											{/* Render dots for each category */}
											{categories.map((category: string, i: number) => {
												// it's not guaranteed that all categories have the same number of data points
												// so we need to filter out any data points that don't have a value for the current category
												const filteredData = data.filter(
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

												return (
													<>
														{errorBarsConfig.enabled && (
															<>
																<g
																	key={
																		md5Hash.default(JSON.stringify(filteredData)) +
																		'--error-bars'
																	}
																	className="error-bars"
																>
																	{data?.map((d: FlatData, k: number) => {
																		const errorBar =
																			filteredData[k]?.__errorBars?.[category];
																		const ebMin = errorBar?.min;
																		const ebMax = errorBar?.max;

																		if (ebMin == null || ebMax == null) return null;

																		const groupValue = getGroupValue(d, dataRender);
																		const elementKey = generateElementKey(
																			d.x,
																			category,
																			groupValue
																		);
																		const customStyles =
																			errorBarsConfig.customStyles?.[
																				elementKey
																			] || {};

																		const ebStroke =
																			customStyles.stroke ||
																			errorBar?.stroke ||
																			seriesColor;
																		const ebStrokeWidth =
																			customStyles.strokeWidth ??
																			errorBar?.strokeWidth ??
																			errorBarsConfig.defaultStyles
																				?.strokeWidth ??
																			6;
																		const ebStrokeOpacity =
																			customStyles.strokeOpacity ??
																			errorBar?.strokeOpacity ??
																			errorBarsConfig.defaultStyles
																				?.strokeOpacity ??
																			0.5;
																		const ebStrokeDasharray =
																			customStyles.strokeDasharray ||
																			errorBar?.strokeDasharray ||
																			errorBarsConfig.defaultStyles
																				?.strokeDasharray ||
																			'';

																		return (
																			<Line
																				key={`error-bar-${md5Hash.default(JSON.stringify(d))}-${category}`}
																				from={{
																					x: dependentScale(ebMin),
																					y: groupScale(d[dataRender.x]),
																				}}
																				to={{
																					x: dependentScale(ebMax),
																					y: groupScale(d[dataRender.x]),
																				}}
																				stroke={ebStroke}
																				strokeOpacity={ebStrokeOpacity}
																				strokeWidth={ebStrokeWidth}
																				strokeDasharray={ebStrokeDasharray}
																				strokeLinecap={'round'}
																				strokeLinejoin={'round'}
																				style={{
																					cursor: wpEditorFunctions?.errorBars
																						? 'pointer'
																						: undefined,
																					pointerEvents:
																						wpEditorFunctions?.errorBars
																							? 'all'
																							: undefined,
																				}}
																				onClick={(event: React.MouseEvent) => {
																					if (
																						wpEditorFunctions?.errorBars
																							?.onClick
																					) {
																						wpEditorFunctions.errorBars.onClick(
																							d,
																							category,
																							colors[i],
																							event.currentTarget,
																							groupValue
																						);
																					}
																				}}
																			/>
																		);
																	})}
																</g>
															</>
														)}
														<g key={md5Hash.default(JSON.stringify(category))}>
															{filteredData?.map((d: FlatData, j: number) => {
																const { body: customTooltip, header: tooltipHeader } =
																	getCustomTooltip(d, category);

																// Get custom shape styles (group-aware key)
																const groupValue = getGroupValue(d, dataRender);
																const shapeKey = generateElementKey(
																	d.x,
																	category,
																	groupValue
																);
																const customShapeStyles =
																	shapes?.customStyles?.[shapeKey] || {};
																const defaultColor =
																	nodes.pointFill === 'inherit'
																		? seriesColor
																		: nodes.pointFill;
																const defaultStroke =
																	nodes.pointStroke === 'inherit'
																		? seriesColor
																		: nodes.pointStroke;

																// Apply custom styles with fallbacks
																const shapeFill =
																	customShapeStyles.fill || defaultColor;
																const shapeStroke =
																	customShapeStyles.stroke || defaultStroke;
																const shapeStrokeWidth =
																	customShapeStyles.strokeWidth ??
																	nodes.pointStrokeWidth;
																const shapeOpacity =
																	(customShapeStyles.opacity ?? 1) * seriesOpacity;

																return (
																	<StyledAnimatedCircle
																		key={`dot-plot-node-${groupIndex}-${i}-${j}`}
																		r={nodes.pointSize}
																		tabIndex={0}
																		cy={groupScale(getIndependentValue(d)) || 0}
																		cx={
																			dependentScale(filteredData[j][category]) ??
																			0
																		}
																		stroke={shapeStroke}
																		strokeWidth={shapeStrokeWidth}
																		opacity={shapeOpacity}
																		style={{
																			cursor: wpEditorFunctions?.shapes
																				? 'pointer'
																				: undefined,
																			pointerEvents: wpEditorFunctions?.shapes
																				? 'all'
																				: undefined,
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
																			tooltipData.category !== category
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		fill={shapeFill}
																		fillOpacity={
																			tooltipData &&
																			tooltipVisible &&
																			tooltip.deemphasizeSiblings &&
																			tooltipData.category !== category
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		onBlur={() => {
																			tooltipTimeoutRef.current =
																				window.setTimeout(() => {
																					hideTooltip();
																				}, 300);
																		}}
																		onFocus={() => {
																			if (tooltipTimeoutRef.current) {
																				clearTimeout(tooltipTimeoutRef.current);
																				tooltipTimeoutRef.current = undefined;
																			}
																			const cx = dependentScale(d[category]) || 0;
																			const cy =
																				groupScale(getIndependentValue(d)) || 0;
																			showTooltip({
																				tooltipData: {
																					...d,
																					y: d[category],
																					category,
																					tooltip: customTooltip,
																					tooltipHeader,
																					cx,
																					cy,
																				},
																				tooltipTop: cy,
																				tooltipLeft: cx,
																			});
																		}}
																	/>
																);
															})}
															{labelConfig.active &&
																!wpEditorFunctions?.labels &&
																filteredData?.map((d: FlatData, j: number) => {
																	const customLabelText = getCustomLabelText(
																		filteredData[j],
																		category
																	);
																	const customLabel =
																		customLabelText ||
																		getCustomLabel(filteredData[j], category);

																	const labelContent =
																		customLabel ||
																		`${getLabelFormat(
																			d[category],
																			category,
																			labelConfig,
																			null
																		)}`;

																	// Don't render if no content
																	if (!labelContent) return null;

																	const dpAnchorX = dependentScale(
																		filteredData[j][category]
																	);
																	const dpAnchorY =
																		(groupScale(getIndependentValue(d)) || 0) - 10;
																	const dpLabelId = buildDotPlotLabelId(
																		groupIndex,
																		i,
																		category,
																		d,
																		j
																	);
																	const { dx: dpDx, dy: dpDy } = getDeclutterOffset(
																		dotPlotLabelOffsets,
																		dpLabelId,
																		0,
																		0
																	);

																	const dpDotY =
																		groupScale(getIndependentValue(d)) || 0;

																	return (
																		<AnimatedLabel
																			key={`dot-plot-label-${groupIndex}-${i}-${j}`}
																			x={dpAnchorX}
																			y={dpAnchorY}
																			dataPoint={d}
																			category={category}
																			defaultDx={dpDx}
																			defaultDy={dpDy}
																			chartInnerWidth={innerWidth}
																			chartInnerHeight={height}
																			fill={
																				labelConfig.color === 'inherit'
																					? seriesColor
																					: labelConfig.color
																			}
																			leaderLine={
																				labelConfig.autoDeclutter &&
																				labelConfig.declutterLeaderLines
																					? {
																							enabled: true,
																							anchorY: dpDotY,
																							anchorRadius:
																								nodes.pointSize,
																						}
																					: undefined
																			}
																			{...labelProps}
																		>
																			{labelContent}
																		</AnimatedLabel>
																	);
																})}
														</g>
													</>
												);
											})}
										</Group>
									</Group>
								);
							})}

							{/* Render diff column to the right of the chart */}
							{diffColumn.active && diffColumn.category && (
								<>
									{groupPositioning.map((groupPos, groupIndex) => {
										const { group, data, startY, height } = groupPos;

										// Create individual scale for this group with relative positioning (0 to height)
										// since the Group is already positioned at startY
										const groupScale = scalePoint<string>({
											domain: data.map(getIndependentValue),
											range: [0, height],
											padding: 0.5,
										});

										return (
											<Group key={`diff-column-${groupIndex}`} top={startY}>
												<DiffColumn
													diffColumn={diffColumn}
													innerHeight={height}
													innerWidth={innerWidth}
													flattenedData={data}
													scale={groupScale}
													dataRender={dataRender}
													labels={labelConfig}
													layout={layout}
													showHeader={groupIndex === 0}
													groupValue={dataRender.groupBreaksActive ? group : null}
												/>
											</Group>
										);
									})}
								</>
							)}

							{/* Render break lines on top - after DiffColumn to appear above background */}
							{groupPositioning.map((groupPos, groupIndex) => {
								if (groupIndex === 0) return null;
								const { startY, breakHeight } = groupPos;

								return (
									<BreakLine
										key={`break-line-${groupIndex}`}
										x1={-padding.left}
										x2={
											diffColumn.active && diffColumn.category
												? innerWidth + diffColumn.style.marginLeft + diffColumn.style.width
												: innerWidth + padding.right
										}
										y1={startY - breakHeight / 2}
										y2={startY - breakHeight / 2}
										variation={dataRender.groupBreaks?.breakStyles?.variation || 'solid'}
										stroke={dataRender.groupBreaks?.breakStyles?.stroke || '#A4A4A4'}
										strokeWidth={dataRender.groupBreaks?.breakStyles?.strokeWidth || 1.4}
										strokeDasharray={dataRender.groupBreaks?.breakStyles?.strokeDasharray || 'none'}
									/>
								);
							})}

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
								height={actualContentHeight}
								layout={layout}
								chartWidth={chartWidth}
							/>
						)}
						{drawings?.active && !wpEditorFunctions && (
							<DrawingsLayer
								config={drawings}
								width={chartWidth}
								height={actualContentHeight}
								layout={layout}
								chartWidth={chartWidth}
							/>
						)}
						{/* Render draggable labels outside main Group to avoid event capture */}
						{labelConfig.active && wpEditorFunctions?.labels && (
							<Group top={padding.top} left={padding.left}>
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data, startY, height } = groupPos;

									const groupScale = scalePoint<string>({
										domain: data.map(getIndependentValue),
										range: [startY, startY + height],
										padding: 0.5,
									});

									return (
										<Group key={`draggable-labels-group-${groupIndex}`}>
											{categories.map((category: string, i: number) => {
												const filteredData = data.filter(
													(d: FlatData) => d[category] || d[category] !== ''
												);
												const seriesColor = resolveCategoryColor({
													category,
													fallback: colors[i],
													dataRender,
												});
												return filteredData?.map((d: FlatData, j: number) => {
													const customLabelText = getCustomLabelText(
														filteredData[j],
														category
													);
													const customLabel =
														customLabelText || getCustomLabel(filteredData[j], category);

													const defaultLabel = getLabelFormat(
														d[category],
														category,
														labelConfig,
														null
													);

													const labelContent = customLabel || defaultLabel;

													const edDpAnchorX = dependentScale(filteredData[j][category]);
													const edDpAnchorY = (groupScale(getIndependentValue(d)) || 0) - 10;
													const edDpLabelId = buildDotPlotLabelId(
														groupIndex,
														i,
														category,
														d,
														j
													);
													const { dx: edDpDx, dy: edDpDy } = getDeclutterOffset(
														dotPlotLabelOffsets,
														edDpLabelId,
														0,
														0
													);

													const edDpDotY = groupScale(getIndependentValue(d)) || 0;

													return (
														<DraggableLabel
															key={`draggable-dot-plot-label-${groupIndex}-${i}-${j}`}
															x={edDpAnchorX}
															y={edDpAnchorY}
															dataPoint={d}
															category={category}
															defaultDx={edDpDx}
															defaultDy={edDpDy}
															chartInnerWidth={innerWidth}
															chartInnerHeight={innerHeight}
															defaultLabel={defaultLabel}
															fill={
																labelConfig.color === 'inherit'
																	? seriesColor
																	: labelConfig.color
															}
															leaderLine={
																labelConfig.autoDeclutter &&
																labelConfig.declutterLeaderLines
																	? {
																			enabled: true,
																			anchorY: edDpDotY,
																			anchorRadius: nodes.pointSize,
																		}
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
									);
								})}
							</Group>
						)}
					</LeaderLineProvider>
				</svg>
				{legend.active && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
						<LegendOrdinal
							{...legendProps}
							scale={colorScale}
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
												y: getDependentValue(tooltipData),
												x: getIndependentValue(tooltipData).toString(),
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

export default DotPlot;

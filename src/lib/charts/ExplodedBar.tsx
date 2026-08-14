import { useCallback, useContext, useMemo, useRef, RefObject, CSSProperties } from 'react';

import { DataContext } from '@prc/charting-utilities';
import {
	useSize,
	getBarLabelFill,
	scaleAxisNumTicks,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
	resolveLabelCutoff,
	getLinearValueDataExtent,
	hasExplicitAxisDomain,
	resolveLinearScaleDomain,
	resolveScaleNice,
} from '@prc/charting-utilities';
import {
	getChartDimensions,
	getLabelFormat,
	positionBarLabel,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	getFlattenedData,
	getGroupedData,
	createGroupBandScale,
	getGroupPositioningHorizontal,
} from '@prc/charting-utilities';
import { DiffColumn } from './DiffColumn';
import {
	AnnotationsLayer,
	DrawingsLayer,
	BreakLine,
	ClickableTicks,
	ClickableLegend,
	StyledTooltip,
	StyledLegend,
} from '../overlays';
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import type { FlatData } from '@prc/charting-utilities';
import type { Size } from '@prc/charting-utilities';
import type { BaseConfig } from '@prc/charting-utilities';
import type { TableData } from '@prc/charting-utilities';
import type { GroupedData } from '@prc/charting-utilities';

import { BarStackHorizontal } from '@visx/shape';
import { Group } from '@visx/group';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleLinear, scaleBand, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { ascending, descending } from 'd3-array';
import { LegendOrdinal } from '@visx/legend';

const ExplodedBar = () => {
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
		dataRender,
		tooltip,
		labels,
		shapes,
		legend,
		explodedBar,
		bar,
		diffColumn,
		annotations,
		drawings,
	} = config;

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	let size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout, diffColumn);
	const labelCutoff = resolveLabelCutoff(labels, size.width, width);
	let isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	let scaledNumTicks = useMemo(
		() => scaleAxisNumTicks(dependentAxis.tickCount || 5, chartWidth, width),
		[dependentAxis.tickCount, chartWidth, width]
	);

	// EXPLODED BAR COLUMN CALCULATIONS
	// Calculate the available width for columns after accounting for gaps between them.
	// Previously, gaps were additive which caused overflow on small screens.
	const numCategories = dataRender.categories.length;
	const totalGapSpace = numCategories > 1 ? explodedBar.columnGap * (numCategories - 1) : 0;
	const availableContentWidth = innerWidth - totalGapSpace;
	const columnWidth = availableContentWidth / numCategories;
	// Reserve 30px per column for axis labels/padding
	const columnContentWidth = Math.max(0, columnWidth - 30);

	// DATA PROCESSING
	const flattenedData = useMemo(() => {
		let processed = getFlattenedData(data);
		processed.sort((a: FlatData, b: FlatData) => {
			if (dataRender.sortOrder === 'ascending') {
				return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			if (dataRender.sortOrder === 'descending') {
				return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			return 0;
		});
		// this feels counterintuitive,
		// but we need to reverse the data because
		// d3 stacks the data from the bottom up.
		processed.reverse();
		return processed;
	}, [data, dataRender.sortOrder, dataRender.sortKey]);

	// DATA ACCESSORS
	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x].toString(), [dataRender.x]);

	// GROUP BREAKS PROCESSING
	const groupedData: GroupedData[] = useMemo(
		() => getGroupedData(flattenedData, dataRender),
		[flattenedData, dataRender]
	);

	// SCALES
	const independentScale = useMemo(() => {
		const allValues = groupedData.flatMap(({ data }) => data.map(getIndependentValue));
		return scaleBand<string>({
			domain: allValues,
			range: [innerHeight, 0],
			padding: bar.barPadding,
		});
	}, [groupedData, getIndependentValue, innerHeight, bar.barPadding]);

	// GROUP POSITIONING - Calculate actualContentHeight
	const { groupPositioning, actualContentHeight } = useMemo(
		() => getGroupPositioningHorizontal(groupedData, dataRender, independentScale, innerHeight),
		[groupedData, dataRender, independentScale, innerHeight]
	);

	const chartHeight = useMemo(() => {
		return dataRender.groupBreaksActive ? actualContentHeight + padding.top + padding.bottom : height;
	}, [dataRender.groupBreaksActive, actualContentHeight, padding, height]);
	const dependentScale = useMemo(
		() =>
			scaleLinear({
				// Null/auto domains fall back to the data extent; visx would
				// otherwise silently keep d3's default [0, 1].
				domain: resolveLinearScaleDomain(
					dependentAxis.domain,
					getLinearValueDataExtent(flattenedData, dataRender.categories)
				),
				range: [0, columnContentWidth],
				nice: resolveScaleNice(dependentAxis.nice, hasExplicitAxisDomain(dependentAxis.domain)),
			}),
		[columnContentWidth, dependentAxis.domain, dependentAxis.nice, flattenedData, dataRender.categories]
	);
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: dataRender.categories,
				range: colors,
			}),
		[dataRender.categories, colors]
	);
	dependentScale.rangeRound([0, columnContentWidth]);
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
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'exploded horizontal bar chart',
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

	// TOOLTIP AND HANDLERS
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();

	let tooltipTimeout: number;

	return (
		<TransitionProvider data={data} family="bar">
			<div style={{ position: 'relative', overflow: overflow as CSSProperties['overflowX'] }}>
				<svg
					width={chartWidth}
					height={chartHeight}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					{dataRender.categories.map((category: string, categoryIndex: number) => {
						return (
							<Group
								role="presentation"
								key={category}
								top={padding.top}
								left={
									// Position each column: left padding + (column index * column width) + (column index * gap)
									// This ensures columns fit within innerWidth without overflow
									padding.left + categoryIndex * columnWidth + categoryIndex * explodedBar.columnGap
								}
							>
								<GridColumns {...dependentGridProps} />

								{/* Render grouped bar charts with breaks */}
								{groupPositioning.map((groupPos, groupIndex) => {
									const { group, data, startY, height } = groupPos;

									// Create scales for this group:
									const groupScale = createGroupBandScale(
										data.map(getIndependentValue),
										[startY + height, startY],
										bar.barPadding
									);

									const gridScale = createGroupBandScale(
										data.map(getIndependentValue),
										[height, 0],
										bar.barPadding
									);

									return (
										<Group key={`group-${groupIndex}-${group}-${category}`}>
											{/* Render grid rows for this group */}
											<Group top={startY}>
												<GridRows
													scale={gridScale}
													width={columnContentWidth}
													stroke={independentGridProps.stroke}
													strokeWidth={independentGridProps.strokeWidth}
													strokeOpacity={independentGridProps.strokeOpacity}
													strokeDasharray={independentGridProps.strokeDasharray}
													numTicks={data.length}
												/>
											</Group>

											<BarStackHorizontal
												data={data}
												keys={[category]}
												height={height}
												y={getIndependentValue}
												xScale={dependentScale}
												yScale={groupScale}
												color={colorScale}
											>
												{(barStacks) => {
													return barStacks.map((barStack) =>
														barStack.bars.map((bar, i) => {
															const barCategory = bar.key as string;
															const barData = bar.bar['data'];
															const barValue =
																barData[barCategory as keyof typeof barData];
															// check if there are custom labels or tooltips in the data model
															const customLabelText = getCustomLabelText(
																data[i],
																bar.key
															);
															const customLabel =
																customLabelText || getCustomLabel(data[i], bar.key);
															const { body: customTooltip, header: customHeader } =
																getCustomTooltip(data[i], bar.key);

															// Get custom shape styles (group-aware key)
															const groupValue = getGroupValue(barData, dataRender);
															const shapeKey = generateElementKey(
																barData.x,
																barCategory,
																groupValue
															);
															const customShapeStyles =
																shapes?.customStyles?.[shapeKey] || {};
															const defaultColor = resolveCategoryColor({
																category: barCategory,
																fallback: bar.color,
																dataRender,
															});
															const categoryOpacity = resolveCategoryOpacity({
																category: barCategory,
																dataRender,
															});

															// Apply custom styles with fallbacks
															const shapeFill = customShapeStyles.fill || defaultColor;
															const shapeStroke = customShapeStyles.stroke || undefined;
															const shapeStrokeWidth =
																customShapeStyles.strokeWidth || undefined;
															const shapeOpacity =
																(customShapeStyles.opacity ?? 1) * categoryOpacity;

															return (
																<g
																	key={`barstack-horizontal-${groupIndex}-${barStack.index}-${bar.index}-g`}
																>
																	<AnimatedBar
																		orientation="horizontal"
																		key={`barstack-horizontal-${groupIndex}-${barStack.index}-${bar.index}`}
																		x={bar.x}
																		y={bar.y}
																		width={barValue ? Math.abs(bar.width) : 0}
																		height={bar.height}
																		fill={shapeFill}
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
																					barData,
																					barCategory,
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
																			(tooltipData?.x !== barData.x ||
																				tooltipData?.y !== barValue ||
																				tooltipData?.category !== barCategory)
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		onBlur={() => {
																			tooltipTimeout = window.setTimeout(() => {
																				hideTooltip();
																			}, 300);
																		}}
																		onFocus={() => {
																			if (tooltipTimeout)
																				clearTimeout(tooltipTimeout);
																			showTooltip({
																				tooltipData: {
																					x: barData.x,
																					y: barValue,
																					category: barCategory,
																					tooltip: customTooltip,
																					tooltipHeader: customHeader,
																				},
																				tooltipTop: bar.y,
																				tooltipLeft: bar.x,
																			});
																		}}
																		onMouseLeave={() => {
																			tooltipTimeout = window.setTimeout(() => {
																				hideTooltip();
																			}, 300);
																		}}
																		onMouseMove={(event) => {
																			if (tooltipTimeout)
																				clearTimeout(tooltipTimeout);
																			if (!svgRef.current) return;
																			const eventSvgCoords = getLocalPoint(
																				svgRef.current,
																				event
																			) || {
																				x: 0,
																				y: 0,
																			};
																			showTooltip({
																				tooltipData: {
																					x: barData.x,
																					y: barValue,
																					category: barCategory,
																					tooltip: customTooltip,
																					tooltipHeader: customHeader,
																				},
																				tooltipTop: eventSvgCoords.y,
																				tooltipLeft: eventSvgCoords.x,
																			});
																		}}
																	/>
																	{barValue &&
																		labels.active &&
																		!wpEditorFunctions?.labels && (
																			<AnimatedBarLabel
																				key={`barstack-horizontal-label-${groupIndex}-${barStack.index}-${bar.index}`}
																				{...positionBarLabel(
																					{
																						x: bar.x,
																						y: bar.y,
																						width: bar.width,
																						height: bar.height,
																						value: barValue,
																					},
																					labels,
																					labelCutoff,
																					'horizontal',
																					'single'
																				)}
																				dataPoint={data[i]}
																				category={barCategory}
																				defaultDx={0}
																				defaultDy={0}
																				chartInnerWidth={innerWidth}
																				chartInnerHeight={innerHeight}
																				fill={getBarLabelFill(
																					labels.color,
																					labels.labelPositionBar,
																					barValue,
																					labelCutoff,
																					defaultColor,
																					bar.color
																				)}
																				fillOpacity={
																					tooltipData &&
																					tooltipVisible &&
																					tooltip.deemphasizeSiblings &&
																					(tooltipData?.x !== barData.x ||
																						tooltipData?.y !== barValue ||
																						tooltipData?.category !==
																							barCategory)
																						? tooltip.deemphasizeOpacity
																						: 1
																				}
																				{...labelProps}
																			>
																				{customLabel ||
																					`${getLabelFormat(
																						barValue,
																						barCategory,
																						labels,
																						null
																					)}`}
																			</AnimatedBarLabel>
																		)}
																</g>
															);
														})
													);
												}}
											</BarStackHorizontal>
										</Group>
									);
								})}

								{/* Render custom axis for grouped data */}
								{independentAxis.active && categoryIndex === 0 && (
									<>
										{groupPositioning.map((groupPos, groupIndex) => {
											const { data, startY, height } = groupPos;

											// Create individual scale for this group's axis
											const groupScale = createGroupBandScale(
												data.map(getIndependentValue),
												[startY + height, startY],
												bar.barPadding
											);

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
								{dependentAxis.active && (
									<AxisBottom
										{...dependentAxisProps}
										top={actualContentHeight}
										scale={dependentScale}
										numTicks={scaledNumTicks}
									/>
								)}
							</Group>
						);
					})}

					{/* Render diff column to the right of all category columns */}
					{diffColumn.active && diffColumn.category && (
						<>
							{groupPositioning.map((groupPos, groupIndex) => {
								const { group, data, startY, height } = groupPos;

								// Create individual scale for this group with relative positioning (0 to height)
								// since the Group is already positioned at startY
								const groupScale = createGroupBandScale(
									data.map(getIndependentValue),
									[height, 0],
									bar.barPadding
								);

								// DiffColumn positions itself internally at innerWidth + marginLeft
								// So we position the Group at padding.left and pass innerWidth as the distance
								// from left edge to where the diff column should start (right edge of last category)
								const lastCategoryIndex = numCategories - 1;
								const distanceToRightEdgeOfLastCategory =
									lastCategoryIndex * columnWidth +
									lastCategoryIndex * explodedBar.columnGap +
									columnContentWidth;

								return (
									<Group
										key={`diff-column-${groupIndex}`}
										top={padding.top + startY}
										left={padding.left}
										role="presentation"
									>
										<DiffColumn
											diffColumn={diffColumn}
											innerHeight={height}
											innerWidth={distanceToRightEdgeOfLastCategory}
											flattenedData={data}
											scale={groupScale}
											dataRender={dataRender}
											labels={labels}
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
					<Group top={padding.top} left={padding.left} role="presentation">
						{groupPositioning.map((groupPos, groupIndex) => {
							if (groupIndex === 0) return null;
							const { startY, breakHeight } = groupPos;

							// Calculate the right edge including DiffColumn if active
							const lastCategoryIndex = numCategories - 1;
							const breakLineDistanceToRightEdge =
								lastCategoryIndex * columnWidth +
								lastCategoryIndex * explodedBar.columnGap +
								columnContentWidth;

							const rightEdge =
								diffColumn.active && diffColumn.category
									? breakLineDistanceToRightEdge +
										diffColumn.style.marginLeft +
										diffColumn.style.width
									: innerWidth + padding.right;

							return (
								<BreakLine
									key={`break-line-${groupIndex}`}
									x1={-padding.left}
									x2={rightEdge}
									y1={startY - breakHeight / 2}
									y2={startY - breakHeight / 2}
									variation={dataRender.groupBreaks?.breakStyles?.variation || 'solid'}
									stroke={dataRender.groupBreaks?.breakStyles?.stroke || '#A4A4A4'}
									strokeWidth={dataRender.groupBreaks?.breakStyles?.strokeWidth || 1.4}
									strokeDasharray={dataRender.groupBreaks?.breakStyles?.strokeDasharray || 'none'}
								/>
							);
						})}
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
					{labels.active && wpEditorFunctions?.labels && (
						<Group top={padding.top} left={padding.left}>
							{groupPositioning.map((groupPos, groupIndex) => {
								const { data, startY, height } = groupPos;

								const groupScale = createGroupBandScale(
									data.map(getIndependentValue),
									[startY + height, startY],
									bar.barPadding
								);

								return (
									<Group key={`draggable-labels-group-${groupIndex}`}>
										{dataRender.categories.map((barCategory, catIndex) => {
											return (
												<Group
													key={`draggable-category-${groupIndex}-${catIndex}`}
													left={catIndex * columnWidth + catIndex * explodedBar.columnGap}
												>
													<BarStackHorizontal
														data={data}
														keys={[barCategory]}
														height={height}
														y={getIndependentValue}
														xScale={dependentScale}
														yScale={groupScale}
														color={() => colorScale(barCategory)}
													>
														{(barStacks) =>
															barStacks.map((barStack) =>
																barStack.bars.map((bar, i) => {
																	const barData: FlatData = bar.bar['data'];
																	const barValue: number =
																		barData[barCategory as keyof typeof barData];

																	if (!barValue) return null;

																	const customLabelText = getCustomLabelText(
																		barData,
																		barCategory
																	);
																	const customLabel =
																		customLabelText ||
																		getCustomLabel(barData, barCategory);
																	const defaultLabel = getLabelFormat(
																		barValue,
																		barCategory,
																		labels,
																		null
																	);

																	const labelPosition = positionBarLabel(
																		{
																			x: bar.x,
																			y: bar.y,
																			width: bar.width,
																			height: bar.height,
																			value: barValue,
																		},
																		labels,
																		labelCutoff,
																		'horizontal',
																		'single'
																	);

																	const defaultColor = resolveCategoryColor({
																		category: barCategory,
																		fallback: bar.color,
																		dataRender,
																	});

																	return (
																		<AnimatedBarLabel
																			key={`draggable-exploded-bar-label-${groupIndex}-${catIndex}-${barStack.index}-${bar.index}`}
																			x={labelPosition.x}
																			y={labelPosition.y}
																			dataPoint={barData}
																			category={barCategory}
																			defaultDx={0}
																			defaultDy={0}
																			chartInnerWidth={innerWidth}
																			chartInnerHeight={innerHeight}
																			defaultLabel={defaultLabel}
																			fill={getBarLabelFill(
																				labels.color,
																				labels.labelPositionBar,
																				barValue,
																				labelCutoff,
																				defaultColor,
																				bar.color
																			)}
																			{...labelProps}
																		>
																			{customLabel || defaultLabel}
																		</AnimatedBarLabel>
																	);
																})
															)
														}
													</BarStackHorizontal>
												</Group>
											);
										})}
									</Group>
								);
							})}
						</Group>
					)}
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
														x: tooltipData.x,
														category: tooltipData.key,
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
												y: tooltipData.y,
												x: tooltipData.x,
												category: tooltipData.category,
												color: resolveCategoryColor({
													category: tooltipData.category || '',
													fallback: colorScale(tooltipData.category || ''),
													dataRender,
												}),
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

export default ExplodedBar;

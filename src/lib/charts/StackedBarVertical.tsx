import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

import {
	DataContext,
	generateElementKey,
	getBarLabelFill,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getGroupedData,
	getGroupPositioningVertical,
	getGroupValue,
	getLabelFormat,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	positionBarLabel,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
	resolveLabelCutoff,
	useSize,
} from '@prc/charting-utilities';
import {
	AnnotationsLayer,
	DrawingsLayer,
	BreakLine,
	ClickableLegend,
	ClickableTicks,
	StyledLegend,
	StyledTooltip,
} from '../overlays';
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import { buildNetValueItemsVerticalStacked, NetValueLabels } from '../labels/NetValueLabels';

import type { BaseConfig, FlatData, GroupedData, Size, TableData } from '@prc/charting-utilities';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarStack } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';

import { ascending, descending } from 'd3-array';

const StackedBarVertical = () => {
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
		bar: barConfig,
		annotations,
		drawings,
		netValues,
	} = config;

	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const labelCutoff = resolveLabelCutoff(labels, size.width, width);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	// DATA PROCESSING
	const flattenedData = useMemo(() => {
		const processed = getFlattenedData(data);
		processed.sort((a: FlatData, b: FlatData) => {
			if (dataRender.sortOrder === 'ascending') {
				return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			if (dataRender.sortOrder === 'descending') {
				return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			return 0;
		});
		return processed;
	}, [data, dataRender.sortOrder, dataRender.sortKey]);

	// DATA ACCESSORS
	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x].toString(), [dataRender.x]);

	const getDependentValue = (d: FlatData) => d[dataRender.y];

	// GROUP BREAKS PROCESSING
	const groupedData: GroupedData[] = useMemo(
		() => getGroupedData(flattenedData, dataRender),
		[flattenedData, dataRender]
	);

	// SCALES
	const independentScale = useMemo(() => {
		const allValues = groupedData.flatMap(({ data: groupData }) => groupData.map(getIndependentValue));
		return scaleBand<string>({
			domain: allValues,
			range: [0, innerWidth],
			padding: barConfig.barPadding,
		});
	}, [groupedData, getIndependentValue, innerWidth, barConfig.barPadding]);

	// GROUP POSITIONING - Calculate actualContentWidth
	const { groupPositioning, actualContentWidth } = useMemo(
		() => getGroupPositioningVertical(groupedData, dataRender, independentScale, innerWidth),
		[groupedData, dataRender, independentScale, innerWidth]
	);

	const calculatedChartWidth = useMemo(() => {
		return dataRender.groupBreaksActive ? actualContentWidth + padding.left + padding.right : size.width || width;
	}, [dataRender.groupBreaksActive, actualContentWidth, padding, size.width, width]);
	const dependentScale = useMemo(
		() =>
			scaleLinear({
				domain: dependentAxis.domain,
				range: [0, innerWidth],
				nice: true,
			}),
		[innerWidth, dependentAxis.domain]
	);
	const colorScale = scaleOrdinal<string, string>({
		domain: dataRender.categories,
		range: colors,
	});
	independentScale.rangeRound([0, innerWidth]);
	dependentScale.range([innerHeight, 0]);

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
		labelProps,
		annotationsVisible,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'stacked column chart',
				config,
				data: sharedPropsData,
				size,
				tableData,
				dependentScale,
				independentScale,
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
			independentTicksComponent,
			dependentTicksComponent,
		]
	);

	const {
		tooltipOpen,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipData,
		hideTooltip,
		showTooltip,
	} = useTooltip<FlatData>();

	let tooltipTimeout: number;

	return calculatedChartWidth && calculatedChartWidth < 100 ? null : (
		<TransitionProvider data={data} family="bar">
			<div
				style={{
					position: 'relative',
					overflow: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={calculatedChartWidth}
					height={height}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<Group top={padding.top} left={padding.left} role="presentation">
						<GridRows {...dependentGridProps} />

						{/* Render grouped stacked bar charts with breaks */}
						{groupPositioning.map((groupPos, groupIndex) => {
							const {
								group,
								data: groupData,
								startX,
								width: groupWidth,
								breakWidth: groupBreakWidth,
							} = groupPos;

							// Create scales for this group
							const groupScale = scaleBand<string>({
								domain: groupData.map(getIndependentValue),
								range: [startX, startX + groupWidth],
								padding: barConfig.barPadding,
							});

							const gridScale = scaleBand<string>({
								domain: groupData.map(getIndependentValue),
								range: [0, groupWidth],
								padding: barConfig.barPadding,
							});

							return (
								<Group key={`group-${groupIndex}-${group}`}>
									{/* Render grid columns for this group */}
									<Group left={startX}>
										<GridColumns
											scale={gridScale}
											height={innerHeight}
											stroke={independentGridProps.stroke}
											strokeWidth={independentGridProps.strokeWidth}
											strokeOpacity={independentGridProps.strokeOpacity}
											strokeDasharray={independentGridProps.strokeDasharray}
											numTicks={groupData.length}
										/>
									</Group>

									<BarStack
										data={groupData}
										keys={dataRender.categories}
										x={getIndependentValue}
										xScale={groupScale}
										yScale={dependentScale}
										color={colorScale}
									>
										{(barStacks) =>
											barStacks.map((barStack) => {
												return barStack.bars.map((bar) => {
													const category: string = bar.key;
													const barData: FlatData = bar.bar.data;
													const barValue: number = barData[category as keyof typeof barData];
													const customLabelText = getCustomLabelText(barData, category);
													const customLabel =
														customLabelText || getCustomLabel(barData, category);
													const { body: customTooltip, header: customHeader } =
														getCustomTooltip(barData, category);

													// Get custom shape styles (group-aware key)
													const groupValue = getGroupValue(barData, dataRender);
													const shapeKey = generateElementKey(
														barData.x,
														category,
														groupValue
													);
													const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
													const defaultColor = resolveCategoryColor({
														category,
														fallback: bar.color,
														dataRender,
													});
													const categoryOpacity = resolveCategoryOpacity({
														category,
														dataRender,
													});

													// Apply custom styles with fallbacks
													const shapeFill = customShapeStyles.fill || defaultColor;
													const shapeStroke =
														customShapeStyles.stroke ||
														(barConfig.hasRectStroke
															? barConfig.rectStrokeColor
															: undefined);
													const shapeStrokeWidth =
														customShapeStyles.strokeWidth ||
														(barConfig.hasRectStroke
															? barConfig.rectStrokeWidth
															: undefined);
													const shapeOpacity =
														(customShapeStyles.opacity ?? 1) * categoryOpacity;

													return (
														<g
															key={`barstack-vertical-${groupIndex}-${barStack.index}-${bar.index}-g`}
														>
															<AnimatedBar
																key={`barstack-vertical-${groupIndex}-${barStack.index}-${bar.index}`}
																x={bar.x}
																y={bar.y}
																width={bar.width}
																height={bar.height}
																fill={shapeFill}
																tabIndex={0}
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
																	(tooltipData?.x !== barData.x ||
																		tooltipData?.y !== barValue ||
																		tooltipData?.category !== category)
																		? tooltip.deemphasizeOpacity
																		: 1
																}
																onMouseLeave={() => {
																	tooltipTimeout = window.setTimeout(() => {
																		hideTooltip();
																	}, 300);
																}}
																onMouseMove={(event) => {
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
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
																			category,
																			tooltip: customTooltip,
																			tooltipHeader: customHeader,
																		},
																		tooltipTop: eventSvgCoords.y,
																		tooltipLeft: eventSvgCoords.x,
																	});
																}}
																onFocus={() => {
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	showTooltip({
																		tooltipData: {
																			x: barData.x,
																			y: barValue,
																			category,
																			tooltip: customTooltip,
																			tooltipHeader: customHeader,
																		},
																		tooltipTop: bar.y,
																		tooltipLeft: bar.x,
																	});
																}}
																onBlur={() => {
																	tooltipTimeout = window.setTimeout(() => {
																		hideTooltip();
																	}, 300);
																}}
															/>
															{barValue && labels.active && labelCutoff < barValue && (
																<AnimatedBarLabel
																	key={`barstack-label-${groupIndex}-${barStack.index}-${bar.index}`}
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
																		'vertical',
																		'stacked'
																	)}
																	dataPoint={barData}
																	category={category}
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
																			tooltipData?.category !== category)
																			? tooltip.deemphasizeOpacity
																			: 1
																	}
																	{...labelProps}
																>
																	{customLabel ||
																		`${getLabelFormat(
																			barValue,
																			category,
																			labels,
																			null
																		)}`}
																</AnimatedBarLabel>
															)}
														</g>
													);
												});
											})
										}
									</BarStack>

									{/* Net value labels (above stack tops) */}
									{netValues.active && netValues.positive.category && (
										<Group>
											<NetValueLabels
												items={buildNetValueItemsVerticalStacked({
													data: groupData,
													dataRender,
													dependentScale,
													groupScale,
													getIndependentValue,
													margin: netValues.positive.margin,
												})}
												side="positive"
												netValues={netValues}
												labelProps={labelProps}
												innerWidth={innerWidth}
												innerHeight={innerHeight}
											/>
										</Group>
									)}

									{/* Render visual break line if not first group */}
									{groupIndex > 0 && (
										<BreakLine
											x1={startX - groupBreakWidth / 2}
											x2={startX - groupBreakWidth / 2}
											y1={-padding.top}
											y2={innerHeight + padding.bottom}
											stroke={dataRender.groupBreaks?.breakStyles?.stroke || '#A4A4A4'}
											strokeWidth={dataRender.groupBreaks?.breakStyles?.strokeWidth || 1.4}
											strokeDasharray={
												dataRender.groupBreaks?.breakStyles?.strokeDasharray || 'none'
											}
											variation={dataRender.groupBreaks?.breakStyles?.variation || 'solid'}
										/>
									)}
								</Group>
							);
						})}

						{/* Render custom axis for grouped data */}
						{config.independentAxis.active && (
							<>
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data: groupData, startX, width: groupWidth } = groupPos;

									// Create individual scale for this group's axis
									const groupScale = scaleBand<string>({
										domain: groupData.map(getIndependentValue),
										range: [startX, startX + groupWidth],
										padding: barConfig.barPadding,
									});

									return (
										<AxisBottom
											key={`axis-${groupIndex}`}
											{...independentAxisProps}
											// because we're using a different group scale,
											// we need to set the numTicks and tickValues
											// TODO: does it even make sense to set tick values for these types of charts? it only seems like we would elide ticks for time scales
											numTicks={independentAxis.tickCount}
											tickValues={(independentAxis.tickValues as string[]) || undefined}
											scale={groupScale}
											top={innerHeight}
										/>
									);
								})}
							</>
						)}
						{config.dependentAxis.active && <AxisLeft {...dependentAxisProps} />}
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

export default StackedBarVertical;

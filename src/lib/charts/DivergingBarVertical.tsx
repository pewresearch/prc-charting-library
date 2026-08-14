import { useCallback, useContext, useMemo, useRef, RefObject, CSSProperties } from 'react';

import {
	DataContext,
	useSize,
	getBarLabelFill,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	getChartDimensions,
	getLabelFormat,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	positionBarLabel,
	getFlattenedData,
	getGroupedData,
	createGroupBandScale,
	getGroupPositioningVertical,
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
	StyledTooltip,
	StyledLegend,
	AnnotationsLayer,
	DrawingsLayer,
	BreakLine,
	ClickableTicks,
	ClickableLegend,
} from '../overlays';
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import { NetValueLabels, buildNetValueItemsVerticalDiverging } from '../labels/NetValueLabels';
import type { FlatData, Size, BaseConfig, TableData, GroupedData } from '@prc/charting-utilities';

import { BarStack, Line } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { ascending, descending } from 'd3-array';
import { useTooltip } from '@visx/tooltip';
import { LegendOrdinal } from '@visx/legend';

import { GridColumns, GridRows } from '@visx/grid';

const DivergingBarVertical = () => {
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
		divergingBar,
		bar: barConfig,
		annotations,
		drawings,
		netValues,
	} = config as BaseConfig;

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	let size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const labelCutoff = resolveLabelCutoff(labels, size.width, width);
	let isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	// DATA PROCESSING
	// this data is a little different than the others. Because the data stack's offset is divergent,
	// we need to convert the keys that belong to the negative categories to negative values
	const flattenedData = useMemo(() => {
		const baseData = getFlattenedData(data);
		let processedData = baseData.map((row: any) => {
			return Object.keys(row).reduce((acc, key) => {
				const value = row[key];
				const isNegative = divergingBar.negativeCategories.includes(key);
				return {
					...acc,
					[key]: isNegative && !isNaN(value) ? -value : value,
				};
			}, {} as any);
		}) as FlatData[];

		// Apply sorting after negative value conversion
		// this feels counterintuitive, but we need to sort the data backwards so that it renders in the correct order
		processedData.sort((a: FlatData, b: FlatData) => {
			if (dataRender.sortOrder === 'ascending') {
				return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			if (dataRender.sortOrder === 'descending') {
				return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			return 0;
		});

		return processedData;
	}, [data, divergingBar.negativeCategories, dataRender.sortOrder, dataRender.sortKey]);

	// DATA ACCESSORS
	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x], [dataRender.x]);

	// GROUP BREAKS PROCESSING
	// Note: We pass a modified dataRender with sortOrder 'none' because we've already
	// applied the diverging-specific sorting above in the flattenedData memo
	const groupedData: GroupedData[] = useMemo(
		() =>
			getGroupedData(flattenedData, {
				...dataRender,
				sortOrder: 'none',
			}),
		[flattenedData, dataRender]
	);

	// SCALES
	const independentScale = useMemo(() => {
		const allValues = groupedData.flatMap(({ data }) => data.map(getIndependentValue));
		return scaleBand<string>({
			domain: allValues,
			range: [0, innerWidth],
			padding: barConfig.barGroupPadding,
		});
	}, [groupedData, getIndependentValue, innerWidth, barConfig.barGroupPadding]);

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
				// Null/auto domains fall back to the signed stacked extent;
				// visx would otherwise silently keep d3's default [0, 1].
				domain: resolveLinearScaleDomain(
					dependentAxis.domain,
					getLinearValueDataExtent(flattenedData, dataRender.categories, {
						stacked: true,
						negativeCategories: divergingBar.negativeCategories,
					})
				),
				range: [0, innerHeight],
				nice: resolveScaleNice(dependentAxis.nice, hasExplicitAxisDomain(dependentAxis.domain)),
			}),
		[
			innerHeight,
			dependentAxis.domain,
			dependentAxis.nice,
			flattenedData,
			dataRender.categories,
			divergingBar.negativeCategories,
		]
	);
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: [...divergingBar.negativeCategories, ...divergingBar.positiveCategories],
				range: colors,
			}),
		[divergingBar, colors]
	);
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
		annotationsVisible,
		labelProps,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'diverging column chart',
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

	return chartWidth && chartWidth < 10 ? null : (
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

						{/* Render grouped bar charts with breaks */}
						{groupPositioning.map((groupPos, groupIndex) => {
							const { group, data, startX, width, breakWidth } = groupPos;

							// Create scales for this group
							const groupScale = createGroupBandScale(
								data.map(getIndependentValue),
								[startX, startX + width],
								barConfig.barGroupPadding
							);

							const gridScale = createGroupBandScale(
								data.map(getIndependentValue),
								[0, width],
								barConfig.barGroupPadding
							);

							return (
								<Group key={`group-${groupIndex}-${group}`}>
									{/* Render grid columns for this group */}
									<Group left={startX}>
										<GridColumns
											scale={gridScale}
											height={innerHeight}
											stroke={dependentGridProps.stroke}
											strokeWidth={dependentGridProps.strokeWidth}
											strokeOpacity={dependentGridProps.strokeOpacity}
											strokeDasharray={dependentGridProps.strokeDasharray}
											numTicks={data.length}
										/>
									</Group>

									<BarStack
										data={data}
										keys={[...divergingBar.negativeCategories, ...divergingBar.positiveCategories]}
										height={innerHeight}
										x={getIndependentValue}
										xScale={groupScale}
										yScale={dependentScale}
										color={colorScale}
										offset={'diverging'}
									>
										{(barStacks) =>
											barStacks.map((barStack) => {
												return barStack.bars.map((bar) => {
													const category: string = bar.key;
													const barData = bar.bar['data'];
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
														<g key={`barstack-vertical-${barStack.index}-${bar.index}-g`}>
															<AnimatedBar
																baseline={dependentScale(0)}
																key={`barstack-vertical-${barStack.index}-${bar.index}`}
																x={bar.x}
																y={bar.y}
																tabIndex={0}
																width={bar.width}
																height={barValue ? Math.abs(bar.height) : 0}
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
																			...barData,
																			y: barValue,
																			category,
																			tooltip: customTooltip,
																			tooltipHeader: customHeader,
																		},
																		tooltipTop: eventSvgCoords.y,
																		tooltipLeft: eventSvgCoords.x,
																	});
																}}
																onBlur={() => {
																	tooltipTimeout = window.setTimeout(() => {
																		hideTooltip();
																	}, 300);
																}}
																onFocus={() => {
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	showTooltip({
																		tooltipData: {
																			...barData,
																			y: barValue,
																			category,
																			tooltip: customTooltip,
																			tooltipHeader: customHeader,
																		},
																		tooltipTop: bar.y,
																		tooltipLeft: bar.x,
																	});
																}}
															/>
															{barValue &&
																labels.active &&
																labelCutoff < Math.abs(barValue) && (
																	<AnimatedBarLabel
																		key={`barstack-horizontal-label-${barStack.index}-${bar.index}`}
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
																			Math.abs(barValue),
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
																				bar.key,
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

									{/* Net value labels (positive / above) */}
									{netValues.active && netValues.positive.category && (
										<Group>
											<NetValueLabels
												items={buildNetValueItemsVerticalDiverging({
													data,
													divergingBar,
													dependentScale,
													groupScale,
													getIndependentValue,
													margin: netValues.positive.margin,
													side: 'positive',
												})}
												side="positive"
												netValues={netValues}
												labelProps={labelProps}
												innerWidth={innerWidth}
												innerHeight={innerHeight}
											/>
										</Group>
									)}
									{netValues.active && netValues.negative.active && netValues.negative.category && (
										<Group>
											<NetValueLabels
												items={buildNetValueItemsVerticalDiverging({
													data,
													divergingBar,
													dependentScale,
													groupScale,
													getIndependentValue,
													margin: netValues.negative.margin,
													side: 'negative',
												})}
												side="negative"
												netValues={netValues}
												labelProps={labelProps}
												innerWidth={innerWidth}
												innerHeight={innerHeight}
											/>
										</Group>
									)}

									{/* Render zero line for this group */}
									<Line
										from={{ x: startX, y: dependentScale(0) }}
										to={{
											x: startX + width,
											y: dependentScale(0),
										}}
										stroke={dependentAxis.axis.stroke}
										strokeWidth={dependentAxis.axis.strokeWidth}
										pointerEvents="none"
									/>

									{/* Render visual break line if not first group */}
									{groupIndex > 0 && (
										<BreakLine
											x1={startX - breakWidth / 2}
											x2={startX - breakWidth / 2}
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
						{independentAxis.active && (
							<>
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data, startX, width } = groupPos;

									// Create individual scale for this group's axis
									const groupScale = createGroupBandScale(
										data.map(getIndependentValue),
										[startX, startX + width],
										barConfig.barGroupPadding
									);

									return (
										<AxisBottom
											key={`axis-${groupIndex}`}
											{...independentAxisProps}
											tickValues={data.map(getIndependentValue)}
											numTicks={data.length}
											scale={groupScale}
											top={innerHeight}
										/>
									);
								})}
							</>
						)}
						{dependentAxis.active && (
							<AxisLeft {...dependentAxisProps} scale={dependentScale} numTicks={undefined} />
						)}
					</Group>
					{annotationsVisible && (
						<AnnotationsLayer
							config={annotations}
							width={calculatedChartWidth}
							height={height}
							layout={layout}
							chartWidth={calculatedChartWidth}
						/>
					)}
					{drawings?.active && !wpEditorFunctions && (
						<DrawingsLayer
							config={drawings}
							width={calculatedChartWidth}
							height={height}
							layout={layout}
							chartWidth={calculatedChartWidth}
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
														x: tooltipData.x,
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
												x: tooltipData.x,
												y: tooltipData.y,
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

export default DivergingBarVertical;

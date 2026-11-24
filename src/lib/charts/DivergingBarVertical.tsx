/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useContext, useMemo, useRef, RefObject, CSSProperties } from 'react';

import {
	DataContext,
	useSize,
	barFillForLabelContrast,
	getBarLabelFill,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	getChartDimensions,
	getLabelFormat,
	getSharedProps,
	getLocalPoint,
	positionBarLabel,
	getFlattenedData,
	getGroupedData,
	createGroupBandScale,
	getGroupPositioningVertical,
	resolveCategoryColor,
	resolveCategoryOpacity,
	resolveBarPaint,
	resolveDivergingSecondaryPaint,
	resolvePatternFill,
	legendCategoryShapeStyle,
	resolveLabelCutoff,
	getLinearValueDataExtent,
	hasExplicitAxisDomain,
	resolveLinearScaleDomain,
	resolveScaleNice,
	INERT_SERIES_MASK,
	seriesMaskShouldHideTooltip,
	useDismissTooltipOnSeriesMask,
} from '@prc/charting-utilities';
import {
	StyledTooltip,
	StyledLegend,
	AnnotationsLayer,
	UnifiedBarTooltipBody,
	DrawingsLayer,
	BreakLine,
	ClickableTicks,
	ClickableLegend,
	SeriesPatternDefs,
	divergingRowTooltipGroups,
} from '../overlays';
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import { NetValueLabels, buildNetValueItemsVerticalDiverging } from '../labels/NetValueLabels';
import type { FlatData, Size, BaseConfig, TableData, GroupedData, SeriesMaskView } from '@prc/charting-utilities';

import { BarStack, Line } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { ascending, descending } from 'd3-array';
import { useTooltip } from '@visx/tooltip';
import { LegendOrdinal } from '@visx/legend';

import { GridColumns, GridRows } from '@visx/grid';

function withDivergingBarLabelDy(
	position: { x: number; y: number },
	value: number,
	labelPositionDY: number
): { x: number; y: number; dy: number } {
	const dy = value < 0 ? -labelPositionDY : labelPositionDY;
	return {
		x: position.x,
		y: position.y - labelPositionDY + dy,
		dy,
	};
}

function pointerEventsForMark(hidden: boolean, editorShapesActive: unknown): 'none' | 'all' | undefined {
	if (hidden) {
		return 'none';
	}
	return editorShapesActive ? 'all' : undefined;
}

const DivergingBarVertical = () => {
	const {
		data,
		config,
		tableData,
		wpEditorFunctions,
		seriesMask = INERT_SERIES_MASK,
	} = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
			seriesMask?: SeriesMaskView;
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
		seriesStyles,
	} = config as BaseConfig;

	const seriesMaskView = seriesMask ?? INERT_SERIES_MASK;

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const labelCutoff = resolveLabelCutoff(labels, size.width, width);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	// DATA PROCESSING
	// this data is a little different than the others. Because the data stack's offset is divergent,
	// we need to convert the keys that belong to the negative categories to negative values
	const flattenedData = useMemo(() => {
		const baseData = getFlattenedData(data);
		const processedData = baseData.map((row: any) => {
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

	// Group breaks widen the plot. Otherwise follow getChartDimensions so scroll
	// and narrow viewports use the same width as the horizontal diverging bar.
	const svgWidth = dataRender.groupBreaksActive ? actualContentWidth + padding.left + padding.right : chartWidth;
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
	const resolveSecondaryPaint = useCallback(
		(category: string) => {
			const secondary = divergingBar.secondary;
			const legacyStyle = secondary?.categoryStyles?.[category];
			const legacyPaint = legacyStyle
				? {
						...legacyStyle,
						fill: legacyStyle.fill === null ? 'none' : legacyStyle.fill,
					}
				: undefined;

			return resolveDivergingSecondaryPaint(
				{
					fill: secondary?.fill ?? 'none',
					stroke: secondary?.stroke ?? 'light-dark(#000000, #ffffff)',
					strokeWidth: secondary?.strokeWidth ?? 0.5,
					opacity: secondary?.opacity ?? 0.4,
				},
				legacyPaint,
				seriesStyles?.[category]
			);
		},
		[divergingBar.secondary, seriesStyles]
	);

	// An outline-only overlay has no fill to show, so tooltip text and legend
	// swatches take its stroke instead of rendering transparent.
	const secondaryLabelColor = useCallback(
		(category: string) => {
			const paint = resolveSecondaryPaint(category);
			const fill = paint.fill ?? 'none';
			return 'none' === fill || 'transparent' === fill ? (paint.stroke ?? fill) : fill;
		},
		[resolveSecondaryPaint]
	);

	const colorScale = useMemo(() => {
		const domain = [...divergingBar.negativeCategories, ...divergingBar.positiveCategories];
		const range = [...colors];

		if (divergingBar.secondary?.active && (divergingBar.secondary?.showInLegend || tooltip.mode === 'unified')) {
			const secondaryCats = [
				...divergingBar.secondary.negativeCategories,
				...divergingBar.secondary.positiveCategories,
			];
			domain.push(...secondaryCats);
			range.push(...secondaryCats.map(secondaryLabelColor));
		}

		return scaleOrdinal<string, string>({ domain, range });
	}, [divergingBar, colors, tooltip.mode, secondaryLabelColor]);
	independentScale.rangeRound([0, innerWidth]);
	dependentScale.range([innerHeight, 0]);

	// GET SHARED LAYOUT PROPS
	// For shared props, we use the first group's data (or flattened if no grouping)
	const sharedPropsData = useMemo(() => (groupedData.length > 0 ? groupedData[0].data : []), [groupedData]);
	const onTickClick = wpEditorFunctions?.tickLabels?.onClick;
	const independentTicksComponent = useCallback(
		(props: any) => <ClickableTicks {...props} axisKey="independent" onTickClick={onTickClick} />,
		[onTickClick]
	);
	const dependentTicksComponent = useCallback(
		(props: any) => <ClickableTicks {...props} axisKey="dependent" onTickClick={onTickClick} />,
		[onTickClick]
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

	useDismissTooltipOnSeriesMask(seriesMaskView, hideTooltip);

	const secondaryActive = !!divergingBar.secondary?.active;
	let tooltipTimeout: number;

	return (
		<TransitionProvider data={data} family="bar">
			<div
				style={{
					position: 'relative',
					overflow: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={svgWidth}
					height={height}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<SeriesPatternDefs seriesStyles={seriesStyles} resolveFill={(category) => colorScale(category)} />
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
							const secondaryGroupData = secondaryActive
								? data.map((row: any) =>
										Object.keys(row).reduce((acc, key) => {
											const value = row[key];
											const isSecNeg = divergingBar.secondary!.negativeCategories.includes(key);
											return {
												...acc,
												[key]: isSecNeg && !isNaN(value) ? -Math.abs(value) : value,
											};
										}, {} as any)
									)
								: [];

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

									{secondaryActive &&
										data.map((row: FlatData, rowIdx: number) => {
											const rowX = groupScale(getIndependentValue(row));
											if (rowX === undefined) return null;
											return (
												<rect
													key={`row-hit-${groupIndex}-${rowIdx}`}
													x={rowX}
													y={0}
													width={groupScale.bandwidth()}
													height={innerHeight}
													fill="transparent"
													style={{ pointerEvents: 'all' }}
													onMouseLeave={() => {
														tooltipTimeout = window.setTimeout(() => {
															hideTooltip();
														}, 300);
													}}
													onMouseMove={(event) => {
														if (tooltipTimeout) clearTimeout(tooltipTimeout);
														if (!svgRef.current) return;
														const coords = getLocalPoint(svgRef.current, event) || {
															x: 0,
															y: 0,
														};
														const tooltipSide: 'top' | 'bottom' =
															coords.y - padding.top > (dependentScale(0) ?? 0)
																? 'bottom'
																: 'top';
														showTooltip({
															tooltipData: {
																...row,
																tooltipMode: 'row',
																tooltipSide,
															},
															tooltipTop: coords.y,
															tooltipLeft: coords.x,
														});
													}}
												/>
											);
										})}

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
													const barData = bar.bar.data;
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

													const paint = resolveBarPaint(
														{
															fill: defaultColor,
															opacity: 1,
														},
														seriesStyles?.[category],
														customShapeStyles,
														barConfig
													);
													const shapeFill = resolvePatternFill(paint, category);
													const labelContrastFill = barFillForLabelContrast(
														shapeFill,
														defaultColor
													);
													const seriesHidden = seriesMaskView.isHidden(category);
													const shapeOpacity =
														(paint.opacity ?? 1) * categoryOpacity * (seriesHidden ? 0 : 1);
													const labelPosition = withDivergingBarLabelDy(
														positionBarLabel(
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
														),
														barValue,
														labels.labelPositionDY
													);

													return (
														<g key={`barstack-vertical-${barStack.index}-${bar.index}-g`}>
															<AnimatedBar
																baseline={dependentScale(0)}
																key={`barstack-vertical-${barStack.index}-${bar.index}`}
																x={bar.x}
																y={bar.y}
																tabIndex={seriesHidden ? -1 : 0}
																width={bar.width}
																height={barValue ? Math.abs(bar.height) : 0}
																fill={shapeFill}
																stroke={paint.stroke}
																strokeWidth={paint.strokeWidth}
																strokeOpacity={paint.strokeOpacity}
																strokeDasharray={paint.strokeDasharray}
																opacity={shapeOpacity}
																style={{
																	cursor: wpEditorFunctions?.shapes
																		? 'pointer'
																		: undefined,
																	pointerEvents: pointerEventsForMark(
																		seriesHidden,
																		wpEditorFunctions?.shapes
																	),
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
																	tooltipData?.tooltipMode !== 'row' &&
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
																	if (seriesHidden) {
																		return;
																	}
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	if (!svgRef.current) return;
																	const eventSvgCoords = getLocalPoint(
																		svgRef.current,
																		event
																	) || {
																		x: 0,
																		y: 0,
																	};
																	const tooltipSide: 'top' | 'bottom' =
																		divergingBar.negativeCategories.includes(
																			category
																		)
																			? 'bottom'
																			: 'top';
																	showTooltip({
																		tooltipData: {
																			...barData,
																			tooltipMode: 'row',
																			tooltipSide,
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
																	if (seriesHidden) {
																		return;
																	}
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	const focusSide: 'top' | 'bottom' =
																		divergingBar.negativeCategories.includes(
																			category
																		)
																			? 'bottom'
																			: 'top';
																	showTooltip({
																		tooltipData: {
																			...barData,
																			tooltipMode: 'row',
																			tooltipSide: focusSide,
																		},
																		tooltipTop: bar.y,
																		tooltipLeft: bar.x,
																	});
																}}
															/>
															{barValue &&
																labels.active &&
																labelCutoff < Math.abs(barValue) &&
																!seriesHidden && (
																	<AnimatedBarLabel
																		key={`barstack-vertical-label-${barStack.index}-${bar.index}`}
																		x={labelPosition.x}
																		y={labelPosition.y}
																		dataPoint={barData}
																		category={category}
																		defaultDx={labels.labelPositionDX}
																		defaultDy={labelPosition.dy}
																		chartInnerWidth={innerWidth}
																		chartInnerHeight={innerHeight}
																		fill={getBarLabelFill(
																			labels.color,
																			labels.labelPositionBar,
																			Math.abs(barValue),
																			labelCutoff,
																			labelContrastFill,
																			labelContrastFill
																		)}
																		fillOpacity={
																			tooltipData &&
																			tooltipVisible &&
																			tooltip.deemphasizeSiblings &&
																			tooltipData?.tooltipMode !== 'row' &&
																			(tooltipData?.x !== barData.x ||
																				tooltipData?.y !== barValue ||
																				tooltipData?.category !== category)
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		{...labelProps}
																		dy={labelPosition.dy}
																	>
																		{customLabel ||
																			`${getLabelFormat(
																				barValue,
																				category,
																				labels,
																				labelCutoff
																			)}`}
																	</AnimatedBarLabel>
																)}
														</g>
													);
												});
											})
										}
									</BarStack>

									{secondaryActive && (
										<Group style={{ pointerEvents: 'none' }}>
											<BarStack
												data={secondaryGroupData}
												keys={[
													...divergingBar.secondary!.negativeCategories,
													...divergingBar.secondary!.positiveCategories,
												]}
												height={innerHeight}
												x={getIndependentValue}
												xScale={groupScale}
												yScale={dependentScale}
												color={(key) => resolveSecondaryPaint(key).fill ?? 'none'}
												offset={'diverging'}
											>
												{(barStacks) =>
													barStacks.map((barStack) =>
														barStack.bars.map((bar) => {
															const barData = bar.bar.data;
															const category = bar.key;
															const barValue: number =
																barData[category as keyof typeof barData];
															const paint = resolveSecondaryPaint(category);
															const seriesHidden = seriesMaskView.isHidden(category);
															const ghostOpacity =
																(paint.opacity ?? 0.4) * (seriesHidden ? 0 : 1);
															return (
																<AnimatedBar
																	orientation="vertical"
																	baseline={dependentScale(0)}
																	key={`ghost-${barStack.index}-${bar.index}`}
																	x={bar.x}
																	y={bar.y}
																	tabIndex={seriesHidden ? -1 : 0}
																	width={bar.width}
																	height={barValue ? Math.abs(bar.height) : 0}
																	fill={paint.fill ?? 'none'}
																	stroke={paint.stroke}
																	strokeWidth={paint.strokeWidth}
																	opacity={ghostOpacity}
																/>
															);
														})
													)
												}
											</BarStack>
										</Group>
									)}

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
										stroke={divergingBar.zeroLine?.stroke || dependentAxis.axis.stroke}
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
							width={svgWidth}
							height={height}
							layout={layout}
							chartWidth={svgWidth}
						/>
					)}
					{drawings?.active && !wpEditorFunctions && (
						<DrawingsLayer
							config={drawings}
							width={svgWidth}
							height={height}
							layout={layout}
							chartWidth={svgWidth}
						/>
					)}
				</svg>
				{legend.active && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={svgWidth}>
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
				{tooltipOpen &&
					tooltipData &&
					tooltipVisible &&
					!seriesMaskShouldHideTooltip(seriesMaskView, {
						tooltipMode: tooltipData.tooltipMode,
						category: tooltipData.category,
						rowCategoryKeys:
							tooltipData.tooltipMode === 'row'
								? divergingRowTooltipGroups(
										divergingBar,
										secondaryActive,
										tooltipData.tooltipSide,
										tooltip.mode === 'unified'
									).flat()
								: undefined,
					}) && (
						<StyledTooltip
							top={tooltipTop}
							left={tooltipLeft}
							tooltip={tooltip}
							containerRef={svgRef}
							isMobile={isMobileTooltip}
						>
							<UnifiedBarTooltipBody
								tooltipData={tooltipData}
								tooltip={tooltip}
								divergingBar={divergingBar}
								secondaryActive={secondaryActive}
								seriesMaskView={seriesMaskView}
								secondaryLabelColor={secondaryLabelColor}
								colorScale={colorScale}
								dataRender={dataRender}
							/>
						</StyledTooltip>
					)}
			</div>
		</TransitionProvider>
	);
};

export default DivergingBarVertical;

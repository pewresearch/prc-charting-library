import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

import type { BaseConfig, FlatData, GroupedData, Size, TableData } from '@prc/charting-utilities';
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
	createGroupBandScale,
	getGroupPositioningHorizontal,
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
	getLinearValueDataExtent,
	hasExplicitAxisDomain,
	resolveLinearScaleDomain,
	resolveScaleNice,
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
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import { buildNetValueItemsHorizontalDiverging, NetValueLabels } from '../labels/NetValueLabels';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarStackHorizontal, Line as VerticalLine } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { ascending, descending } from 'd3-array';

/** Mirror labelPositionDX for negative bars so opposing labels stay symmetrical. */
function withDivergingBarLabelDx(
	position: { x: number; y: number },
	value: number,
	labelPositionDX: number
): { x: number; y: number; dx: number } {
	const dx = value < 0 ? -labelPositionDX : labelPositionDX;
	return {
		x: position.x - labelPositionDX + dx,
		y: position.y,
		dx,
	};
}

const DivergingBarHorizontal = () => {
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
		diffColumn,
		netValues,
		annotations,
		drawings,
	} = config as BaseConfig;

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout, diffColumn);
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
		processedData.sort((a: FlatData, b: FlatData) => {
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
		// UNLESS the sortKey is a negative category,
		// then we can just leave it as is.
		// Sorry.
		if (!divergingBar.negativeCategories.includes(dataRender.sortKey)) {
			processedData.reverse();
		}

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
			range: [0, innerHeight],
			padding: barConfig.barGroupPadding,
		});
	}, [groupedData, getIndependentValue, innerHeight, barConfig.barGroupPadding]);

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
				// Null/auto domains fall back to the signed stacked extent;
				// visx would otherwise silently keep d3's default [0, 1].
				domain: resolveLinearScaleDomain(
					dependentAxis.domain,
					getLinearValueDataExtent(flattenedData, dataRender.categories, {
						stacked: true,
						negativeCategories: divergingBar.negativeCategories,
					})
				),
				range: [0, innerWidth],
				nice: resolveScaleNice(dependentAxis.nice, hasExplicitAxisDomain(dependentAxis.domain)),
			}),
		[
			innerWidth,
			dependentAxis.domain,
			dependentAxis.nice,
			flattenedData,
			dataRender.categories,
			divergingBar.negativeCategories,
		]
	);

	const colorScale = useMemo(() => {
		const domain = [...divergingBar.negativeCategories, ...divergingBar.positiveCategories];
		const range = [...colors];

		if (divergingBar.neutralBar.active) {
			domain.push(divergingBar.neutralBar.category);
		}

		if (divergingBar.secondary?.active && divergingBar.secondary?.showInLegend) {
			const secondaryCats = [
				...divergingBar.secondary.negativeCategories,
				...divergingBar.secondary.positiveCategories,
			];
			const secondaryFills = secondaryCats.map((cat) => {
				const cs = divergingBar.secondary!.categoryStyles?.[cat] ?? {};
				const f = cs.fill !== undefined ? cs.fill : divergingBar.secondary!.fill;
				return f ?? 'none';
			});
			domain.push(...secondaryCats);
			range.push(...secondaryFills);
		}

		return scaleOrdinal<string, string>({ domain, range });
	}, [divergingBar, colors]);

	// tweak the ranges of scales if the neutral bar is active
	if (divergingBar.neutralBar.active) {
		dependentScale.rangeRound([0, innerWidth * divergingBar.percentOfInnerWidth]);
	} else {
		dependentScale.rangeRound([0, innerWidth]);
	}
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
				chartType: 'diverging horizontal bar chart',
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

	// Whether the secondary ghost overlay is enabled
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
					width={chartWidth}
					height={chartHeight}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<Group top={padding.top} left={padding.left} role="presentation">
						<GridColumns {...dependentGridProps} />
						{independentAxis.active && (
							<>
								{/* Render custom axis for grouped data */}
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data, startY, height } = groupPos;

									// Create individual scale for this group's axis
									const groupScale = createGroupBandScale(
										data.map(getIndependentValue),
										[startY + height, startY],
										barConfig.barPadding
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
							<AxisBottom {...dependentAxisProps} top={innerHeight} scale={dependentScale} />
						)}
						{/* Render grouped diverging bar charts with breaks */}
						{groupPositioning.map((groupPos, groupIndex) => {
							const { group, data, startY, height, breakHeight } = groupPos;

							// Create scales for this group:
							// - groupScale: for positioning bars relative to the group's startY
							// - gridScale: for grid lines within the group (range starts at 0)
							const groupScale = createGroupBandScale(
								data.map(getIndependentValue),
								[startY + height, startY],
								barConfig.barPadding
							);

							const gridScale = createGroupBandScale(
								data.map(getIndependentValue),
								[height, 0],
								barConfig.barPadding
							);

							// Negate secondary negative category values so they render left of x=0
							// under the diverging offset (same transform applied to primary negatives).
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
									{/* Render grid rows for this group - wrapped in Group for positioning */}
									<Group top={startY}>
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

									{/* Row-hit overlay: one invisible full-width rect per row.
							    Rendered before primary bars (lower z-order) so primary bars
							    keep their per-bar interactivity when directly hovered.
							    Only active when secondary/ghost mode is enabled. */}
									{secondaryActive &&
										data.map((row: FlatData, rowIdx: number) => {
											const rowY = groupScale(getIndependentValue(row));
											if (rowY === undefined) return null;
											return (
												<rect
													key={`row-hit-${groupIndex}-${rowIdx}`}
													x={0}
													y={rowY}
													width={innerWidth}
													height={groupScale.bandwidth()}
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
														const tooltipSide: 'left' | 'right' =
															coords.x - padding.left < (dependentScale(0) ?? 0)
																? 'left'
																: 'right';
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

									<BarStackHorizontal
										data={data}
										keys={[...divergingBar.negativeCategories, ...divergingBar.positiveCategories]}
										height={height}
										y={getIndependentValue}
										xScale={dependentScale}
										yScale={groupScale}
										color={colorScale}
										offset={'diverging'}
										width={innerWidth * divergingBar.percentOfInnerWidth}
									>
										{(barStacks) => {
											return barStacks.map((barStack) =>
												barStack.bars.map((bar, i) => {
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

													const labelPosition = withDivergingBarLabelDx(
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
															'horizontal',
															'stacked'
														),
														barValue,
														labels.labelPositionDX
													);

													return (
														<g key={`barstack-horizontal-${barStack.index}-${bar.index}-g`}>
															<AnimatedBar
																orientation="horizontal"
																baseline={dependentScale(0)}
																key={`barstack-horizontal-${barStack.index}-${bar.index}`}
																x={bar.x}
																y={bar.y}
																tabIndex={0}
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
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	if (!svgRef.current) return;
																	const eventSvgCoords = getLocalPoint(
																		svgRef.current,
																		event
																	) || {
																		x: 0,
																		y: 0,
																	};

																	const tooltipSide: 'left' | 'right' =
																		divergingBar.negativeCategories.includes(
																			category
																		)
																			? 'left'
																			: 'right';
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
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	const focusSide: 'left' | 'right' =
																		divergingBar.negativeCategories.includes(
																			category
																		)
																			? 'left'
																			: 'right';
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
																labelCutoff < Math.abs(barValue) && (
																	<AnimatedBarLabel
																		key={`barstack-horizontal-label-${barStack.index}-${bar.index}`}
																		x={labelPosition.x}
																		y={labelPosition.y}
																		dataPoint={barData}
																		category={category}
																		defaultDx={labelPosition.dx}
																		defaultDy={labels.labelPositionDY}
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
																			tooltipData?.tooltipMode !== 'row' &&
																			(tooltipData?.x !== barData.x ||
																				tooltipData?.y !== barValue ||
																				tooltipData?.category !== category)
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		{...labelProps}
																		dx={labelPosition.dx}
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
												})
											);
										}}
									</BarStackHorizontal>

									{/* Ghost overlay: secondary BarStackHorizontal rendered on top of
							    primary with reduced opacity so primary colors tint through
							    where stacks overlap. pointerEvents: none on the wrapping Group
							    lets hit-testing fall through to the primary bars and row-hit
							    rects below. No labels on the ghost layer. */}
									{secondaryActive && (
										<Group style={{ pointerEvents: 'none' }}>
											<BarStackHorizontal
												data={secondaryGroupData}
												keys={[
													...divergingBar.secondary!.negativeCategories,
													...divergingBar.secondary!.positiveCategories,
												]}
												height={height}
												y={getIndependentValue}
												xScale={dependentScale}
												yScale={groupScale}
												color={(key) => {
													const cs = divergingBar.secondary!.categoryStyles?.[key] ?? {};
													const f =
														cs.fill !== undefined ? cs.fill : divergingBar.secondary!.fill;
													return f ?? 'none';
												}}
												offset={'diverging'}
												width={innerWidth * divergingBar.percentOfInnerWidth}
											>
												{(barStacks) =>
													barStacks.map((barStack) =>
														barStack.bars.map((bar) => {
															const barData = bar.bar.data;
															const category = bar.key;
															const barValue: number =
																barData[category as keyof typeof barData];
															const catStyle =
																divergingBar.secondary!.categoryStyles?.[category] ??
																{};
															const resolvedFill =
																catStyle.fill !== undefined
																	? catStyle.fill
																	: divergingBar.secondary!.fill;
															const ghostFill = resolvedFill ?? 'none';
															const ghostStroke =
																catStyle.stroke ??
																divergingBar.secondary!.stroke ??
																'#000';
															const ghostStrokeWidth =
																catStyle.strokeWidth ??
																divergingBar.secondary!.strokeWidth ??
																0.5;
															const ghostOpacity =
																catStyle.opacity ??
																divergingBar.secondary!.opacity ??
																0.4;
															return (
																<AnimatedBar
																	orientation="horizontal"
																	baseline={dependentScale(0)}
																	key={`ghost-${barStack.index}-${bar.index}`}
																	x={bar.x}
																	y={bar.y}
																	width={barValue ? Math.abs(bar.width) : 0}
																	height={bar.height}
																	fill={ghostFill}
																	stroke={ghostStroke}
																	strokeWidth={ghostStrokeWidth}
																	opacity={ghostOpacity}
																/>
															);
														})
													)
												}
											</BarStackHorizontal>
										</Group>
									)}

									{/* Net value labels (positive / right) */}
									{netValues.active && netValues.positive.category && (
										<Group top={startY}>
											<NetValueLabels
												items={buildNetValueItemsHorizontalDiverging({
													data,
													divergingBar,
													dependentScale,
													groupScale: gridScale,
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
										<Group top={startY}>
											<NetValueLabels
												items={buildNetValueItemsHorizontalDiverging({
													data,
													divergingBar,
													dependentScale,
													groupScale: gridScale,
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

									{/* Render diff column for this group */}
									{diffColumn.active && diffColumn.category && (
										<Group top={startY}>
											<DiffColumn
												diffColumn={diffColumn}
												innerHeight={height}
												innerWidth={innerWidth}
												flattenedData={data}
												scale={gridScale}
												dataRender={dataRender}
												labels={labels}
												layout={layout}
												showHeader={groupIndex === 0}
												groupValue={dataRender.groupBreaksActive ? group : null}
											/>
										</Group>
									)}

									{/* Render visual break line on top - after DiffColumn to appear above background */}
									{groupIndex > 0 && (
										<BreakLine
											x1={-padding.left}
											x2={
												diffColumn.active && diffColumn.category
													? innerWidth + diffColumn.style.marginLeft + diffColumn.style.width
													: innerWidth + padding.right
											}
											y1={startY - breakHeight / 2}
											y2={startY - breakHeight / 2}
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
						<VerticalLine
							from={{ x: dependentScale(0), y: 0 }}
							to={{ x: dependentScale(0), y: actualContentHeight }}
							stroke={dependentAxis.axis.stroke}
							strokeWidth={dependentAxis.axis.strokeWidth}
							pointerEvents="none"
						/>
					</Group>
					{divergingBar.neutralBar.active && !diffColumn.active && (
						<Group
							top={padding.top}
							left={innerWidth * divergingBar.percentOfInnerWidth + divergingBar.neutralBar.offsetX}
							role="presentation"
						>
							{dependentAxis.active && (
								<AxisBottom top={innerHeight} {...dependentAxisProps} scale={dependentScale} />
							)}
							{/* Render grouped neutral bars with breaks */}
							{groupPositioning.map((groupPos, groupIndex) => {
								const { group, data, startY, height } = groupPos;

								// Create scale for this group's neutral bars
								const groupScale = createGroupBandScale(
									data.map(getIndependentValue),
									[startY + height, startY],
									barConfig.barPadding
								);

								return (
									<BarStackHorizontal
										key={`neutral-group-${groupIndex}-${group}`}
										data={data}
										keys={[divergingBar.neutralBar.category]}
										height={height}
										y={getIndependentValue}
										xScale={dependentScale}
										yScale={groupScale}
										color={colorScale}
									>
										{(barStacks) => {
											return barStacks.map((barStack) =>
												barStack.bars.map((bar, i) => {
													const category: string = bar.key;
													const barData: FlatData = bar.bar.data;
													const barValue: number = barData[category as keyof typeof barData];
													const customLabelText = getCustomLabelText(barData, category);
													const customLabel =
														customLabelText || getCustomLabel(barData, category);
													const { body: customTooltip, header: customHeader } =
														getCustomTooltip(barData, category);

													// Get custom shape styles (group-aware key)
													const groupValue2 = getGroupValue(barData, dataRender);
													const shapeKey = generateElementKey(
														barData.x,
														category,
														groupValue2
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

													const labelPosition = withDivergingBarLabelDx(
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
															'horizontal',
															'single'
														),
														barValue,
														labels.labelPositionDX
													);

													return (
														<g
															key={`barstack-horizontal-neutral-${barStack.index}-${bar.index}`}
														>
															<AnimatedBar
																orientation="horizontal"
																key={`barstack-horizontal-neutral-${barStack.index}-${bar.index}`}
																x={bar.x}
																y={bar.y}
																tabIndex={0}
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
																			category,
																			defaultColor,
																			event.currentTarget,
																			groupValue2
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
																	if (tooltipTimeout) clearTimeout(tooltipTimeout);
																	if (!svgRef.current) return;
																	const eventSvgCoords = getLocalPoint(
																		svgRef.current,
																		event
																	) || {
																		x: 0,
																		y: 0,
																	};

																	// The neutral bar is a single segment, not a
																	// diverging pair, so it shows a single-point
																	// tooltip: `{{value}}` / `{{column}}` resolve to
																	// the neutral bar instead of the row's sides.
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
															/>
															{barValue && labels.active && (
																<AnimatedBarLabel
																	key={`barstack-horizontal-neutral-label-${barStack.index}-${bar.index}`}
																	x={labelPosition.x}
																	y={labelPosition.y}
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
																		tooltipData?.tooltipMode !== 'row' &&
																		(tooltipData?.x !== barData.x ||
																			tooltipData?.y !== barValue ||
																			tooltipData?.category !== category)
																			? tooltip.deemphasizeOpacity
																			: 1
																	}
																	{...labelProps}
																	dx={labelPosition.dx}
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
												})
											);
										}}
									</BarStackHorizontal>
								);
							})}
							{divergingBar.neutralBar.separator && (
								<VerticalLine
									from={{
										x: dependentScale(divergingBar.neutralBar.separatorOffsetX),
										y: 0,
									}}
									to={{
										x: dependentScale(divergingBar.neutralBar.separatorOffsetX),
										y: actualContentHeight,
									}}
									stroke={'#ccc'}
									strokeWidth={dependentAxis.axis.strokeWidth}
									strokeDasharray={'2 2'}
									pointerEvents="none"
								/>
							)}
						</Group>
					)}
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
						{tooltipData.tooltipMode === 'row' ? (
							// Row-context tooltip: each category formatted via getTooltipFormat
							// so number formatting, abbreviation, custom format strings, and
							// per-bar custom tooltips are all preserved.
							<div>
								{[
									...(tooltipData.tooltipSide === 'left'
										? divergingBar.negativeCategories
										: divergingBar.positiveCategories),
									...(secondaryActive
										? tooltipData.tooltipSide === 'left'
											? divergingBar.secondary!.negativeCategories
											: divergingBar.secondary!.positiveCategories
										: []),
								].map((cat: string) => {
									const raw = tooltipData[cat];
									if (raw === null || raw === undefined) return null;
									const val = typeof raw === 'number' ? Math.abs(raw) : raw;
									const { body: customBody } = getCustomTooltip(tooltipData, cat);
									const html = customBody
										? customBody
										: getTooltipFormat(
												{
													x: tooltipData.x,
													y: val,
													category: cat,
													color: resolveCategoryColor({
														category: cat,
														fallback: colorScale(cat),
														dataRender,
													}),
													data: tooltipData,
												},
												tooltip,
												dataRender
											);
									return <div key={cat} dangerouslySetInnerHTML={{ __html: html }} />;
								})}
							</div>
						) : (
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
						)}
					</StyledTooltip>
				)}
			</div>
		</TransitionProvider>
	);
};

export default DivergingBarHorizontal;

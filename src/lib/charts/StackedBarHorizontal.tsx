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
	scaleAxisNumTicks,
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
import { buildNetValueItemsHorizontalStacked, NetValueLabels } from '../labels/NetValueLabels';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarStackHorizontal } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { ascending, descending } from 'd3-array';

const StackedBarHorizontal = () => {
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
		diffColumn,
		netValues,
		annotations,
		drawings,
	} = config;

	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout, diffColumn);
	const labelCutoff = resolveLabelCutoff(labels, size.width, width);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	const scaledNumTicks = useMemo(
		() => scaleAxisNumTicks(dependentAxis.tickCount || 5, chartWidth, width),
		[dependentAxis.tickCount, chartWidth, width]
	);

	// DATA PROCESSING
	const flattenedData = useMemo(() => {
		const processed = getFlattenedData(data);
		// this feels counterintuitive, but we need to sort the data backwards so that it renders in the correct order
		processed
			.sort((a: FlatData, b: FlatData) => {
				if (dataRender.sortOrder === 'ascending') {
					return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
				}
				if (dataRender.sortOrder === 'descending') {
					return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
				}
				return 0;
			})
			.reverse();
		return processed;
	}, [data, dataRender.sortOrder, dataRender.sortKey]);

	// DATA ACCESSORS
	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x], [dataRender.x]);
	const getDependentValue = (d: FlatData) => d[dataRender.y];

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
			range: [0, innerHeight],
			padding: barConfig.barPadding,
		});
	}, [groupedData, getIndependentValue, innerHeight, barConfig.barPadding]);

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
				// Null/auto domains fall back to the stacked data extent;
				// visx would otherwise silently keep d3's default [0, 1].
				domain: resolveLinearScaleDomain(
					dependentAxis.domain,
					getLinearValueDataExtent(flattenedData, dataRender.categories, { stacked: true })
				),
				range: [0, innerWidth],
				nice: resolveScaleNice(dependentAxis.nice, hasExplicitAxisDomain(dependentAxis.domain)),
			}),
		[innerWidth, dependentAxis.domain, dependentAxis.nice, flattenedData, dataRender.categories]
	);
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: dataRender.categories,
				range: colors,
			}),
		[dataRender.categories, colors]
	);
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
		labelProps,
		annotationsVisible,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'stacked horizontal bar chart',
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
					<Group top={padding.top} left={padding.left} role="presentation">
						<GridColumns {...dependentGridProps} />

						{/* Render grouped stacked bar charts with breaks */}
						{groupPositioning.map((groupPos, groupIndex) => {
							const { group, data, startY, height, breakHeight } = groupPos;

							// Create individual scale for this group with relative positioning (0 to height)
							// since the Group is already positioned at startY
							const groupScale = createGroupBandScale(
								data.map(getIndependentValue),
								[height, 0],
								barConfig.barPadding
							);

							return (
								<Group key={`group-${groupIndex}-${group}`}>
									{/* Render grid rows for this group - wrapped in Group for positioning */}
									<Group top={startY}>
										<GridRows
											scale={groupScale}
											width={innerWidth}
											stroke={independentGridProps.stroke}
											strokeWidth={independentGridProps.strokeWidth}
											strokeOpacity={independentGridProps.strokeOpacity}
											strokeDasharray={independentGridProps.strokeDasharray}
											numTicks={data.length}
										/>
									</Group>

									<Group top={startY}>
										<BarStackHorizontal
											data={data}
											keys={dataRender.categories}
											height={height}
											y={getIndependentValue}
											xScale={dependentScale}
											yScale={groupScale}
											color={colorScale}
										>
											{(barStacks) => {
												return barStacks.map((barStack) => {
													return barStack.bars.map((bar, i) => {
														const category: string = bar.key;
														const barData: FlatData = bar.bar.data;
														const barValue: number =
															barData[category as keyof typeof barData];
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
														const customShapeStyles =
															shapes?.customStyles?.[shapeKey] || {};
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
																key={`barstack-horizontal-${barStack.index}-${bar.index}`}
															>
																<AnimatedBar
																	orientation="horizontal"
																	x={bar.x}
																	y={bar.y}
																	width={barValue ? Math.abs(bar.width) : 0}
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
																{barValue &&
																	labels.active &&
																	labelCutoff < barValue && (
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
																				'horizontal',
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
												});
											}}
										</BarStackHorizontal>
									</Group>

									{/* Net value labels (positive / right) */}
									{netValues.active && netValues.positive.category && (
										<Group top={startY}>
											<NetValueLabels
												items={buildNetValueItemsHorizontalStacked({
													data,
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

									{/* Render diff column for this group */}
									{diffColumn.active && diffColumn.category && (
										<Group top={startY}>
											<DiffColumn
												diffColumn={diffColumn}
												innerHeight={height}
												innerWidth={innerWidth}
												flattenedData={data}
												scale={groupScale}
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
											variation={dataRender.groupBreaks?.breakStyles?.variation || 'solid'}
											stroke={dataRender.groupBreaks?.breakStyles?.stroke || '#A4A4A4'}
											strokeWidth={dataRender.groupBreaks?.breakStyles?.strokeWidth || 1.4}
											strokeDasharray={
												dataRender.groupBreaks?.breakStyles?.strokeDasharray || 'none'
											}
										/>
									)}
								</Group>
							);
						})}

						{/* Render custom axis for grouped data */}
						{independentAxis.active && (
							<>
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
							<AxisBottom
								{...dependentAxisProps}
								top={actualContentHeight}
								scale={dependentScale}
								numTicks={scaledNumTicks}
							/>
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

export default StackedBarHorizontal;

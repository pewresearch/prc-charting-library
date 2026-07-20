// REACT
import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

// @prc/charting-utilities
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
	scaleAxisNumTicks,
	useSize,
} from '@prc/charting-utilities';

// TYPES
import type { BaseConfig, FlatData, GroupedData, Size, TableData } from '@prc/charting-utilities';

// VISX
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarGroupHorizontal } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';

// OTHER LIBRARIES

// COMPONENTS
import { DiffColumn } from './DiffColumn';
import { buildNetValueItemsHorizontalGrouped, NetValueLabels } from '../labels/NetValueLabels';
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

const BarHorizontal = () => {
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
		bar,
		diffColumn,
		netValues,
		events,
		annotations,
		drawings,
	} = config;
	// SIZE AND LAYOUT
	const { width, height, parentClass, padding } = layout;
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
	const flattenedData = getFlattenedData(data);

	// DATA ACCESSORS
	const getIndependentValue = (d: FlatData) => d[dataRender.x].toString();

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
			padding: bar.barGroupPadding,
		});
	}, [groupedData, getIndependentValue, innerHeight, bar.barGroupPadding]);

	// GROUP POSITIONING - Calculate actualContentHeight
	const { groupPositioning, actualContentHeight } = useMemo(
		() => getGroupPositioningHorizontal(groupedData, dataRender, independentScale, innerHeight),
		[groupedData, dataRender, independentScale, innerHeight]
	);

	const keyScale = useMemo(
		() =>
			scaleBand<string>({
				domain: dataRender.categories,
				padding: bar.barPadding,
			}),
		[dataRender.categories, bar.barPadding]
	);
	const dependentScale = useMemo(
		() =>
			scaleLinear({
				domain: dependentAxis.domain,
				range: [0, innerWidth],
				nice: true,
			}),
		[innerWidth, dependentAxis.domain]
	);
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: dataRender.categories,
				range: colors,
			}),
		[dataRender.categories, colors]
	);
	const getSeriesColor = useCallback(
		(category: string, baseColor: string, rowHighlighted?: boolean) => {
			if (rowHighlighted) {
				return dataRender.isHighlightedColor;
			}

			return resolveCategoryColor({
				category,
				fallback: baseColor,
				dataRender,
			});
		},
		[dataRender]
	);
	const getSeriesOpacity = useCallback(
		(category: string, rowHighlighted?: boolean) => {
			if (rowHighlighted) {
				return 1;
			}

			return resolveCategoryOpacity({
				category,
				dataRender,
			});
		},
		[dataRender]
	);
	dependentScale.rangeRound([0, innerWidth]);
	independentScale.rangeRound([0, innerHeight]);
	keyScale.rangeRound([0, independentScale.bandwidth()]);

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
				chartType: 'horizontal bar chart',
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
			<div style={{ position: 'relative' }}>
				<svg
					width={chartWidth}
					height={dataRender.groupBreaksActive ? actualContentHeight + padding.top + padding.bottom : height}
					ref={svgRef}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
					onClick={(event) => {
						events?.click?.(null, event);
					}}
					{...ariaProps}
				>
					<Group top={padding.top} left={padding.left} role="presentation">
						<GridColumns {...dependentGridProps} />

						{/* Render grouped bar charts with breaks */}
						{groupPositioning.map((groupPos, groupIndex) => {
							const { group, data, startY, height, breakHeight } = groupPos;

							// Create scales for this group:
							// - groupScale: for positioning bars relative to the group's startY
							// - gridScale: for grid lines within the group (range starts at 0)
							const groupScale = scaleBand<string>({
								domain: data.map(getIndependentValue),
								range: [0, height],
								padding: bar.barGroupPadding,
							});

							const gridScale = scaleBand<string>({
								domain: data.map(getIndependentValue),
								range: [0, height],
								padding: bar.barGroupPadding,
							});

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

									<Group top={startY}>
										<BarGroupHorizontal
											data={data}
											keys={dataRender.categories}
											height={height}
											width={innerWidth}
											y0={getIndependentValue}
											y0Scale={groupScale}
											y1Scale={keyScale}
											xScale={dependentScale}
											color={colorScale}
											style={{
												overflowX: overflow as CSSProperties['overflowX'],
											}}
										>
											{(barGroups) => {
												return barGroups.map((barGroup, i) => {
													const independentValue = data.map(getIndependentValue)[i];
													return (
														<Group
															key={`bar-group-horizontal-${groupIndex}-${barGroup.index}-${barGroup.y0}`}
															top={barGroup.y0}
														>
															{barGroup.bars.map((bar) => {
																// check if there are custom labels or tooltips in the data model
																const customLabelText = getCustomLabelText(
																	data[i],
																	bar.key
																);
																const customLabel =
																	customLabelText || getCustomLabel(data[i], bar.key);
																const { body: customTooltip, header: customHeader } =
																	getCustomTooltip(data[i], bar.key);
																const isHighlighted =
																	data[i].__isHighlighted?.[bar.key];

																// Get custom shape styles (group-aware key)
																const groupValue = getGroupValue(data[i], dataRender);
																const shapeKey = generateElementKey(
																	independentValue,
																	bar.key,
																	groupValue
																);
																const customShapeStyles =
																	shapes?.customStyles?.[shapeKey] || {};
																const defaultColor = getSeriesColor(
																	bar.key,
																	bar.color,
																	isHighlighted
																);
																// Apply custom styles with fallbacks
																const shapeFill =
																	customShapeStyles.fill || defaultColor;
																const shapeStroke =
																	customShapeStyles.stroke || undefined;
																const shapeStrokeWidth =
																	customShapeStyles.strokeWidth || undefined;
																const shapeOpacity =
																	(customShapeStyles.opacity ?? 1) *
																	getSeriesOpacity(bar.key, isHighlighted);

																return (
																	<g
																		key={`${groupIndex}-${barGroup.index}-${bar.index}-${bar.key}`}
																	>
																		<AnimatedBar
																			orientation="horizontal"
																			x={bar.x}
																			y={bar.y}
																			tabIndex={0}
																			width={Math.abs(bar.width)}
																			height={bar.height}
																			fill={shapeFill}
																			stroke={shapeStroke}
																			strokeWidth={shapeStrokeWidth}
																			opacity={shapeOpacity}
																			fillOpacity={
																				tooltipData &&
																				tooltipVisible &&
																				tooltip.deemphasizeSiblings &&
																				(tooltipData?.x !== independentValue ||
																					tooltipData?.y !== bar.value ||
																					tooltipData?.key !== bar.key)
																					? tooltip.deemphasizeOpacity
																					: 1
																			}
																			style={{
																				cursor: wpEditorFunctions?.shapes
																					? 'pointer'
																					: undefined,
																				pointerEvents: wpEditorFunctions?.shapes
																					? 'all'
																					: undefined,
																			}}
																			onClick={(event: React.MouseEvent) => {
																				if (
																					wpEditorFunctions?.shapes?.onClick
																				) {
																					wpEditorFunctions.shapes.onClick(
																						data[i],
																						bar.key,
																						defaultColor,
																						event.currentTarget,
																						groupValue
																					);
																				}
																			}}
																			onMouseLeave={() => {
																				tooltipTimeout = window.setTimeout(
																					() => {
																						hideTooltip();
																					},
																					300
																				);
																			}}
																			onMouseMove={(event) => {
																				if (tooltipTimeout)
																					clearTimeout(tooltipTimeout);
																				if (!svgRef.current) return;
																				const eventSvgCoords = getLocalPoint(
																					svgRef.current,
																					event
																				);
																				const coords = eventSvgCoords || {
																					x: 0,
																					y: 0,
																				};
																				showTooltip({
																					tooltipData: {
																						x: independentValue,
																						y: bar.value,
																						key: bar.key,
																						customTooltip,
																						customHeader,
																						fill: bar.color,
																					},
																					tooltipTop: coords.y,
																					tooltipLeft: coords.x,
																				});
																			}}
																			onBlur={() => {
																				tooltipTimeout = window.setTimeout(
																					() => {
																						hideTooltip();
																					},
																					300
																				);
																			}}
																			onFocus={() => {
																				if (tooltipTimeout)
																					clearTimeout(tooltipTimeout);
																				showTooltip({
																					tooltipLeft: bar.x,
																					tooltipTop: bar.y,
																					tooltipData: {
																						x: independentValue,
																						y: bar.value,
																						key: bar.key,
																						customTooltip,
																						fill: bar.color,
																					},
																				});
																			}}
																		/>
																		{bar.value && labels.active && (
																			<AnimatedBarLabel
																				key={`bar-group-horizontal-${groupIndex}-${barGroup.index}-${barGroup.y0}-label`}
																				{...positionBarLabel(
																					bar,
																					labels,
																					labelCutoff,
																					'horizontal',
																					'single'
																				)}
																				dataPoint={data[i]}
																				category={bar.key}
																				defaultDx={0}
																				defaultDy={0}
																				chartInnerWidth={innerWidth}
																				chartInnerHeight={innerHeight}
																				fill={getBarLabelFill(
																					labels.color,
																					labels.labelPositionBar,
																					bar.value,
																					labelCutoff,
																					getSeriesColor(
																						bar.key,
																						bar.color,
																						isHighlighted
																					),
																					bar.color
																				)}
																				fillOpacity={
																					tooltipData &&
																					tooltipVisible &&
																					tooltip.deemphasizeSiblings &&
																					(tooltipData?.x !==
																						independentValue ||
																						tooltipData?.y !== bar.value ||
																						tooltipData?.key !== bar.key)
																						? tooltip.deemphasizeOpacity
																						: 1
																				}
																				{...labelProps}
																			>
																				{customLabel ||
																					`${getLabelFormat(
																						bar.value,
																						bar.key,
																						labels,
																						null
																					)}`}
																			</AnimatedBarLabel>
																		)}
																	</g>
																);
															})}
														</Group>
													);
												});
											}}
										</BarGroupHorizontal>
									</Group>

									{/* Net value labels (positive / right) */}
									{netValues.active && netValues.positive.category && (
										<Group top={startY}>
											<NetValueLabels
												items={buildNetValueItemsHorizontalGrouped({
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
						{independentAxis.active && (
							<>
								{/* Render custom axis for grouped data */}
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data, startY, height } = groupPos;

									// Create individual scale for this group's axis
									const groupScale = scaleBand<string>({
										domain: data.map(getIndependentValue),
										range: [startY, startY + height],
										padding: bar.barGroupPadding,
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
										{tooltipData.customHeader
											? tooltipData.customHeader
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
								__html: tooltipData.customTooltip
									? tooltipData.customTooltip
									: getTooltipFormat(
											{
												x: tooltipData.x,
												y: tooltipData.y,
												category: tooltipData.key,
												color: resolveCategoryColor({
													category: tooltipData.key,
													fallback: colorScale(tooltipData.key),
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

export default BarHorizontal;

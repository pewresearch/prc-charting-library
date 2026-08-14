import { useContext, useMemo, useRef, RefObject, useCallback, CSSProperties } from 'react';

import {
	DataContext,
	useSize,
	getBarLabelFill,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	getLabelFormat,
	positionBarLabel,
	getChartDimensions,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	getFlattenedData,
	getGroupedData,
	createGroupBandScale,
	linearBarSpan,
	getGroupPositioningVertical,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
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
	ZeroBaseline,
} from '../overlays';
import { AnimatedBar, AnimatedBarLabel, TransitionProvider } from '../animation';
import { NetValueLabels, buildNetValueItemsVerticalGrouped } from '../labels/NetValueLabels';
import type { FlatData, Size, BaseConfig, TableData, GroupedData } from '@prc/charting-utilities';

import { BarGroup } from '@visx/shape';
import { Group } from '@visx/group';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleLinear, scaleBand, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { ascending, descending } from 'd3-array';
import { LegendOrdinal } from '@visx/legend';

const BarVertical = () => {
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
		annotations,
		drawings,
		netValues,
	} = config;

	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	// DATA PROCESSING
	const flattenedData = useMemo(() => {
		const processed = getFlattenedData(data);
		// this feels counterintuitive, but we need to sort the data backwards so that it renders in the correct order
		processed.sort((a: FlatData, b: FlatData) => {
			if (dataRender.sortOrder === 'ascending') {
				return descending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			if (dataRender.sortOrder === 'descending') {
				return ascending(a[dataRender.sortKey], b[dataRender.sortKey]);
			}
			return 0;
		});
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
			range: [0, innerWidth],
			padding: bar.barGroupPadding,
		});
	}, [groupedData, getIndependentValue, innerWidth, bar.barGroupPadding]);

	// GROUP POSITIONING - Calculate actualContentWidth
	const { groupPositioning, actualContentWidth } = useMemo(
		() => getGroupPositioningVertical(groupedData, dataRender, independentScale, innerWidth),
		[groupedData, dataRender, independentScale, innerWidth]
	);

	const calculatedChartWidth = useMemo(() => {
		return dataRender.groupBreaksActive ? actualContentWidth + padding.left + padding.right : size.width || width;
	}, [dataRender.groupBreaksActive, actualContentWidth, padding, size.width, width]);
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
				// Null/auto domains fall back to the data extent; visx would
				// otherwise silently keep d3's default [0, 1].
				domain: resolveLinearScaleDomain(
					dependentAxis.domain,
					getLinearValueDataExtent(flattenedData, dataRender.categories)
				),
				range: [innerHeight, 0],
				nice: resolveScaleNice(dependentAxis.nice, hasExplicitAxisDomain(dependentAxis.domain)),
			}),
		[innerHeight, dependentAxis.domain, dependentAxis.nice, flattenedData, dataRender.categories]
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
	dependentScale.rangeRound([innerHeight, 0]);
	independentScale.rangeRound([0, innerWidth]);
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
				chartType: 'column chart',
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
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
					{...ariaProps}
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
								bar.barGroupPadding
							);

							const gridScale = createGroupBandScale(
								data.map(getIndependentValue),
								[0, width],
								bar.barGroupPadding
							);

							const groupKeyScale = scaleBand<string>({
								domain: dataRender.categories,
								padding: bar.barPadding,
							});
							groupKeyScale.rangeRound([0, groupScale.bandwidth()]);

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
											numTicks={data.length}
										/>
									</Group>

									<BarGroup
										data={data}
										keys={dataRender.categories}
										height={innerHeight}
										width={width}
										x0={getIndependentValue}
										x0Scale={groupScale}
										x1Scale={groupKeyScale}
										yScale={dependentScale}
										color={colorScale}
									>
										{(barGroups) => {
											return barGroups.map((barGroup, i) => {
												const independentValue = data[i][dataRender.x].toString();
												return (
													<Group
														key={`bar-group-${groupIndex}-${barGroup.index}-${barGroup.x0}`}
														left={barGroup.x0}
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
															const isHighlighted = data[i].__isHighlighted?.[bar.key];

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
															const shapeFill = customShapeStyles.fill || defaultColor;
															const shapeStroke = customShapeStyles.stroke || undefined;
															const shapeStrokeWidth =
																customShapeStyles.strokeWidth || undefined;
															const shapeOpacity =
																(customShapeStyles.opacity ?? 1) *
																getSeriesOpacity(bar.key, isHighlighted);

															const {
																start: y,
																size: height,
																baseline,
																valueAtStart,
															} = linearBarSpan(dependentScale, bar.value);

															return (
																<g
																	key={`${groupIndex}-${barGroup.index}-${bar.index}-${bar.key}`}
																>
																	<AnimatedBar
																		x={bar.x}
																		y={y}
																		tabIndex={0}
																		width={Math.abs(bar.width)}
																		height={height}
																		baseline={baseline}
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
																			if (wpEditorFunctions?.shapes?.onClick) {
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
																			tooltipTimeout = window.setTimeout(() => {
																				hideTooltip();
																			}, 300);
																		}}
																		onMouseMove={(event: any) => {
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
																					...data[i],
																					y: bar.value,
																					key: bar.key,
																					customTooltip,
																					customHeader,
																				},
																				tooltipTop: coords.y,
																				tooltipLeft: coords.x,
																			});
																		}}
																		onBlur={() => {
																			tooltipTimeout = window.setTimeout(() => {
																				hideTooltip();
																			}, 300);
																		}}
																		onFocus={() => {
																			if (tooltipTimeout)
																				clearTimeout(tooltipTimeout);
																			showTooltip({
																				tooltipLeft: bar.x,
																				tooltipTop: y,
																				tooltipData: {
																					...data[i],
																					y: bar.value,
																					key: bar.key,
																					customTooltip,
																					customHeader,
																					fill: bar.color,
																				},
																			});
																		}}
																	/>
																	{bar.value && labels.active && (
																		<AnimatedBarLabel
																			key={`bar-group-label-${groupIndex}-${barGroup.index}-${barGroup.x0}`}
																			{...positionBarLabel(
																				{ ...bar, y, height, valueAtStart },
																				labels,
																				labels.labelCutoff,
																				'vertical',
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
																				labels.labelCutoff,
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
																				(tooltipData?.x !== independentValue ||
																					tooltipData?.y !== bar.value ||
																					tooltipData?.key !== bar.key)
																					? tooltip.deemphasizeOpacity
																					: 1
																			}
																			{...labelProps}
																		>
																			{customLabel ||
																				getLabelFormat(
																					bar.value,
																					bar.key,
																					labels,
																					null
																				)}
																		</AnimatedBarLabel>
																	)}
																</g>
															);
														})}
													</Group>
												);
											});
										}}
									</BarGroup>

									{/* Net value labels (above bars) */}
									{netValues.active && netValues.positive.category && (
										<Group>
											<NetValueLabels
												items={buildNetValueItemsVerticalGrouped({
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
											variation={dataRender.groupBreaks?.breakStyles?.variation || 'empty'}
										/>
									)}
								</Group>
							);
						})}
						<ZeroBaseline
							scale={dependentScale}
							along="x"
							length={actualContentWidth}
							stroke={dependentAxis.axis.stroke}
							strokeWidth={dependentAxis.axis.strokeWidth}
						/>

						{/* Render custom axis for grouped data */}
						{independentAxis.active && (
							<>
								{groupPositioning.map((groupPos, groupIndex) => {
									const { data, startX, width } = groupPos;

									// Create individual scale for this group's axis
									const groupScale = createGroupBandScale(
										data.map(getIndependentValue),
										[startX, startX + width],
										bar.barGroupPadding
									);

									return (
										<AxisBottom
											key={`axis-${groupIndex}`}
											{...independentAxisProps}
											numTicks={independentAxis.tickCount}
											tickValues={(independentAxis.tickValues as string[]) || undefined}
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

export default BarVertical;

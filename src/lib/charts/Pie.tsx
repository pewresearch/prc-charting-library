/* eslint-disable @wordpress/no-unused-vars-before-return */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */
import { useContext, useMemo, useRef, RefObject, CSSProperties } from 'react';

import {
	DataContext,
	getLabelFill,
	useSize,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	getLabelFormat,
	getChartDimensions,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	getFlattenedData,
	getGroupedData,
	getGroupPositioningPie,
} from '@prc/charting-utilities';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../overlays';
import {
	AnimatedArc,
	AnimatedPieGroupSeparatorArc,
	AnimatedLabel,
	TransitionProvider,
	PieRevealProvider,
	PIE_FULL_TURN,
} from '../animation';
import type { FlatData, Size, BaseConfig, TableData } from '@prc/charting-utilities';

import { Pie as VisxPie } from '@visx/shape';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { useTooltip } from '@visx/tooltip';
import { scaleOrdinal } from '@visx/scale';

const Pie = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const {
		layout,
		labels,
		shapes,
		colors,
		tooltip,
		legend,
		dataRender,
		pie: pieConfigRaw,
		annotations,
		drawings,
	} = config;

	// Ensure pieConfig has defaults for group properties
	const pieConfig = {
		...pieConfigRaw,
		// Ensure group properties have defaults if not provided
		groupGapAngle: pieConfigRaw?.groupGapAngle ?? 10, // Explode offset in pixels
		showGroupArcs: pieConfigRaw?.showGroupArcs ?? false,
		groupArcStyle: {
			stroke: '#666666',
			strokeWidth: 1,
			strokeDasharray: '4,4',
			...pieConfigRaw?.groupArcStyle,
		},
	};

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	const radius = Math.min(innerWidth, innerHeight) / 2;
	const centerY = innerHeight / 2;
	const centerX = innerWidth / 2;
	const top = centerY + padding.top;
	const left = centerX + padding.left;

	// DATA PROCESSING
	const flattenedData = useMemo(() => getFlattenedData(data), [data]);

	// ACCESSORS
	const getIndependentValue = (d: any) => d.x;
	const category = dataRender.categories[0];
	const getDependentValue = useMemo(() => (d: any) => d[category], [category]);

	// GROUP BREAKS PROCESSING
	const groupedData = useMemo(() => getGroupedData(flattenedData, dataRender), [flattenedData, dataRender]);

	// PIE GROUP POSITIONING - Calculate angular positions for each group
	const pieGroupPositioning = useMemo(
		() => getGroupPositioningPie(groupedData, dataRender, pieConfig, getDependentValue),
		[groupedData, dataRender, pieConfig, getDependentValue]
	);

	// Check if grouping is active
	const isGrouped = dataRender.groupBreaksActive && groupedData.length > 1;

	// For ungrouped pies, we still need a sort function
	const pieSortValues = (a: number, b: any) => {
		if (dataRender.sortOrder === 'ascending') {
			return a - b;
		}
		if (dataRender.sortOrder === 'descending') {
			return b - a;
		}
		return 0;
	};

	// SCALES
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: flattenedData.map(getIndependentValue),
				range: colors,
			}),
		[flattenedData, colors]
	);
	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'pie chart',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);
	// TOOLTIP
	const {
		tooltipOpen,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipData,
		hideTooltip,
		showTooltip,
	} = useTooltip<FlatData>();
	let tooltipTimeout: number;

	return (
		<TransitionProvider data={data} family="pie">
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
					<Group top={top} left={left} role="presentation">
						{/* Render pie slices - grouped or ungrouped */}
						{isGrouped ? (
							// GROUPED PIE: Render each group with explode offset
							pieGroupPositioning.map((groupPos, groupIndex) => {
								const { group, data: groupData, startAngle, endAngle, explodeOffset } = groupPos;

								// Calculate the direction to push this group (midpoint of its angular range)
								const midAngle = (startAngle + endAngle) / 2;
								// Convert to SVG coordinates (0 = 12 o'clock, clockwise)
								const translateX = Math.sin(midAngle) * explodeOffset;
								const translateY = -Math.cos(midAngle) * explodeOffset;

								return (
									<Group
										key={`pie-group-${groupIndex}-${group}`}
										transform={`translate(${translateX}, ${translateY})`}
									>
										<PieRevealProvider pieStartAngle={startAngle} pieEndAngle={endAngle}>
											<VisxPie
												data={groupData}
												pieValue={getDependentValue}
												pieSortValues={pieSortValues}
												outerRadius={radius}
												startAngle={startAngle}
												endAngle={endAngle}
											>
												{(pie) =>
													pie.arcs.map((arc, index) => {
														const { x } = arc.data;
														const depVal = getDependentValue(arc.data);
														const customLabelText = getCustomLabelText(
															arc.data,
															dataRender.categories[0]
														);
														const customLabel =
															customLabelText ||
															getCustomLabel(arc.data, dataRender.categories[0]);
														const defaultLabel = getLabelFormat(
															depVal,
															String(x),
															labels,
															null
														);

														const [centroidX, centroidY] = pie.path.centroid(arc);
														const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;

														const sliceColor = colorScale(String(x));

														// Get custom shape styles - for pie, use x value as the unique identifier (group-aware)
														const groupValue = getGroupValue(arc.data, dataRender);
														const shapeKey = generateElementKey(
															x,
															dataRender.categories[0],
															groupValue
														);
														const customShapeStyles =
															shapes?.customStyles?.[shapeKey] || {};
														const defaultColor = sliceColor;

														// Apply custom styles with fallbacks
														const shapeFill = customShapeStyles.fill || defaultColor;
														const shapeStroke =
															customShapeStyles.stroke ||
															(pieConfig.hasPathStroke
																? pieConfig.pathStrokeColor
																: undefined);
														const shapeStrokeWidth =
															customShapeStyles.strokeWidth ||
															(pieConfig.hasPathStroke
																? pieConfig.pathStrokeWidth
																: undefined);
														const shapeOpacity = customShapeStyles.opacity ?? 1;

														const showLabel = hasSpaceForLabel && labels.active;

														return (
															<g key={`arc-${groupIndex}-${x}-${index}`}>
																<AnimatedArc
																	startAngle={arc.startAngle}
																	endAngle={arc.endAngle}
																	buildArc={(s, e) =>
																		pie.path({
																			...arc,
																			startAngle: s,
																			endAngle: e,
																		}) || ''
																	}
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
																				arc.data,
																				dataRender.categories[0],
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
																		arc.data !== tooltipData
																			? tooltip.deemphasizeOpacity
																			: 1
																	}
																	onBlur={() => {
																		tooltipTimeout = window.setTimeout(() => {
																			hideTooltip();
																		}, 300);
																	}}
																	onFocus={(event) => {
																		event.preventDefault();
																		if (tooltipTimeout)
																			clearTimeout(tooltipTimeout);
																		const arcData = {
																			...arc.data,
																			color: sliceColor,
																		};
																		showTooltip({
																			tooltipData: arcData,
																			tooltipTop: centroidY,
																			tooltipLeft: centroidX,
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
																		);
																		const arcData = {
																			...arc.data,
																			color: sliceColor,
																		};
																		showTooltip({
																			tooltipData: arcData,
																			tooltipTop: eventSvgCoords!.y,
																			tooltipLeft: eventSvgCoords!.x,
																		});
																	}}
																/>
																{showLabel && (
																	<AnimatedLabel
																		x={centroidX}
																		y={centroidY}
																		dataPoint={arc.data}
																		category={dataRender.categories[0]}
																		defaultDx={0}
																		defaultDy={0}
																		chartInnerWidth={innerWidth}
																		chartInnerHeight={innerHeight}
																		defaultLabel={defaultLabel}
																		fill={getLabelFill({
																			labelColor: labels.color,
																			seriesColor: sliceColor,
																		})}
																		fillOpacity={
																			tooltipData &&
																			tooltipVisible &&
																			tooltip.deemphasizeSiblings &&
																			arc.data !== tooltipData
																				? tooltip.deemphasizeOpacity
																				: 1
																		}
																		{...labelProps}
																	>
																		{customLabel || defaultLabel}
																	</AnimatedLabel>
																)}
															</g>
														);
													})
												}
											</VisxPie>
										</PieRevealProvider>
										{pieConfig.showGroupArcs && (
											<AnimatedPieGroupSeparatorArc
												startAngle={startAngle}
												endAngle={endAngle}
												arcRadius={radius + 5}
												stroke={pieConfig.groupArcStyle?.stroke || '#666'}
												strokeWidth={pieConfig.groupArcStyle?.strokeWidth || 1}
												strokeDasharray={pieConfig.groupArcStyle?.strokeDasharray || '4,4'}
												strokeLinecap="round"
											/>
										)}
									</Group>
								);
							})
						) : (
							// UNGROUPED PIE: Original single pie rendering
							<VisxPie
								data={flattenedData}
								pieValue={getDependentValue}
								pieSortValues={pieSortValues}
								outerRadius={radius}
								startAngle={0}
								endAngle={PIE_FULL_TURN}
							>
								{(pie) => (
									<PieRevealProvider pieStartAngle={0} pieEndAngle={PIE_FULL_TURN}>
										{pie.arcs.map((arc, index) => {
											const { x } = arc.data;
											const depVal = getDependentValue(arc.data);
											const customLabelText = getCustomLabelText(
												arc.data,
												dataRender.categories[0]
											);
											const customLabel =
												customLabelText || getCustomLabel(arc.data, dataRender.categories[0]);
											const defaultLabel = getLabelFormat(depVal, String(x), labels, null);

											const [centroidX, centroidY] = pie.path.centroid(arc);
											const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;

											// Get custom shape styles - for pie, use x value as the unique identifier (group-aware)
											const groupValue = getGroupValue(arc.data, dataRender);
											const shapeKey = generateElementKey(
												x,
												dataRender.categories[0],
												groupValue
											);
											const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
											const sliceColor = colorScale(String(x));
											const defaultColor = sliceColor;

											// Apply custom styles with fallbacks
											const shapeFill = customShapeStyles.fill || defaultColor;
											const shapeStroke =
												customShapeStyles.stroke ||
												(pieConfig.hasPathStroke ? pieConfig.pathStrokeColor : undefined);
											const shapeStrokeWidth =
												customShapeStyles.strokeWidth ||
												(pieConfig.hasPathStroke ? pieConfig.pathStrokeWidth : undefined);
											const shapeOpacity = customShapeStyles.opacity ?? 1;

											const showLabel = hasSpaceForLabel && labels.active;

											return (
												<g key={`arc-${x}-${index}`}>
													<AnimatedArc
														startAngle={arc.startAngle}
														endAngle={arc.endAngle}
														buildArc={(s, e) =>
															pie.path({ ...arc, startAngle: s, endAngle: e }) || ''
														}
														fill={shapeFill}
														stroke={shapeStroke}
														strokeWidth={shapeStrokeWidth}
														opacity={shapeOpacity}
														style={{
															cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
															pointerEvents: wpEditorFunctions?.shapes
																? 'all'
																: undefined,
														}}
														onClick={(event: React.MouseEvent) => {
															if (wpEditorFunctions?.shapes?.onClick) {
																wpEditorFunctions.shapes.onClick(
																	arc.data,
																	dataRender.categories[0],
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
															arc.data !== tooltipData
																? tooltip.deemphasizeOpacity
																: 1
														}
														onBlur={() => {
															tooltipTimeout = window.setTimeout(() => {
																hideTooltip();
															}, 300);
														}}
														onFocus={(event) => {
															event.preventDefault();
															if (tooltipTimeout) clearTimeout(tooltipTimeout);
															const arcData = {
																...arc.data,
																color: sliceColor,
															};
															showTooltip({
																tooltipData: arcData,
																tooltipTop: centroidY,
																tooltipLeft: centroidX,
															});
														}}
														onMouseLeave={() => {
															tooltipTimeout = window.setTimeout(() => {
																hideTooltip();
															}, 300);
														}}
														onMouseMove={(event) => {
															event.preventDefault();
															if (tooltipTimeout) clearTimeout(tooltipTimeout);
															if (!svgRef.current) return;
															const eventSvgCoords = getLocalPoint(svgRef.current, event);
															const arcData = {
																...arc.data,
																color: sliceColor,
															};
															showTooltip({
																tooltipData: arcData,
																tooltipTop: eventSvgCoords!.y,
																tooltipLeft: eventSvgCoords!.x,
															});
														}}
													/>
													{showLabel && (
														<AnimatedLabel
															x={centroidX}
															y={centroidY}
															dataPoint={arc.data}
															category={dataRender.categories[0]}
															defaultDx={0}
															defaultDy={0}
															chartInnerWidth={innerWidth}
															chartInnerHeight={innerHeight}
															defaultLabel={defaultLabel}
															fill={getLabelFill({
																labelColor: labels.color,
																seriesColor: sliceColor,
															})}
															fillOpacity={
																tooltipData &&
																tooltipVisible &&
																tooltip.deemphasizeSiblings &&
																arc.data !== tooltipData
																	? tooltip.deemphasizeOpacity
																	: 1
															}
															{...labelProps}
														>
															{customLabel || defaultLabel}
														</AnimatedLabel>
													)}
												</g>
											);
										})}
									</PieRevealProvider>
								)}
							</VisxPie>
						)}

						{/* Category labels */}
						{pieConfig.showCategoryLabels &&
							(isGrouped ? (
								// GROUPED: Draggable category labels for each group with explode offset
								pieGroupPositioning.map((groupPos, groupIndex) => {
									const { data: groupData, startAngle, endAngle, explodeOffset } = groupPos;

									// Calculate the offset direction for this group
									const midAngle = (startAngle + endAngle) / 2;
									const translateX = Math.sin(midAngle) * explodeOffset;
									const translateY = -Math.cos(midAngle) * explodeOffset;

									return (
										<Group
											key={`draggable-category-labels-group-${groupIndex}`}
											transform={`translate(${translateX}, ${translateY})`}
										>
											<VisxPie
												data={groupData}
												pieValue={getDependentValue}
												pieSortValues={pieSortValues}
												innerRadius={radius + 20}
												outerRadius={radius + 40}
												startAngle={startAngle}
												endAngle={endAngle}
											>
												{(pie) => {
													return pie.arcs.map((arc, index) => {
														const indepVal = getIndependentValue(arc.data);
														const [centroidX, centroidY] = pie.path.centroid(arc);
														const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;

														if (!hasSpaceForLabel) return null;

														return (
															<AnimatedLabel
																key={`draggable-category-label-${groupIndex}-${index}`}
																x={centroidX}
																y={centroidY}
																dataPoint={arc.data}
																category={'__categoryLabel'}
																defaultDx={0}
																defaultDy={0}
																chartInnerWidth={innerWidth}
																chartInnerHeight={innerHeight}
																fill={'#000'}
																fillOpacity={
																	tooltipData &&
																	tooltipVisible &&
																	tooltip.deemphasizeSiblings &&
																	arc.data !== tooltipData
																		? tooltip.deemphasizeOpacity
																		: 1
																}
																{...labelProps}
															>
																{indepVal}
															</AnimatedLabel>
														);
													});
												}}
											</VisxPie>
										</Group>
									);
								})
							) : (
								// UNGROUPED: Original draggable category labels
								<VisxPie
									data={flattenedData}
									pieValue={getDependentValue}
									pieSortValues={pieSortValues}
									innerRadius={radius + 20}
									outerRadius={radius + 40}
								>
									{(pie) => {
										return pie.arcs.map((arc, index) => {
											const indepVal = getIndependentValue(arc.data);
											const [centroidX, centroidY] = pie.path.centroid(arc);
											const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;

											if (!hasSpaceForLabel) return null;

											return (
												<AnimatedLabel
													key={`draggable-category-label-${index}`}
													x={centroidX}
													y={centroidY}
													dataPoint={arc.data}
													category={'__categoryLabel'}
													defaultDx={0}
													defaultDy={0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={innerHeight}
													fill={'#000'}
													fillOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														arc.data !== tooltipData
															? tooltip.deemphasizeOpacity
															: 1
													}
													{...labelProps}
												>
													{indepVal}
												</AnimatedLabel>
											);
										});
									}}
								</VisxPie>
							))}
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
									fill={(label) => colorScale(label.datum)}
									shapeStyle={legendProps.shapeStyle}
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
										{(() => {
											const { header: pieHdrOvr } = getCustomTooltip(
												tooltipData,
												dataRender.categories[0]
											);
											if (pieHdrOvr) return pieHdrOvr;
											return getTooltipHeaderFormat(
												{
													x: getIndependentValue(tooltipData),
													category: dataRender.categories[0],
												},
												tooltip
											);
										})()}
									</strong>
								</div>
							)}
						</>

						<div>{}</div>
						<div
							dangerouslySetInnerHTML={{
								__html:
									getCustomTooltip(tooltipData, dataRender.categories[0]).body ||
									getTooltipFormat(
										{
											x: getIndependentValue(tooltipData),
											y: getDependentValue(tooltipData),
											category: dataRender.categories[0],
											color: tooltipData.color,
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

export default Pie;

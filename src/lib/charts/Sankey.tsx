/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
import { CSSProperties, RefObject, useContext, useMemo, useRef } from 'react';

import type { BaseConfig, FlatData, SankeyNodeAlign, Size, TableData } from '@prc/charting-utilities';
import {
	DEFAULT_FONT_FAMILY,
	DataContext,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getFlattenedData,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	legendCategoryShapeStyle,
	resolveCategoryColor,
	resolveCategoryOpacity,
	useSize,
} from '@prc/charting-utilities';
import { DraggableLabel } from '../labels';
import { AnnotationsLayer, ClickableLegend, DrawingsLayer, StyledLegend, StyledTooltip } from '../overlays';

import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import type { SankeyNode } from '@visx/sankey';
import { Sankey as VisxSankey, sankeyCenter, sankeyJustify, sankeyLeft, sankeyRight } from '@visx/sankey';
import { scaleOrdinal } from '@visx/scale';
import { BarRounded, LinkHorizontal } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';

// Map alignment strings to d3-sankey alignment functions
const NODE_ALIGNMENTS = {
	center: sankeyCenter,
	justify: sankeyJustify,
	left: sankeyLeft,
	right: sankeyRight,
} as const;

// Types for the Sankey graph data
interface SankeyNodeDatum {
	name: string;
}

interface SankeyLinkDatum {
	source: number;
	target: number;
	value: number;
}

interface SankeyGraphData {
	nodes: SankeyNodeDatum[];
	links: SankeyLinkDatum[];
}

/**
 * Transform FlatData rows (one per link/edge) into the { nodes, links }
 * graph structure that @visx/sankey expects.
 *
 * Each row represents a link: source (x), target, value.
 * @param flatData
 * @param sourceKey
 * @param targetKey
 * @param valueKey
 */
function transformToSankeyGraph(
	flatData: FlatData[],
	sourceKey: string,
	targetKey: string,
	valueKey: string
): SankeyGraphData {
	const nodeNames: string[] = [];
	const nodeIndexMap = new Map<string, number>();

	function getOrCreateNodeIndex(name: string): number {
		if (nodeIndexMap.has(name)) {
			return nodeIndexMap.get(name)!;
		}
		const index = nodeNames.length;
		nodeNames.push(name);
		nodeIndexMap.set(name, index);
		return index;
	}

	const links: SankeyLinkDatum[] = [];

	flatData.forEach((row) => {
		const sourceName = String(row[sourceKey] ?? '');
		const targetName = String(row[targetKey] ?? '');
		const value = Number(row[valueKey]) || 0;

		if (!sourceName || !targetName || value <= 0) {
			return;
		}

		const sourceIndex = getOrCreateNodeIndex(sourceName);
		const targetIndex = getOrCreateNodeIndex(targetName);

		links.push({
			source: sourceIndex,
			target: targetIndex,
			value,
		});
	});

	return {
		nodes: nodeNames.map((name) => ({ name })),
		links,
	};
}

// Tooltip data type
interface SankeyTooltipData {
	type: 'node' | 'link';
	name: string;
	value: number;
	sourceName?: string;
	targetName?: string;
	color: string;
}

const SankeyChart = () => {
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
		sankey: sankeyConfig,
		annotations,
		drawings,
	} = config;

	// LAYOUT
	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	// DATA PROCESSING
	const flattenedData = useMemo(() => getFlattenedData(data), [data]);

	// Build graph data from flat rows
	const graphData = useMemo(
		() =>
			transformToSankeyGraph(
				flattenedData,
				sankeyConfig.sourceKey,
				sankeyConfig.targetKey,
				sankeyConfig.valueKey
			),
		[flattenedData, sankeyConfig.sourceKey, sankeyConfig.targetKey, sankeyConfig.valueKey]
	);

	// Build a map of node name -> representative FlatData data point.
	// For Sankey, each node needs a data point that DraggableLabel and
	// customization utilities can read. Unlike bar/line charts where each
	// data row maps 1:1 to a label, Sankey nodes are derived from source
	// and target columns — target-only nodes don't appear as `x` values
	// in the flat data, so the mergeCustomLabelData pipeline won't inject
	// __label* hidden attributes for them.
	//
	// Instead, we build synthetic data points for each node and directly
	// resolve label customizations from config.labels (the source of truth)
	// into the __label* hidden attributes that DraggableLabel expects.
	const nodeDataPoints = useMemo(() => {
		const map = new Map<string, FlatData>();

		// Helper: resolve customization for a node from a "xValue::category" keyed object.
		// For Sankey nodes, x and category are both the node name.
		const resolveCustom = (
			customObj: Record<string, any> | undefined,
			nodeName: string
		): Record<string, any> | undefined => {
			if (!customObj) return undefined;
			const key = `${nodeName}::${nodeName}`;
			const value = customObj[key];
			return value !== undefined ? { [nodeName]: value } : undefined;
		};

		const customPositions = (labels as any)?.customPositions;
		const customLabels = (labels as any)?.customLabels;
		const customVisibility = (labels as any)?.customVisibility;
		const customStyles = (labels as any)?.customStyles;

		// Collect all unique node names from source and target columns
		const allNodeNames = new Set<string>();
		flattenedData.forEach((row) => {
			const sourceName = String(row[sankeyConfig.sourceKey] ?? '');
			const targetName = String(row[sankeyConfig.targetKey] ?? '');
			if (sourceName) allNodeNames.add(sourceName);
			if (targetName) allNodeNames.add(targetName);
		});

		allNodeNames.forEach((nodeName) => {
			// Start with a base data point (use the original row for source nodes if available)
			const sourceRow = flattenedData.find((row) => String(row[sankeyConfig.sourceKey] ?? '') === nodeName);
			const base: FlatData = sourceRow ? { ...sourceRow, x: nodeName } : ({ x: nodeName } as FlatData);

			// Resolve label customizations directly from config.labels
			const positions = resolveCustom(customPositions, nodeName);
			const labelText = resolveCustom(customLabels, nodeName);
			const visibility = resolveCustom(customVisibility, nodeName);
			const styles = resolveCustom(customStyles, nodeName);

			if (positions) {
				base.__labelPositions = {
					...base.__labelPositions,
					...positions,
				};
			}
			if (labelText) {
				base.__labelText = { ...base.__labelText, ...labelText };
			}
			if (visibility) {
				base.__labelVisible = {
					...base.__labelVisible,
					...visibility,
				};
			}
			if (styles) {
				base.__labelStyles = {
					...base.__labelStyles,
					...styles,
				};
			}

			map.set(nodeName, base);
		});

		return map;
	}, [flattenedData, labels, sankeyConfig.sourceKey, sankeyConfig.targetKey]);

	// Node names for color mapping
	const nodeNames = useMemo(() => graphData.nodes.map((n) => n.name), [graphData]);

	// COLOR SCALE
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: nodeNames,
				range: colors,
			}),
		[nodeNames, colors]
	);

	// Node alignment function
	const nodeAlignFn = NODE_ALIGNMENTS[sankeyConfig.nodeAlign as SankeyNodeAlign] || sankeyJustify;

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'sankey',
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
	} = useTooltip<SankeyTooltipData>();
	let tooltipTimeout: number;

	// Ref to store computed node positions from the VisxSankey render callback
	// so editor-mode draggable labels can be rendered outside the callback.
	const nodePositionsRef = useRef<
		Array<{
			name: string;
			x0: number;
			y0: number;
			x1: number;
			y1: number;
			value: number | undefined;
		}>
	>([]);

	// Guard: if graph data is empty (no valid links), render a message
	// rather than letting d3-sankey throw a RangeError on empty arrays.
	if (graphData.nodes.length === 0 || graphData.links.length === 0) {
		return (
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					minHeight: height,
					maxWidth: width,
					color: '#2a2a2a',
					fontFamily: labels.fontFamily?.trim() || DEFAULT_FONT_FAMILY,
					fontSize: '14px',
					opacity: 0.6,
				}}
			>
				No valid Sankey data. Each row needs a source, target, and numeric value.
			</div>
		);
	}

	return (
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
				<Group top={padding.top} left={padding.left} role="presentation">
					<VisxSankey<SankeyNodeDatum, {}>
						root={graphData}
						nodeWidth={sankeyConfig.nodeWidth}
						size={[innerWidth, innerHeight]}
						nodePadding={sankeyConfig.nodePadding}
						nodeAlign={nodeAlignFn}
					>
						{({ graph, createPath }) => {
							// Capture computed node positions for editor-mode labels
							nodePositionsRef.current = graph.nodes.map((node) => ({
								name: node.name,
								x0: node.x0 ?? 0,
								y0: node.y0 ?? 0,
								x1: node.x1 ?? 0,
								y1: node.y1 ?? 0,
								value: node.value,
							}));

							return (
								<>
									{/* Links */}
									<Group>
										{graph.links.map((link, i) => {
											const sourceNode = link.source as SankeyNode<SankeyNodeDatum, {}>;
											const targetNode = link.target as SankeyNode<SankeyNodeDatum, {}>;
											const sourceColor = resolveCategoryColor({
												category: sourceNode.name,
												fallback: colorScale(sourceNode.name),
												dataRender,
											});
											const sourceCategoryOpacity = resolveCategoryOpacity({
												category: sourceNode.name,
												dataRender,
											});

											// Shape key for custom styles
											const shapeKey = `${sourceNode.name}::${targetNode.name}`;
											const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};

											// Links are stroked paths, but the ShapePanel
											// stores colour as `fill`. Accept either property.
											const linkStroke =
												customShapeStyles.fill || customShapeStyles.stroke || sourceColor;
											const linkOpacity =
												(customShapeStyles.opacity ?? sankeyConfig.linkOpacity) *
												sourceCategoryOpacity;

											// Deemphasis when tooltip is active
											const isDeemphasized =
												tooltipData &&
												tooltipVisible &&
												tooltip.deemphasizeSiblings &&
												!(
													tooltipData.sourceName === sourceNode.name ||
													tooltipData.targetName === targetNode.name ||
													tooltipData.name === sourceNode.name ||
													tooltipData.name === targetNode.name
												);

											return (
												<LinkHorizontal
													key={`link-${i}`}
													data={link}
													path={createPath}
													fill="transparent"
													stroke={linkStroke}
													strokeWidth={Math.max(1, link.width ?? 0)}
													strokeOpacity={
														isDeemphasized
															? tooltip.deemphasizeOpacity * linkOpacity
															: linkOpacity
													}
													className="visx-sankey-link"
													style={{
														cursor: wpEditorFunctions?.shapes ? 'pointer' : 'default',
														pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
														transition: 'stroke-opacity 0.15s ease-out',
													}}
													onMouseLeave={() => {
														tooltipTimeout = window.setTimeout(() => {
															hideTooltip();
														}, 300);
													}}
													onMouseMove={(event: any) => {
														if (tooltipTimeout) clearTimeout(tooltipTimeout);
														if (!svgRef.current) return;
														const eventSvgCoords = getLocalPoint(svgRef.current, event);
														const coords = eventSvgCoords || {
															x: 0,
															y: 0,
														};
														showTooltip({
															tooltipData: {
																type: 'link',
																name: `${sourceNode.name} > ${targetNode.name}`,
																value: link.value,
																sourceName: sourceNode.name,
																targetName: targetNode.name,
																color: linkStroke,
															},
															tooltipTop: coords.y,
															tooltipLeft: coords.x,
														});
													}}
													onClick={(event: React.MouseEvent) => {
														if (wpEditorFunctions?.shapes?.onClick) {
															// Find the original flat data row for this link
															const linkDataPoint =
																flattenedData.find(
																	(row) =>
																		String(row[sankeyConfig.sourceKey]) ===
																			sourceNode.name &&
																		String(row[sankeyConfig.targetKey]) ===
																			targetNode.name
																) ||
																({
																	x: sourceNode.name,
																	[sankeyConfig.targetKey]: targetNode.name,
																	[sankeyConfig.valueKey]: link.value,
																} as FlatData);
															wpEditorFunctions.shapes.onClick(
																linkDataPoint,
																targetNode.name,
																sourceColor,
																event.currentTarget
															);
														}
													}}
												/>
											);
										})}
									</Group>

									{/* Nodes */}
									<Group>
										{graph.nodes.map((node, i) => {
											const { y0 = 0, y1 = 0, x0 = 0, x1 = 0 } = node;
											const nodeWidth = x1 - x0;
											const nodeHeight = y1 - y0;
											const nodeColor = resolveCategoryColor({
												category: node.name,
												fallback: colorScale(node.name),
												dataRender,
											});
											const nodeCategoryOpacity = resolveCategoryOpacity({
												category: node.name,
												dataRender,
											});

											// Get the representative data point for this node
											// (carries __label* hidden attributes for customizations)
											const nodeDataPoint =
												nodeDataPoints.get(node.name) ||
												({
													x: node.name,
													value: node.value,
												} as FlatData);

											// Shape key for custom styles
											const shapeKey = `${node.name}::node`;
											const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};

											const shapeFill = customShapeStyles.fill || nodeColor;
											const shapeStroke = customShapeStyles.stroke || nodeColor;
											const shapeOpacity = (customShapeStyles.opacity ?? 1) * nodeCategoryOpacity;

											// Deemphasis
											const isDeemphasized =
												tooltipData &&
												tooltipVisible &&
												tooltip.deemphasizeSiblings &&
												tooltipData.name !== node.name &&
												tooltipData.sourceName !== node.name &&
												tooltipData.targetName !== node.name;

											return (
												<Group key={`node-${i}`}>
													<BarRounded
														x={x0}
														y={y0}
														width={nodeWidth}
														height={nodeHeight}
														radius={sankeyConfig.nodeRadius}
														fill={shapeFill}
														fillOpacity={
															isDeemphasized ? tooltip.deemphasizeOpacity : shapeOpacity
														}
														stroke={shapeStroke}
														strokeWidth={0}
														all
														className="visx-sankey-node"
														style={{
															cursor: wpEditorFunctions?.shapes ? 'pointer' : 'default',
															pointerEvents: wpEditorFunctions?.shapes
																? 'all'
																: undefined,
															transition: 'fill-opacity 0.15s ease-out',
														}}
														tabIndex={0}
														role="img"
														aria-label={`${node.name}: ${node.value}`}
														onClick={(event: React.MouseEvent) => {
															if (wpEditorFunctions?.shapes?.onClick) {
																wpEditorFunctions.shapes.onClick(
																	nodeDataPoint,
																	'node',
																	nodeColor,
																	event.currentTarget
																);
															}
														}}
														onMouseLeave={() => {
															tooltipTimeout = window.setTimeout(() => {
																hideTooltip();
															}, 300);
														}}
														onMouseMove={(event: any) => {
															if (tooltipTimeout) clearTimeout(tooltipTimeout);
															if (!svgRef.current) return;
															const eventSvgCoords = getLocalPoint(svgRef.current, event);
															const coords = eventSvgCoords || {
																x: 0,
																y: 0,
															};
															showTooltip({
																tooltipData: {
																	type: 'node',
																	name: node.name,
																	value: node.value ?? 0,
																	color: shapeFill,
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
															if (tooltipTimeout) clearTimeout(tooltipTimeout);
															showTooltip({
																tooltipData: {
																	type: 'node',
																	name: node.name,
																	value: node.value ?? 0,
																	color: shapeFill,
																},
																tooltipTop: y0 + nodeHeight / 2,
																tooltipLeft: x0 + nodeWidth / 2,
															});
														}}
													/>
													{/* Node labels (frontend / non-editor mode) */}
													{labels.active && !wpEditorFunctions?.labels && (
														<DraggableLabel
															x={x0 < innerWidth / 2 ? x1 + 6 : x0 - 6}
															y={y0 + nodeHeight / 2}
															dataPoint={nodeDataPoint}
															category={node.name}
															defaultDx={0}
															defaultDy={0}
															chartInnerWidth={innerWidth}
															chartInnerHeight={innerHeight}
															defaultLabel={node.name}
															textAnchor={x0 < innerWidth / 2 ? 'start' : 'end'}
															verticalAnchor="middle"
															fontSize={labels.fontSize}
															fontWeight={labels.fontWeight}
															fontFamily={labels.fontFamily}
															fill="#2a2a2a"
														>
															{getCustomLabelText(nodeDataPoint, node.name) ||
																getCustomLabel(nodeDataPoint, node.name) ||
																node.name}
														</DraggableLabel>
													)}
												</Group>
											);
										})}
									</Group>
								</>
							);
						}}
					</VisxSankey>
					{/* Editor-mode draggable labels (rendered outside VisxSankey callback for proper event handling) */}
					{labels.active && wpEditorFunctions?.labels && (
						<Group>
							{nodePositionsRef.current.map((node) => {
								const { x0, y0, x1, y1, name } = node;
								const nodeHeight = y1 - y0;
								const dataPoint =
									nodeDataPoints.get(name) ||
									({
										x: name,
										value: node.value,
									} as FlatData);
								const customLabelText =
									getCustomLabelText(dataPoint, name) || getCustomLabel(dataPoint, name) || name;

								return (
									<DraggableLabel
										key={`editor-label-${name}`}
										x={x0 < innerWidth / 2 ? x1 + 6 : x0 - 6}
										y={y0 + nodeHeight / 2}
										dataPoint={dataPoint}
										category={name}
										defaultDx={0}
										defaultDy={0}
										chartInnerWidth={innerWidth}
										chartInnerHeight={innerHeight}
										defaultLabel={name}
										textAnchor={x0 < innerWidth / 2 ? 'start' : 'end'}
										verticalAnchor="middle"
										fontSize={labels.fontSize}
										fontWeight={labels.fontWeight}
										fontFamily={labels.fontFamily}
										fill="#2a2a2a"
									>
										{customLabelText}
									</DraggableLabel>
								);
							})}
						</Group>
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
						domain={legend.categories.length > 0 ? legend.categories : nodeNames}
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
									{getTooltipHeaderFormat(
										{
											x:
												tooltipData.type === 'link'
													? `${tooltipData.sourceName} \u2192 ${tooltipData.targetName}`
													: tooltipData.name,
											category:
												tooltipData.type === 'link' ? sankeyConfig.valueKey : tooltipData.name,
										},
										tooltip
									)}
								</strong>
							</div>
						)}
					</>
					<div
						dangerouslySetInnerHTML={{
							__html: getTooltipFormat(
								{
									x: tooltipData.name,
									y: tooltipData.value,
									category: sankeyConfig.valueKey,
									color: tooltipData.color,
									data: tooltipData as unknown as Record<string, unknown>,
								},
								tooltip,
								dataRender
							),
						}}
					/>
				</StyledTooltip>
			)}
		</div>
	);
};

export default SankeyChart;

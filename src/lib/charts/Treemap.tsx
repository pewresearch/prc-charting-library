/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */
import { CSSProperties, RefObject, useContext, useMemo, useRef } from 'react';

import type { BaseConfig, FlatData, Size, TableData, TreemapTileMethod } from '@prc/charting-utilities';
import {
	DataContext,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getLabelFill,
	getLabelFormat,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	useSize,
	DEFAULT_FONT_FAMILY,
} from '@prc/charting-utilities';
import { AnnotationsLayer, ClickableLegend, DrawingsLayer, StyledLegend, StyledTooltip } from '../overlays';
import { DraggableLabel, wordWrap } from '../labels';

import { Group } from '@visx/group';
import {
	Treemap as VisxTreemap,
	hierarchy,
	treemapBinary,
	treemapDice,
	treemapResquarify,
	treemapSlice,
	treemapSliceDice,
	treemapSquarify,
} from '@visx/hierarchy';
import { LegendOrdinal } from '@visx/legend';
import { scaleLinear, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
// Map tile method strings to d3 tiling functions
const TILE_METHODS = {
	squarify: treemapSquarify,
	binary: treemapBinary,
	dice: treemapDice,
	slice: treemapSlice,
	sliceDice: treemapSliceDice,
	resquarify: treemapResquarify,
} as const;

// Build a d3-hierarchy tree from flat data + group breaks
interface TreeNode {
	name: string;
	value?: number;
	children?: TreeNode[];
	/** Original flat data row (only on leaf nodes) */
	datum?: FlatData;
	/** Group name this node belongs to */
	group?: string;
}

function hasTreemapGroupValue(value: unknown): boolean {
	return value !== null && value !== undefined && value !== '';
}

function buildHierarchy(
	flatData: FlatData[],
	valueKey: string,
	groupKey: string | null,
	orderedGroups?: string[] | null
): TreeNode {
	if (!groupKey) {
		// No grouping — single-level treemap
		return {
			name: 'root',
			children: flatData.map((d) => ({
				name: String(d.x),
				value: Number(d[valueKey]) || 0,
				datum: d,
			})),
		};
	}

	// Group data by the groupKey field; skip rows with blank group values.
	const groups = new Map<string, FlatData[]>();
	flatData.forEach((d) => {
		const raw = d[groupKey];
		if (!hasTreemapGroupValue(raw)) {
			return;
		}
		const key = String(raw);
		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(d);
	});

	// Determine the order in which groups should be rendered.
	// When an explicit order is provided (from dataRender.groupBreaksCategoryValues),
	// treat it as authoritative: only render groups named in it, in that order. The Sorter
	// UI populates this array from all available groups and drops any the editor disables,
	// so this is the single source of truth for "which groups to show and in what order."
	let orderedEntries: Array<[string, FlatData[]]>;
	if (orderedGroups && orderedGroups.length > 0) {
		orderedEntries = orderedGroups
			.filter((name) => groups.has(name))
			.map((name) => [name, groups.get(name)!] as [string, FlatData[]]);
	} else {
		orderedEntries = Array.from(groups.entries());
	}

	return {
		name: 'root',
		children: orderedEntries.map(([groupName, items]) => ({
			name: groupName,
			group: groupName,
			children: items.map((d) => ({
				name: String(d.x),
				value: Number(d[valueKey]) || 0,
				datum: d,
				group: groupName,
			})),
		})),
	};
}

// Tooltip data type for treemap
interface TreemapTooltipData {
	name: string;
	value: number;
	group?: string;
	color: string;
	datum?: FlatData;
	/**
	 * The same category key used by the popover when writing customTooltips.
	 * For grouped treemaps this is the group name; for ungrouped it is valueKey.
	 * Stored on tooltipData so the render path resolves __tooltips with the
	 * exact key the editor wrote.
	 */
	category: string;
}

const TreemapChart = () => {
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
		treemap: treemapConfig,
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

	// Determine grouping
	const groupKey = dataRender.groupBreaksActive ? (dataRender.groupBreaksCategory ?? null) : null;
	const valueKey = dataRender.categories[0] || 'y';

	// Optional manual ordering for groups, sourced from the Data panel's "Group Order" Sorter.
	// When set, it wins over value-descending at depth 1 so editors control the category sequence.
	const orderedGroups: string[] | null = useMemo(() => {
		const raw = dataRender.groupBreaksCategoryValues;
		return Array.isArray(raw) && raw.length > 0 ? raw.map((v) => String(v)) : null;
	}, [dataRender.groupBreaksCategoryValues]);

	// Resolve the user-configurable leaf sort order from the shared dataRender control.
	// Defaults to 'descending' to match classic treemap hierarchy when unset; 'none'
	// preserves insertion order (d3 sort is stable).
	const sortOrder: 'descending' | 'ascending' | 'none' =
		(dataRender.sortOrder as 'descending' | 'ascending' | 'none') ?? 'descending';

	// Build hierarchy
	const root = useMemo(() => {
		const treeData = buildHierarchy(flattenedData, valueKey, groupKey, orderedGroups);
		return hierarchy<TreeNode>(treeData)
			.sum((d) => d.value ?? 0)
			.sort((a, b) => {
				// Depth 1 = groups. Manual Group Order (from the Data panel Sorter) takes
				// precedence when set; otherwise groups follow the configured sort order.
				if (a.depth === 1 && b.depth === 1) {
					if (orderedGroups && orderedGroups.length > 0) return 0;
				}
				if (sortOrder === 'none') return 0;
				const av = a.value ?? 0;
				const bv = b.value ?? 0;
				return sortOrder === 'ascending' ? av - bv : bv - av;
			});
	}, [flattenedData, valueKey, groupKey, orderedGroups, sortOrder]);

	// Get unique group names for color mapping
	const groupNames = useMemo(() => {
		if (!groupKey) {
			// No grouping: each leaf item is its own "group" for coloring
			return flattenedData.map((d) => String(d.x));
		}
		const names = new Set<string>();
		flattenedData.forEach((d) => {
			const raw = d[groupKey];
			if (hasTreemapGroupValue(raw)) {
				names.add(String(raw));
			}
		});
		// Honor the manual group order (drives color scale domain + legend fallback).
		// Stay consistent with buildHierarchy: authoritative list, no leftovers.
		if (orderedGroups && orderedGroups.length > 0) {
			return orderedGroups.filter((name) => names.has(name));
		}
		return Array.from(names);
	}, [flattenedData, groupKey, orderedGroups]);

	// COLOR SCALES
	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: groupNames,
				range: colors,
			}),
		[groupNames, colors]
	);

	// Per-group opacity scales (when scaleOpacity is enabled)
	const opacityScales = useMemo(() => {
		if (!treemapConfig.scaleOpacity || !groupKey) {
			return null;
		}

		const scales: Record<string, (val: number) => number> = {};
		const groups = new Map<string, number[]>();

		flattenedData.forEach((d) => {
			const raw = d[groupKey];
			if (!hasTreemapGroupValue(raw)) {
				return;
			}
			const group = String(raw);
			if (!groups.has(group)) {
				groups.set(group, []);
			}
			groups.get(group)!.push(Number(d[valueKey]) || 0);
		});

		groups.forEach((values, group) => {
			const min = Math.min(...values);
			const max = Math.max(...values);
			const scale = scaleLinear<number>({
				domain: [min, max],
				range: treemapConfig.opacityRange,
			});
			scales[group] = (val: number) => scale(val) ?? treemapConfig.opacityRange[1];
		});

		return scales;
	}, [flattenedData, groupKey, valueKey, treemapConfig.scaleOpacity, treemapConfig.opacityRange]);

	// Tile method
	const tileMethod = TILE_METHODS[treemapConfig.tile as TreemapTileMethod] || treemapSquarify;

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'treemap',
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
	} = useTooltip<TreemapTooltipData>();
	let tooltipTimeout: number;

	// Helper: get color for a leaf node
	function getNodeColor(node: any): string {
		if (groupKey) {
			// Color by group
			const group = node.data?.group ?? node.parent?.data?.name ?? '';
			return colorScale(group);
		}
		// No grouping — color by item name
		return colorScale(node.data?.name ?? '');
	}

	// Helper: get opacity for a leaf node
	function getNodeOpacity(node: any): number {
		if (!treemapConfig.scaleOpacity || !opacityScales || !groupKey) {
			return 1;
		}
		const group = node.data?.group ?? node.parent?.data?.name ?? '';
		const scale = opacityScales[group];
		if (!scale) {
			return 1;
		}
		return scale(node.value ?? 0);
	}

	// Helper: get the category key for shape/label customization
	// For treemaps the "category" in the key is the group name (or valueKey if ungrouped)
	function getShapeCategory(node: any): string {
		if (groupKey) {
			return node.data?.group ?? node.parent?.data?.name ?? valueKey;
		}
		return valueKey;
	}

	function resolveTextFill(shapeFill: string, groupColor: string): string {
		return getLabelFill({ labelColor: labels.color, seriesColor: groupColor, backgroundHex: shapeFill });
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
					<VisxTreemap<TreeNode>
						root={root}
						size={[innerWidth, innerHeight]}
						tile={tileMethod}
						paddingInner={treemapConfig.paddingInner}
						paddingOuter={treemapConfig.paddingOuter}
						round
					>
						{(treemap) => (
							<Group>
								{treemap.descendants().map((node, i) => {
									const nodeWidth = (node.x1 ?? 0) - (node.x0 ?? 0);
									const nodeHeight = (node.y1 ?? 0) - (node.y0 ?? 0);
									const nodeArea = nodeWidth * nodeHeight;

									// Skip the root node
									if (node.depth === 0) {
										return null;
									}

									// Skip group nodes (depth === 1 with children) — groups have no visual
									// representation of their own; the legend communicates group identity.
									if (node.depth === 1 && node.children) {
										return null;
									}

									// Leaf nodes
									const defaultColor = getNodeColor(node);
									const opacity = getNodeOpacity(node);
									const shapeCategory = getShapeCategory(node);

									// Read custom shape styles from popover customization
									const shapeKey = `${node.data.name}::${shapeCategory}`;
									const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};

									// Apply custom styles with fallbacks
									const shapeFill = customShapeStyles.fill || defaultColor;
									const shapeStroke = customShapeStyles.stroke || treemapConfig.rectStroke;
									const shapeStrokeWidth =
										customShapeStyles.strokeWidth ?? treemapConfig.rectStrokeWidth;
									const shapeOpacity = customShapeStyles.opacity ?? opacity;

									const textFill = resolveTextFill(shapeFill, defaultColor);

									// Build a datum-like object for DraggableLabel (needs x property)
									const leafDatum =
										node.data.datum ||
										({
											x: node.data.name,
											[valueKey]: node.value,
										} as FlatData);

									// Label content
									const customLabelText = getCustomLabelText(leafDatum, shapeCategory);
									const customLabel = customLabelText || getCustomLabel(leafDatum, shapeCategory);
									const defaultLabel = customLabel || node.data.name;

									// Value label
									const formattedValue = getLabelFormat(node.value ?? 0, valueKey, labels, null);

									// Determine if we have room for labels and values
									const hasRoomForLabel = labels.active && nodeArea > treemapConfig.labelMinArea;
									const hasRoomForValue =
										labels.active &&
										treemapConfig.showValues &&
										nodeArea > treemapConfig.labelMinArea * 1.5;

									// Constrain labels to rect width so long names wrap instead of bleeding out.
									// Inset 4px per side for visual breathing room; clamp to a minimum so word-wrap
									// has something to work with on very narrow tiles.
									const labelMaxWidth = Math.max(24, nodeWidth - 8);

									// Pre-measure wrapped line counts so the value label sits below the
									// actual rendered name block (otherwise it overlaps when the name wraps).
									// Mirrors DraggableLabel's lineHeight = fontSize * 1.2.
									const nameFontSize = labels.fontSize;
									const valueFontSize = labels.fontSize - 1;
									const fontFamilyForMeasure = labels.fontFamily || DEFAULT_FONT_FAMILY;
									const nameLineCount = hasRoomForLabel
										? wordWrap(
												String(defaultLabel),
												labelMaxWidth,
												nameFontSize,
												fontFamilyForMeasure
											).length
										: 0;
									const valueLineCount = hasRoomForValue
										? wordWrap(
												String(formattedValue),
												labelMaxWidth,
												valueFontSize,
												fontFamilyForMeasure
											).length
										: 0;
									const nameLineHeight = nameFontSize * 1.2;
									const valueLineHeight = valueFontSize * 1.2;
									const interLabelGap = 4;
									const nameBlockHeight =
										nameLineCount > 0 ? (nameLineCount - 1) * nameLineHeight + nameFontSize : 0;
									const valueBlockHeight =
										valueLineCount > 0 ? (valueLineCount - 1) * valueLineHeight + valueFontSize : 0;
									const totalBlockHeight =
										nameBlockHeight +
										valueBlockHeight +
										(nameBlockHeight && valueBlockHeight ? interLabelGap : 0);
									// labelBaseY is the baseline of the first line of the name label.
									// Center the combined block vertically; offset by nameFontSize so the
									// first baseline sits at the top of the centered block (text is drawn
									// above its baseline).
									const labelBaseY =
										nodeHeight / 2 - totalBlockHeight / 2 + (nameBlockHeight ? nameFontSize : 0);
									const valueBaseY =
										labelBaseY +
										(nameBlockHeight
											? (nameLineCount - 1) * nameLineHeight + interLabelGap + valueFontSize
											: 0);

									return (
										<Group key={`leaf-${node.data.name}-${i}`} top={node.y0} left={node.x0}>
											<rect
												width={nodeWidth}
												height={nodeHeight}
												fill={shapeFill}
												fillOpacity={
													tooltipData &&
													tooltipVisible &&
													tooltip.deemphasizeSiblings &&
													tooltipData.name !== node.data.name
														? tooltip.deemphasizeOpacity
														: shapeOpacity
												}
												stroke={shapeStroke}
												strokeWidth={shapeStrokeWidth}
												rx={treemapConfig.borderRadius}
												ry={treemapConfig.borderRadius}
												style={{
													cursor: wpEditorFunctions?.shapes ? 'pointer' : 'default',
													pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
													transition: 'fill-opacity 0.15s ease-out',
												}}
												tabIndex={0}
												role="img"
												aria-label={`${node.data.name}: ${node.value}`}
												onClick={(event: React.MouseEvent) => {
													if (wpEditorFunctions?.shapes?.onClick) {
														wpEditorFunctions.shapes.onClick(
															leafDatum,
															shapeCategory,
															defaultColor,
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
															name: node.data.name,
															value: node.value ?? 0,
															group: node.data.group ?? node.parent?.data?.name,
															color: shapeFill,
															datum: node.data.datum,
															category: shapeCategory,
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
															name: node.data.name,
															value: node.value ?? 0,
															group: node.data.group ?? node.parent?.data?.name,
															color: shapeFill,
															datum: node.data.datum,
															category: shapeCategory,
														},
														tooltipTop: (node.y0 ?? 0) + nodeHeight / 2,
														tooltipLeft: (node.x0 ?? 0) + nodeWidth / 2,
													});
												}}
											/>
											{/* Leaf name label */}
											{hasRoomForLabel && !wpEditorFunctions?.labels && (
												<DraggableLabel
													{...labelProps}
													x={nodeWidth / 2}
													y={labelBaseY}
													dataPoint={leafDatum}
													category={shapeCategory}
													defaultDx={labels.labelPositionDX || 0}
													defaultDy={labels.labelPositionDY || 0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={innerHeight}
													defaultLabel={defaultLabel}
													maxWidth={labelMaxWidth}
													fill={textFill}
													fillOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														tooltipData.name !== node.data.name
															? tooltip.deemphasizeOpacity
															: 1
													}
													textAnchor="middle"
												>
													{defaultLabel}
												</DraggableLabel>
											)}
											{/* Value label below name */}
											{hasRoomForValue && !wpEditorFunctions?.labels && (
												<DraggableLabel
													x={nodeWidth / 2}
													y={valueBaseY}
													dataPoint={leafDatum}
													category={`${shapeCategory}__value`}
													defaultDx={labels.labelPositionDX || 0}
													defaultDy={labels.labelPositionDY || 0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={innerHeight}
													defaultLabel={formattedValue}
													maxWidth={labelMaxWidth}
													fill={textFill}
													fillOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														tooltipData.name !== node.data.name
															? tooltip.deemphasizeOpacity
															: 1
													}
													textAnchor="middle"
													fontSize={labels.fontSize - 1}
													fontWeight={300}
													fontFamily={labels.fontFamily}
												>
													{formattedValue}
												</DraggableLabel>
											)}
										</Group>
									);
								})}
							</Group>
						)}
					</VisxTreemap>
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
				{/* Draggable labels — rendered outside the main Group for proper event capture */}
				{labels.active && wpEditorFunctions?.labels && (
					<Group top={padding.top} left={padding.left}>
						<VisxTreemap<TreeNode>
							root={root}
							size={[innerWidth, innerHeight]}
							tile={tileMethod}
							paddingInner={treemapConfig.paddingInner}
							paddingOuter={treemapConfig.paddingOuter}
							round
						>
							{(treemap) => (
								<Group>
									{treemap.leaves().map((node, i) => {
										const nodeWidth = (node.x1 ?? 0) - (node.x0 ?? 0);
										const nodeHeight = (node.y1 ?? 0) - (node.y0 ?? 0);
										const nodeArea = nodeWidth * nodeHeight;

										if (nodeArea <= treemapConfig.labelMinArea) {
											return null;
										}

										const defaultColor = getNodeColor(node);
										const shapeCategory = getShapeCategory(node);
										const shapeKey = `${node.data.name}::${shapeCategory}`;
										const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
										const shapeFill = customShapeStyles.fill || defaultColor;
										const textFill = resolveTextFill(shapeFill, defaultColor);

										const leafDatum =
											node.data.datum ||
											({
												x: node.data.name,
												[valueKey]: node.value,
											} as FlatData);

										const customLabelText = getCustomLabelText(leafDatum, shapeCategory);
										const customLabel = customLabelText || getCustomLabel(leafDatum, shapeCategory);
										const defaultLabelStr = customLabel || node.data.name;
										const formattedValue = getLabelFormat(node.value ?? 0, valueKey, labels, null);

										const hasRoomForValue =
											treemapConfig.showValues && nodeArea > treemapConfig.labelMinArea * 1.5;

										const labelMaxWidth = Math.max(24, nodeWidth - 8);

										// Pre-measure wrapped line counts (see notes in the non-editor pass).
										const nameFontSize = labels.fontSize;
										const valueFontSize = labels.fontSize - 1;
										const fontFamilyForMeasure = labels.fontFamily || DEFAULT_FONT_FAMILY;
										const nameLineCount = wordWrap(
											String(defaultLabelStr),
											labelMaxWidth,
											nameFontSize,
											fontFamilyForMeasure
										).length;
										const valueLineCount = hasRoomForValue
											? wordWrap(
													String(formattedValue),
													labelMaxWidth,
													valueFontSize,
													fontFamilyForMeasure
												).length
											: 0;
										const nameLineHeight = nameFontSize * 1.2;
										const valueLineHeight = valueFontSize * 1.2;
										const interLabelGap = 4;
										const nameBlockHeight = (nameLineCount - 1) * nameLineHeight + nameFontSize;
										const valueBlockHeight =
											valueLineCount > 0
												? (valueLineCount - 1) * valueLineHeight + valueFontSize
												: 0;
										const totalBlockHeight =
											nameBlockHeight + valueBlockHeight + (valueBlockHeight ? interLabelGap : 0);
										const labelBaseY = nodeHeight / 2 - totalBlockHeight / 2 + nameFontSize;
										const valueBaseY =
											labelBaseY +
											(nameLineCount - 1) * nameLineHeight +
											interLabelGap +
											valueFontSize;

										return (
											<Group key={`draggable-leaf-${i}`}>
												<DraggableLabel
													{...labelProps}
													x={(node.x0 ?? 0) + nodeWidth / 2}
													y={(node.y0 ?? 0) + labelBaseY}
													dataPoint={leafDatum}
													category={shapeCategory}
													defaultDx={labels.labelPositionDX || 0}
													defaultDy={labels.labelPositionDY || 0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={innerHeight}
													defaultLabel={defaultLabelStr}
													maxWidth={labelMaxWidth}
													fill={textFill}
													fillOpacity={
														tooltipData &&
														tooltipVisible &&
														tooltip.deemphasizeSiblings &&
														tooltipData.name !== node.data.name
															? tooltip.deemphasizeOpacity
															: 1
													}
													textAnchor="middle"
												>
													{defaultLabelStr}
												</DraggableLabel>
												{/* Value below name — also draggable */}
												{hasRoomForValue && (
													<DraggableLabel
														x={(node.x0 ?? 0) + nodeWidth / 2}
														y={(node.y0 ?? 0) + valueBaseY}
														dataPoint={leafDatum}
														category={`${shapeCategory}__value`}
														defaultDx={labels.labelPositionDX || 0}
														defaultDy={labels.labelPositionDY || 0}
														chartInnerWidth={innerWidth}
														chartInnerHeight={innerHeight}
														defaultLabel={formattedValue}
														maxWidth={labelMaxWidth}
														fill={textFill}
														fillOpacity={
															tooltipData &&
															tooltipVisible &&
															tooltip.deemphasizeSiblings &&
															tooltipData.name !== node.data.name
																? tooltip.deemphasizeOpacity
																: 1
														}
														textAnchor="middle"
														fontSize={labels.fontSize - 1}
														fontWeight={300}
														fontFamily={labels.fontFamily}
													>
														{formattedValue}
													</DraggableLabel>
												)}
											</Group>
										);
									})}
								</Group>
							)}
						</VisxTreemap>
					</Group>
				)}
			</svg>
			{legend.active && (
				<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
					<LegendOrdinal
						{...legendProps}
						scale={colorScale}
						domain={legend.categories.length > 0 ? legend.categories : groupNames}
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
						{tooltip.headerActive && tooltipData.group && (
							<div
								style={{
									marginBottom: '10px',
								}}
							>
								<strong>
									{(() => {
										const { header: treeHdr } = getCustomTooltip(
											tooltipData.datum ?? {},
											tooltipData.category
										);
										if (treeHdr) {
											return treeHdr;
										}
										return getTooltipHeaderFormat(
											{
												x: tooltipData.group,
												category: valueKey,
											},
											tooltip
										);
									})()}
								</strong>
							</div>
						)}
					</>
					<div
						dangerouslySetInnerHTML={{
							__html:
								getCustomTooltip(tooltipData.datum ?? {}, tooltipData.category).body ||
								getTooltipFormat(
									{
										x: tooltipData.name,
										y: tooltipData.value,
										category: valueKey,
										color: tooltipData.color,
										data: (tooltipData.datum ?? tooltipData) as Record<string, unknown>,
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

export default TreemapChart;

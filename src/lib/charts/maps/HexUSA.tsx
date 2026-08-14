import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

import type { BaseConfig } from '@prc/charting-utilities';
import type { Size } from '@prc/charting-utilities';
import { FlatData } from '@prc/charting-utilities';
import type { TableData } from '@prc/charting-utilities';

import { DataContext } from '@prc/charting-utilities';
import {
	getLabelFill,
	useSize,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	generateElementKey,
	useStateGridData,
} from '@prc/charting-utilities';
import {
	getChartDimensions,
	getTooltipHeaderFormat,
	getTooltipFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
} from '@prc/charting-utilities';

import { Group } from '@visx/group';
import { scaleLinear, scaleOrdinal, scaleThreshold } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../../overlays';
import { DraggableLabel } from '../../labels';
import { EventType } from '@visx/event/lib/types';

// Reuse the same grid layout as BlockUSA — hexagons are rendered at
// the same column/row positions but with hex-grid offset tiling.
const loadHexGrid = createTopologyLoader(() =>
	import('../../data/maps/usa/heatmap.json').then((module) => module.default)
);

const SQRT3 = Math.sqrt(3);

/**
 * Generate SVG polygon `points` attribute for a flat-top hexagon.
 *
 * Flat-top orientation: the top and bottom edges are horizontal.
 * Vertices start at 0° (right) and proceed counter-clockwise at 60° steps.
 */
function hexPointsString(cx: number, cy: number, r: number): string {
	return Array.from({ length: 6 }, (_, i) => {
		const angleDeg = 60 * i;
		const angleRad = (Math.PI / 180) * angleDeg;
		return `${cx + r * Math.cos(angleRad)},${cy + r * Math.sin(angleRad)}`;
	}).join(' ');
}

/**
 * HexUSA — A hex-tile cartogram of the United States.
 *
 * Each state is rendered as a flat-top hexagon on an offset grid.
 * The grid positions come from the same heatmap.json used by BlockUSA;
 * odd columns are offset downward by half a row to create a honeycomb
 * tiling pattern. Color encoding uses the same scale infrastructure
 * as all other map components (threshold / ordinal / linear).
 */
const HexUSA = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	// Suspense-compatible resource loading
	const states = loadHexGrid();

	const { layout, colors, dataRender, labels, legend, tooltip, shapes, annotations, drawings, map } = config;

	// SIZE AND LAYOUT
	const {parentClass, padding, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	let size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, overflow } = getChartDimensions(size, layout);
	let isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const mergedData = useStateGridData({ grid: states, rows: data });

	// ---------------------------------------------------------------------------
	// Hex-grid geometry
	// ---------------------------------------------------------------------------
	// The grid has 12 columns (indices 0–11) and 8 rows (indices 0–7).
	// Flat-top hexagons:
	//   Column spacing (center to center): 1.5 × hexSize
	//   Row spacing (center to center):    √3  × hexSize
	//   Odd-column vertical offset:        √3/2 × hexSize
	//
	// Total width  ≈ (numCols - 1) × 1.5 × hexSize + 2 × hexSize = 18.5 × hexSize
	// Total height ≈ (numRows - 1) × √3 × hexSize + √3 × hexSize + √3/2 × hexSize
	//              = 8.5 × √3 × hexSize
	// ---------------------------------------------------------------------------
	const GRID_WIDTH_FACTOR = 18.5;
	const GRID_HEIGHT_FACTOR = 8.5 * SQRT3;
	const GRID_ASPECT = GRID_HEIGHT_FACTOR / GRID_WIDTH_FACTOR;

	const hexSize = innerWidth / GRID_WIDTH_FACTOR;
	const responsiveInnerHeight = innerWidth * GRID_ASPECT;
	const responsiveChartHeight = responsiveInnerHeight + padding.top + padding.bottom;

	/**
	 * Compute the pixel center of a hexagon given its column/row indices.
	 * Odd columns are shifted down by half a row spacing (honeycomb offset).
	 */
	const getHexCenter = useCallback(
		(col: number, row: number): [number, number] => {
			const cx = col * 1.5 * hexSize + hexSize;
			const cy = row * SQRT3 * hexSize + (col % 2 === 1 ? (SQRT3 / 2) * hexSize : 0) + (SQRT3 / 2) * hexSize;
			return [cx, cy];
		},
		[hexSize]
	);

	// ---------------------------------------------------------------------------
	// Color scales — identical to BlockUSA
	// ---------------------------------------------------------------------------
	const thresholdScale = scaleThreshold<number, string>({
		domain: dataRender.mapScaleDomain as number[],
		range: colors,
	});

	const ordinalScale = scaleOrdinal({
		domain: dataRender.mapScaleDomain as string[],
		range: colors,
	});

	const linearScale = scaleLinear({
		domain: dataRender.mapScaleDomain as number[],
		range: colors.map((c: string) => {
			const m = c.match(/^light-dark\(([^,]+),/);
			return m ? m[1].trim() : c;
		}),
	});

	const getFill = (id: number | string, data: any, category: string) => {
		if (!id) return 'transparent';
		if (!data?.[category]) return '#d7d7d7';
		if (dataRender.mapScale === 'linear') {
			return linearScale(data?.[category]);
		}
		if (dataRender.mapScale === 'ordinal') {
			return ordinalScale(data?.[category]);
		}
		return thresholdScale(data?.[category]);
	};

	// ---------------------------------------------------------------------------
	// Shared layout props (aria, legend, label styling, etc.)
	// ---------------------------------------------------------------------------
	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the United States, with each state represented as a hexagon',
				config,
				data: mergedData,
				size,
				tableData,
			}),
		[config, mergedData, size, tableData]
	);

	// ---------------------------------------------------------------------------
	// Tooltip
	// ---------------------------------------------------------------------------
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();
	let tooltipTimeout: number;

	// Scale label font size proportionally with hex size, clamped between
	// 7px (sub-pixel floor) and the configured fontSize (never exceed the
	// editor-set value). The 0.9 ratio fits 2-char abbreviations within a hex.
	const labelFontSize = Math.min(labels.fontSize, Math.max(7, hexSize * 0.9));

	return (
		<div
			style={{
				position: 'relative',
				overflowX: overflow as CSSProperties['overflowX'],
			}}
		>
			<svg
				width={chartWidth}
				height={responsiveChartHeight}
				ref={svgRef}
				{...ariaProps}
				style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
			>
				<Group top={padding.top} left={padding.left} role="presentation">
					{(() => {
						const category = dataRender.categories[0];

						// Flatten all valid bins for two-pass rendering
						const allBins = mergedData.flatMap((column: any) =>
							column.bins
								.filter((bin: any) => bin.id)
								.map((bin: any) => ({
									bin,
									col: column.bin as number,
									row: bin.bin as number,
								}))
						);

						const getMouseHandlers = (bin: any) => ({
							onMouseMove: (event: EventType) => {
								if (bin[category] === undefined) return;
								if (tooltipTimeout) clearTimeout(tooltipTimeout);
								if (!svgRef.current) return;
								const eventSvgCoords = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
								const { body: _mapTip, header: _mapHdr } = getCustomTooltip(bin, category);
								showTooltip({
									tooltipData: {
										x: bin.name,
										id: bin.id,
										y: bin[category],
										category,
										fill: getFill(bin.id, bin, category),
										customTooltip: _mapTip,
										customHeader: _mapHdr,
									},
									tooltipTop: eventSvgCoords.y,
									tooltipLeft: eventSvgCoords.x,
								});
							},
							onMouseLeave: () => {
								tooltipTimeout = window.setTimeout(() => {
									hideTooltip();
								}, 300);
							},
						});

						return (
							<>
								{/* Layer 1: All hexagons */}
								{allBins.map(({ bin, col, row }: { bin: any; col: number; row: number }) => {
									const [cx, cy] = getHexCenter(col, row);
									const fill = getFill(bin.id, bin, category);
									const { opacity, stroke, strokeWidth } = getTooltipMapDeemphasisProps(
										tooltip,
										map,
										bin.id,
										tooltipData as FlatData
									);
									const { onMouseMove, onMouseLeave } = getMouseHandlers(bin);

									// Shape customization via popover
									const shapeIdentifier = bin.x || bin.id;
									const shapeKey = generateElementKey(shapeIdentifier, category, null);
									const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
									const shapeFill = customShapeStyles.fill || fill;
									const shapeStroke = customShapeStyles.stroke || stroke;
									const shapeStrokeWidth = customShapeStyles.strokeWidth ?? strokeWidth;
									const shapeOpacity = customShapeStyles.opacity ?? opacity;

									return (
										<polygon
											key={`hex-${col}-${row}`}
											className="visx-heatmap-hex"
											points={hexPointsString(cx, cy, hexSize * 0.95)}
											fill={shapeFill}
											stroke={shapeStroke}
											strokeWidth={shapeStrokeWidth}
											opacity={shapeOpacity}
											tabIndex={0}
											style={{
												cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
												pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
											}}
											onClick={(event: React.MouseEvent) => {
												if (wpEditorFunctions?.shapes?.onClick) {
													const dataPoint = { ...bin, x: bin.x || bin.id };
													wpEditorFunctions.shapes.onClick(
														dataPoint,
														category,
														fill,
														event.currentTarget,
														null
													);
												}
											}}
											onMouseLeave={onMouseLeave}
											onMouseMove={onMouseMove}
											onBlur={onMouseLeave}
											onFocus={onMouseMove}
										/>
									);
								})}
								{/* Layer 2: All labels — rendered after hexes so they
                    always appear on top in SVG paint order */}
								{labels.active &&
									allBins.map(({ bin, col, row }: { bin: any; col: number; row: number }) => {
										const [cx, cy] = getHexCenter(col, row);
										const fill = getFill(bin.id, bin, category);
										const { onMouseMove, onMouseLeave } = getMouseHandlers(bin);

										const shapeIdentifier = bin.x || bin.id;
										const shapeKey = generateElementKey(shapeIdentifier, category, null);
										const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
										const shapeFill = customShapeStyles.fill || fill;

										const customLabelText = getCustomLabelText(bin, category);
										const customLabel = customLabelText || getCustomLabel(bin, category);
										const labelText = customLabel || bin.id;
										const dataPoint = { ...bin, x: bin.x || bin.id };

										return (
											<DraggableLabel
												key={`hex-label-${col}-${row}`}
												x={cx}
												y={cy}
												dataPoint={dataPoint}
												category={category}
												defaultDx={0}
												defaultDy={0}
												chartInnerWidth={innerWidth}
												chartInnerHeight={responsiveInnerHeight}
												defaultLabel={bin.id}
												fill={getLabelFill({
													labelColor: labels.color as
														| 'contrast'
														| 'black'
														| 'white'
														| 'inherit',
													seriesColor: shapeFill,
													backgroundHex: shapeFill,
												})}
												{...labelProps}
												dx={0}
												dy={0}
												textAnchor="middle"
												dominantBaseline="central"
												fontSize={labelFontSize}
											>
												{labelText}
											</DraggableLabel>
										);
									})}
							</>
						);
					})()}
				</Group>
				{annotationsVisible && (
					<AnnotationsLayer
						config={annotations}
						width={chartWidth}
						height={responsiveChartHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
				{drawings?.active && !wpEditorFunctions && (
					<DrawingsLayer
						config={drawings}
						width={chartWidth}
						height={responsiveChartHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
			</svg>
			{legend.active && (
				<StyledLegend
					legend={legend}
					layoutWidth={width}
					layoutHeight={height}
					chartWidth={chartWidth}
					chartHeight={responsiveChartHeight}
				>
					{dataRender.mapScale === 'threshold' && (
						<LegendThreshold
							{...legendProps}
							scale={thresholdScale}
							labelLower={legend.labelLower}
							labelUpper={legend.labelUpper}
							labelDelimiter={legend.labelDelimiter}
						>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => label.value}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendThreshold>
					)}
					{dataRender.mapScale === 'ordinal' && (
						<LegendOrdinal
							{...legendProps}
							scale={ordinalScale}
							domain={legend.categories.length > 0 ? legend.categories : ordinalScale.domain()}
						>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => ordinalScale(label.datum)}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendOrdinal>
					)}
					{dataRender.mapScale === 'linear' && (
						<LegendLinear {...legendProps} scale={linearScale}>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => label.value}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendLinear>
					)}
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
							__html: tooltipData.customTooltip
								? tooltipData.customTooltip
								: getTooltipFormat({
											x: tooltipData.x,
											y: tooltipData.y,
											category: tooltipData.category,
											color: tooltipData.fill,
										data: tooltipData,},
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

export default HexUSA;

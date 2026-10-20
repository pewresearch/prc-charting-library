import { CSSProperties, RefObject, useContext, useMemo, useRef } from 'react';

// TYPES & UTILITIES
import type { BaseConfig, Size, TableData } from '@prc/charting-utilities';
import {
	FlatData,
	DataContext,
	getLabelFill,
	useSize,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	generateElementKey,
	getChartDimensions,
	getTooltipHeaderFormat,
	getTooltipFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
	useStateGridData,
	createValueColorScale,
} from '@prc/charting-utilities';

import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { HeatmapRect } from '@visx/heatmap';
import { useTooltip } from '@visx/tooltip';
import {
	StyledTooltip,
	StyledLegend,
	AnnotationsLayer,
	DrawingsLayer,
	ClickableLegend,
	SeriesPatternDefs,
} from '../../overlays';
import { DraggableLabel } from '../../labels';
import { EventType } from '@visx/event/lib/types';

export type HeatmapProps = {
	width: number;
	height: number;
	margin?: { top: number; right: number; bottom: number; left: number };
	separation?: number;
	events?: boolean;
};

// Create heatmap loader for block USA map
const loadHeatmap = createTopologyLoader(() =>
	import('../../data/maps/usa/heatmap.json').then((module) => module.default)
);

const BlockUSA = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	// Suspense-compatible resource loading
	const states = loadHeatmap();

	const { layout, colors, dataRender, labels, legend, tooltip, shapes, annotations, drawings, map, seriesStyles } =
		config;
	// SIZE AND LAYOUT
	const { parentClass, padding, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const mergedData = useStateGridData({ grid: states, rows: data });

	// Grid dimensions: 13 columns (indices 0-12, domain 0-12.6) × 8 rows (indices 0-7, domain 0-7.4)
	// The aspect ratio ensures the map maintains correct proportions when scaling
	const GRID_COLS_DOMAIN = 12.6;
	const GRID_ROWS_DOMAIN = 7.4;
	const GRID_ASPECT = GRID_ROWS_DOMAIN / GRID_COLS_DOMAIN;

	// Derive bin size from responsive innerWidth (not static config width) so
	// bins scale with the container. The 13.5 divisor provides bins slightly
	// narrower than the column step (innerWidth / 12.6), giving a small gap.
	const binWidth = innerWidth / 13.5;
	const binHeight = binWidth; // 1:1 square bins

	// Scale label font size proportionally with bin size, clamped between
	// 7px (sub-pixel floor) and the configured fontSize (never exceed the
	// editor-set value). The 0.45 ratio fits 2-char abbreviations within a bin.
	const labelFontSize = Math.min(labels.fontSize, Math.max(7, binWidth * 0.45));

	// Responsive inner height preserves square cells by maintaining the grid's
	// natural aspect ratio. This prevents the y-axis from staying fixed while
	// the x-axis compresses, which would distort the bins.
	const responsiveInnerHeight = innerWidth * GRID_ASPECT;
	const responsiveChartHeight = responsiveInnerHeight + padding.top + padding.bottom;

	const xScale = useMemo(
		() =>
			scaleLinear({
				domain: [0, GRID_COLS_DOMAIN],
				range: [0, innerWidth],
			}),
		[innerWidth]
	);

	const yScale = useMemo(
		() =>
			scaleLinear({
				domain: [0, GRID_ROWS_DOMAIN],
				range: [0, responsiveInnerHeight],
			}),
		[responsiveInnerHeight]
	);

	const valueScale = createValueColorScale({
		mode: dataRender.mapScale,
		domain: dataRender.mapScaleDomain,
		colors,
		emptyFill: map.pathBackgroundFill,
		seriesStyles,
		legend,
		legendOrder: legend.categories,
	});

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the United States, with each state represented as a block',
				config,
				data: mergedData,
				size,
				tableData,
			}),
		[config, mergedData, size, tableData]
	);

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
				<SeriesPatternDefs
					seriesStyles={seriesStyles}
					resolveFill={(name) => seriesStyles?.[name]?.fill ?? valueScale.keyFill(name)}
				/>
				<Group top={padding.top} left={padding.left} role="presentation">
					<HeatmapRect
						data={mergedData}
						xScale={xScale}
						yScale={yScale}
						binWidth={binWidth}
						binHeight={binHeight}
						gap={0}
					>
						{(heatmap) => {
							type HeatmapBin = {
								bin: any;
								row: number;
								column: number;
								width: number;
								height: number;
								x: number;
								y: number;
							};

							// Flatten all bins for two-pass rendering: rects first,
							// then labels on top so they're never obscured by
							// adjacent rects in SVG paint order.
							const allBins = heatmap.flatMap((heatmapBins) =>
								heatmapBins.filter((bin: HeatmapBin) => bin.bin?.id)
							);

							const category = dataRender.categories[0];

							const getMouseHandlers = (bin: HeatmapBin) => {
								const { bin: binData } = bin;
								const fill = valueScale.getFill(binData[category]);
								return {
									onMouseMove: (event: EventType) => {
										if (binData[category] === undefined) return;
										if (tooltipTimeout) clearTimeout(tooltipTimeout);
										if (!svgRef.current) return;
										const eventSvgCoords = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
										const { body: _mapTip, header: _mapHdr } = getCustomTooltip(binData, category);
										showTooltip({
											tooltipData: {
												x: binData.name,
												id: binData.id,
												y: binData[category],
												category,
												fill,
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
								};
							};

							return (
								<>
									{/* Layer 1: All rects */}
									{allBins.map((bin: HeatmapBin) => {
										const {
											row,
											column,
											width: rectWidth,
											height: rectHeight,
											x,
											y,
											bin: binData,
										} = bin;
										const fill = valueScale.getFill(binData[category]);
										const { opacity, stroke, strokeWidth } = getTooltipMapDeemphasisProps(
											tooltip,
											map,
											binData.id,
											tooltipData as FlatData
										);
										const { onMouseMove, onMouseLeave } = getMouseHandlers(bin);
										const binPaint = valueScale.getPaint(binData[category], {
											stroke,
											strokeWidth,
											opacity,
										});

										// Shape customization via popover
										const shapeIdentifier = binData.x || binData.id;
										const shapeKey = generateElementKey(shapeIdentifier, category, null);
										const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
										const shapeFill = customShapeStyles.fill || binPaint.fill;
										const shapeStroke = customShapeStyles.stroke || binPaint.stroke;
										const shapeStrokeWidth = customShapeStyles.strokeWidth ?? binPaint.strokeWidth;
										const shapeOpacity = customShapeStyles.opacity ?? binPaint.opacity;

										return (
											<rect
												key={`heatmap-rect-${row}-${column}`}
												className="visx-heatmap-rect"
												width={rectWidth}
												height={rectHeight}
												x={x}
												y={y}
												stroke={shapeStroke}
												strokeWidth={shapeStrokeWidth}
												strokeOpacity={
													customShapeStyles.strokeOpacity ?? binPaint.strokeOpacity
												}
												opacity={shapeOpacity}
												fill={shapeFill}
												tabIndex={0}
												style={{
													cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
													pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
												}}
												onClick={(event: React.MouseEvent) => {
													if (wpEditorFunctions?.shapes?.onClick) {
														const dataPoint = {
															...binData,
															x: binData.x || binData.id,
														};
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
									{/* Layer 2: All labels — rendered after rects so they
                      always appear on top in SVG paint order */}
									{labels.active &&
										allBins.map((bin: HeatmapBin) => {
											const {
												row,
												column,
												width: rectWidth,
												height: rectHeight,
												x,
												y,
												bin: binData,
											} = bin;
											const fill = valueScale.getFill(binData[category]);

											const shapeIdentifier = binData.x || binData.id;
											const shapeKey = generateElementKey(shapeIdentifier, category, null);
											const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
											const shapeFill = customShapeStyles.fill || fill;

											const customLabelText = getCustomLabelText(binData, category);
											const customLabel = customLabelText || getCustomLabel(binData, category);
											const labelText = customLabel || binData.id;

											const cx = x + rectWidth / 2;
											const cy = y + rectHeight / 2;
											const dataPoint = {
												...binData,
												x: binData.x || binData.id,
											};

											return (
												<DraggableLabel
													key={`heatmap-label-${row}-${column}`}
													x={cx}
													y={cy}
													dataPoint={dataPoint}
													category={category}
													seriesKey={String(valueScale.styleKey(binData[category]) ?? '')}
													defaultDx={0}
													defaultDy={0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={responsiveInnerHeight}
													defaultLabel={binData.id}
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
						}}
					</HeatmapRect>
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
					<ClickableLegend
						labels={valueScale.legendItems}
						shape={legend.markerStyle}
						fill={(label) => label.value}
						shapeStyle={legendProps.shapeStyle}
						direction={legend.orientation}
						legendLabelProps={legendProps.legendLabelProps}
					/>
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
								: getTooltipFormat(
										{
											x: tooltipData.x,
											y: tooltipData.y,
											category: tooltipData.category,
											color: tooltipData.fill,
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
	);
};

export default BlockUSA;

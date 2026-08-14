import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef } from 'react';

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
} from '@prc/charting-utilities';

import { Group } from '@visx/group';
import { scaleLinear, scaleOrdinal, scaleThreshold } from '@visx/scale';
import { HeatmapRect } from '@visx/heatmap';
import { useTooltip } from '@visx/tooltip';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../../overlays';
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

	const { layout, colors, dataRender, labels, legend, tooltip, shapes, annotations, drawings, map } = config;
	// SIZE AND LAYOUT
	const {parentClass, padding, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const mergedData = useStateGridData({ grid: states, rows: data });

	const getDependentValue = useCallback((d: FlatData) => d[dataRender.y] as number, [dataRender]);

	const getIndependentValue = useCallback((d: FlatData) => d[dataRender.x] as string, [dataRender]);

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
								const { bin: data, x, y } = bin;
								const fill = getFill(data.id, data, category);
								return {
									onMouseMove: (event: EventType) => {
										if (data[category] === undefined) return;
										if (tooltipTimeout) clearTimeout(tooltipTimeout);
										if (!svgRef.current) return;
										const eventSvgCoords = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
										const { body: _mapTip, header: _mapHdr } = getCustomTooltip(data, category);
										showTooltip({
											tooltipData: {
												x: data.name,
												id: data.id,
												y: data[category],
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
										const { row, column, width, height, x, y, bin: data } = bin;
										const fill = getFill(data.id, data, category);
										const { opacity, stroke, strokeWidth } = getTooltipMapDeemphasisProps(
											tooltip,
											map,
											data.id,
											tooltipData as FlatData
										);
										const { onMouseMove, onMouseLeave } = getMouseHandlers(bin);

										// Shape customization via popover
										const shapeIdentifier = data.x || data.id;
										const shapeKey = generateElementKey(shapeIdentifier, category, null);
										const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
										const shapeFill = customShapeStyles.fill || fill;
										const shapeStroke = customShapeStyles.stroke || stroke;
										const shapeStrokeWidth = customShapeStyles.strokeWidth ?? strokeWidth;
										const shapeOpacity = customShapeStyles.opacity ?? opacity;

										return (
											<rect
												key={`heatmap-rect-${row}-${column}`}
												className="visx-heatmap-rect"
												width={width}
												height={height}
												x={x}
												y={y}
												stroke={shapeStroke}
												strokeWidth={shapeStrokeWidth}
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
															...data,
															x: data.x || data.id,
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
											const { row, column, width, height, x, y, bin: data } = bin;
											const fill = getFill(data.id, data, category);
											const { onMouseMove, onMouseLeave } = getMouseHandlers(bin);

											const shapeIdentifier = data.x || data.id;
											const shapeKey = generateElementKey(shapeIdentifier, category, null);
											const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
											const shapeFill = customShapeStyles.fill || fill;

											const customLabelText = getCustomLabelText(data, category);
											const customLabel = customLabelText || getCustomLabel(data, category);
											const labelText = customLabel || data.id;

											const cx = x + width / 2;
											const cy = y + height / 2;
											const dataPoint = {
												...data,
												x: data.x || data.id,
											};

											return (
												<DraggableLabel
													key={`heatmap-label-${row}-${column}`}
													x={cx}
													y={cy}
													dataPoint={dataPoint}
													category={category}
													defaultDx={0}
													defaultDy={0}
													chartInnerWidth={innerWidth}
													chartInnerHeight={responsiveInnerHeight}
													defaultLabel={data.id}
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

export default BlockUSA;

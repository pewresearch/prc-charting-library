/* eslint-disable no-nested-ternary */
/* eslint-disable max-lines-per-function */
import { useContext, useMemo, useRef, RefObject } from 'react';

import {
	DataContext,
	useSize,
	getChartDimensions,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	getFlattenedData,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getGroupValue,
	generateElementKey,
	getLabelFill,
	DEFAULT_FONT_FAMILY,
} from '@prc/charting-utilities';

import type { FlatData, Size, BaseConfig, TableData } from '@prc/charting-utilities';

import { LineRadial, Line } from '@visx/shape';
import { Group } from '@visx/group';
import { Text } from '@visx/text';
import { scaleLinear, scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { LegendOrdinal } from '@visx/legend';

import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../overlays';
import { DraggableLabel } from '../labels';

const Radar = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const { dependentAxis, layout, colors, dataRender, tooltip, labels, shapes, legend, annotations, drawings } =
		config;

	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight } = getChartDimensions(size, layout);

	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	// Radar layout: centered, radius = min dimension
	const radius = Math.min(innerWidth, innerHeight) / 2;
	const centerX = innerWidth / 2;
	const centerY = innerHeight / 2;

	// DATA
	const flattenedData = useMemo(() => getFlattenedData(data), [data]);
	const categories = dataRender.categories;

	// SCALES
	const radiusScale = useMemo(
		() =>
			scaleLinear({
				domain: dependentAxis.domain,
				range: [0, radius],
				nice: true,
			}),
		[dependentAxis.domain, radius]
	);

	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: flattenedData.map((d) => String(d[dataRender.x])),
				range: colors,
			}),
		[flattenedData, dataRender.x, colors]
	);

	// Convert each row to polygon points (angle, radius) and close the loop
	const polygonData = useMemo(() => {
		return flattenedData.map((row) => {
			const points = categories.map((cat, i) => {
				const value = Number(row[cat]) || 0;
				const angle = -Math.PI / 2 + (i * (2 * Math.PI)) / categories.length;
				return { angle, radius: radiusScale(value) };
			});
			return [...points, points[0]];
		});
	}, [flattenedData, categories, radiusScale]);

	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'radar chart',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
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

	// Grid levels (concentric circles)
	const numLevels = 5;
	const gridLevels = useMemo(
		() =>
			Array.from({ length: numLevels }, (_, i) =>
				radiusScale(
					dependentAxis.domain[0] +
						((dependentAxis.domain[1] - dependentAxis.domain[0]) * (i + 1)) / numLevels
				)
			),
		[radiusScale, dependentAxis.domain]
	);

	return (
		<div style={{ position: 'relative' }}>
			<svg
				width={chartWidth}
				height={height}
				ref={svgRef}
				style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				{...ariaProps}
			>
				<Group top={padding.top + centerY} left={padding.left + centerX}>
					{/* Grid: concentric circles */}
					{gridLevels.map((r, i) => {
						const gridPoints = categories.map((_, idx) => ({
							angle: -Math.PI / 2 + (idx * (2 * Math.PI)) / categories.length,
							radius: r,
						}));
						return (
							<LineRadial
								key={`grid-${i}`}
								data={[...gridPoints, gridPoints[0]]}
								angle={(d) => d.angle}
								radius={(d) => d.radius}
								stroke="#dadbdb"
								strokeWidth={1}
								strokeOpacity={0.6}
								fill="transparent"
							/>
						);
					})}

					{/* Grid: spoke lines */}
					{categories.map((_, i) => {
						const angle = -Math.PI / 2 + (i * (2 * Math.PI)) / categories.length;
						return (
							<Line
								key={`spoke-${i}`}
								from={{ x: 0, y: 0 }}
								to={{
									x: Math.cos(angle) * radius,
									y: Math.sin(angle) * radius,
								}}
								stroke="#dadbdb"
								strokeWidth={1}
								strokeOpacity={0.6}
							/>
						);
					})}

					{/* Axis labels (always show for radar) */}
					{categories.map((cat, i) => {
						const angle = -Math.PI / 2 + (i * (2 * Math.PI)) / categories.length;
						const labelRadius = radius + 20;
						const x = Math.cos(angle) * labelRadius;
						const y = Math.sin(angle) * labelRadius;
						const textAnchor = Math.abs(x) < 5 ? 'middle' : x > 0 ? 'start' : 'end';
						return (
							<Text
								key={`axis-label-${i}`}
								x={x}
								y={y}
								textAnchor={textAnchor}
								verticalAnchor="middle"
								fill={getLabelFill({ labelColor: labels.color || 'black', seriesColor: '#2a2a2a' })}
								fontSize={labels.fontSize || 12}
								fontFamily={labels.fontFamily || DEFAULT_FONT_FAMILY}
							>
								{cat}
							</Text>
						);
					})}

					{/* Data polygons */}
					{polygonData.map((points, rowIndex) => {
						const row = flattenedData[rowIndex];
						const seriesName = String(row[dataRender.x]);
						const defaultColor = colorScale(seriesName);
						const groupValue = getGroupValue(row, dataRender);
						const shapeKey = generateElementKey(seriesName, 'polygon', groupValue);
						const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
						const fill = customShapeStyles.fill || defaultColor;
						const stroke = customShapeStyles.stroke || defaultColor;
						const strokeWidth = customShapeStyles.strokeWidth ?? 2;
						const fillOpacity = customShapeStyles.opacity ?? 0.25;

						return (
							<g key={`polygon-${rowIndex}`}>
								<LineRadial
									data={points}
									angle={(d) => d.angle}
									radius={(d) => d.radius}
									fill={fill}
									stroke={stroke}
									strokeWidth={strokeWidth}
									fillOpacity={
										tooltipData &&
										tooltipVisible &&
										tooltip.deemphasizeSiblings &&
										tooltipData !== row
											? tooltip.deemphasizeOpacity
											: fillOpacity
									}
									style={{
										cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
										pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
									}}
									onClick={(event: React.MouseEvent) => {
										if (wpEditorFunctions?.shapes?.onClick) {
											wpEditorFunctions.shapes.onClick(
												row,
												'polygon',
												defaultColor,
												event.currentTarget,
												groupValue
											);
										}
									}}
									onMouseMove={(event) => {
										if (tooltipTimeout) clearTimeout(tooltipTimeout);
										if (!svgRef.current) return;
										const coords = getLocalPoint(svgRef.current, event) || {
											x: 0,
											y: 0,
										};
										showTooltip({
											tooltipData: row,
											tooltipLeft: coords.x,
											tooltipTop: coords.y,
										});
									}}
									onMouseLeave={() => {
										tooltipTimeout = window.setTimeout(() => hideTooltip(), 300);
									}}
									onBlur={() => {
										tooltipTimeout = window.setTimeout(() => hideTooltip(), 300);
									}}
									onFocus={() => {
										if (tooltipTimeout) clearTimeout(tooltipTimeout);
										const centroidX =
											points.reduce((s, p) => s + Math.cos(p.angle) * p.radius, 0) /
											points.length;
										const centroidY =
											points.reduce((s, p) => s + Math.sin(p.angle) * p.radius, 0) /
											points.length;
										showTooltip({
											tooltipData: row,
											tooltipLeft: padding.left + centerX + centroidX,
											tooltipTop: padding.top + centerY + centroidY,
										});
									}}
								/>
							</g>
						);
					})}
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

				{labels.active && wpEditorFunctions?.labels && (
					<Group top={padding.top + centerY} left={padding.left + centerX}>
						{flattenedData.map((row, rowIndex) => {
							const points = polygonData[rowIndex];
							const centroidX =
								points.reduce((s, p) => s + Math.cos(p.angle) * p.radius, 0) / points.length;
							const centroidY =
								points.reduce((s, p) => s + Math.sin(p.angle) * p.radius, 0) / points.length;
							const seriesName = String(row[dataRender.x]);
							const defaultColor = colorScale(seriesName);

							return (
								<DraggableLabel
									key={`label-${rowIndex}`}
									x={centroidX}
									y={centroidY}
									dataPoint={row}
									category="polygon"
									defaultDx={0}
									defaultDy={0}
									chartInnerWidth={innerWidth}
									chartInnerHeight={innerHeight}
									defaultLabel={seriesName}
									fill={defaultColor}
									{...labelProps}
								>
									{getCustomLabelText(row, 'polygon') || getCustomLabel(row, 'polygon') || seriesName}
								</DraggableLabel>
							);
						})}
					</Group>
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
							<div style={{ marginBottom: '10px' }}>
								<strong>
									{(() => {
										const { header: radarHeader } = getCustomTooltip(tooltipData, 'polygon');
										if (radarHeader) {
											return radarHeader;
										}
										return getTooltipHeaderFormat(
											{
												x: tooltipData[dataRender.x],
												category: 'polygon',
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
								getCustomTooltip(tooltipData, 'polygon').body ||
								getTooltipFormat(
									{
										x: tooltipData[dataRender.x],
										y: null,
										category: 'polygon',
										color: colorScale(String(tooltipData[dataRender.x])),
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

export default Radar;

import { CSSProperties, RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { AxisBottom } from '@visx/axis';
import { GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleLinear, scaleOrdinal } from '@visx/scale';
import { Circle } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { extent, max } from 'd3-array';

import {
	DataContext,
	buildBeeswarmGroupCenters,
	computeBeeswarmForce,
	createPointRadiusScale,
	dodge,
	generateElementKey,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getGroupValue,
	getLocalPoint,
	getMaxAbsColumnValue,
	getMinPositiveColumnValue,
	resolveNodeShapeColors,
	resolvePointRadius,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	resolveCategoryColor,
	resolveCategoryOpacity,
	legendCategoryShapeStyle,
	scaleAxisNumTicks,
	useSize,
} from '@prc/charting-utilities';
import type { BaseConfig, FlatData, Size, TableData } from '@prc/charting-utilities';

import { AnimatedCircle, TransitionProvider } from '../animation';
import { DraggableLabel } from '../labels';
import {
	AnnotationsLayer,
	ClickableLegend,
	ClickableTicks,
	DrawingsLayer,
	StyledLegend,
	StyledTooltip,
} from '../overlays';

const StyledAnimatedCircle = styled(AnimatedCircle)`
	&:focus {
		outline: none;
	}
`;

type LayoutPoint = {
	x: number;
	y: number;
	radius: number;
	data: FlatData;
};

function isNumericValue(value: unknown): value is number {
	if (value === null || value === undefined || value === '') {
		return false;
	}
	return Number.isFinite(Number(value));
}

const BeeSwarm = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: FlatData[][];
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: {
				shapes?: {
					onClick: (
						dataPoint: FlatData,
						shapeKey: string,
						defaultColor: string,
						target: EventTarget,
						groupValue?: string
					) => void;
				};
				labels?: boolean;
				tickLabels?: { onClick: (...args: unknown[]) => void };
			};
		}>
	);

	const {
		beeSwarm,
		independentAxis,
		layout,
		colors,
		nodes,
		dataRender,
		tooltip,
		labels,
		shapes,
		legend,
		annotations,
		drawings,
	} = config;

	const { height, width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>) as Size;
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	const scaledNumTicks = useMemo(
		() => scaleAxisNumTicks(independentAxis.tickCount || 5, chartWidth, width),
		[independentAxis.tickCount, chartWidth, width]
	);

	const flattenedData = useMemo(() => getFlattenedData(data), [data]);

	// `dataRender.x` is the label dimension (first table column); the plotted
	// value lives in a category column, as with every other chart type.
	// get-config backfills `categories` from the non-label columns, so the
	// fallback only applies when this component is driven directly.
	const valueCategory = dataRender.categories?.[0] ?? dataRender.x;

	const filteredData = useMemo(
		() => flattenedData.filter((row) => isNumericValue(row[valueCategory])),
		[flattenedData, valueCategory]
	);

	const getValue = useCallback((row: FlatData) => Number(row[valueCategory]), [valueCategory]);

	const sizeCategory = nodes.sizeCategory || null;

	const sizeScale = useMemo(() => {
		if (!sizeCategory) return null;
		return createPointRadiusScale({
			maxValue: getMaxAbsColumnValue(filteredData, sizeCategory),
			minValue: getMinPositiveColumnValue(filteredData, sizeCategory),
			minRadius: nodes.minPointSize ?? 4,
			maxRadius: nodes.maxPointSize ?? 24,
			scaleType: nodes.sizeScale ?? 'sqrt',
		});
	}, [filteredData, sizeCategory, nodes.minPointSize, nodes.maxPointSize, nodes.sizeScale]);

	const getRadius = useCallback(
		(row: FlatData) =>
			resolvePointRadius({
				d: row as Record<string, unknown>,
				sizeCategory,
				pointSize: nodes.pointSize,
				radiusScale: sizeScale,
			}),
		[sizeCategory, nodes.pointSize, sizeScale]
	);

	const valueScale = useMemo(
		() =>
			scaleLinear({
				domain: extent(filteredData, getValue) as [number, number],
				range: [0, innerWidth],
				nice: true,
			}),
		[filteredData, getValue, innerWidth]
	);

	const dependentScale = useMemo(
		() =>
			scaleLinear({
				domain: [0, 1],
				range: [innerHeight, 0],
			}),
		[innerHeight]
	);

	const groupColorDomain = useMemo(() => {
		if (!dataRender.groupBreaksCategory) {
			return [];
		}
		const values = new Set<string>();
		filteredData.forEach((row) => {
			const value = row[dataRender.groupBreaksCategory!];
			if (value !== null && value !== undefined && value !== '') {
				values.add(String(value));
			}
		});
		return Array.from(values).sort();
	}, [dataRender.groupBreaksCategory, filteredData]);

	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain: groupColorDomain.length > 0 ? groupColorDomain : ['default'],
				range: colors,
			}),
		[groupColorDomain, colors]
	);

	const legendDomain = useMemo(() => {
		if (dataRender.groupBreaksCategory) {
			if (legend.categories.length > 0 && legend.categories.length === groupColorDomain.length) {
				const sortedSaved = [...legend.categories].sort();
				const sortedDerived = [...groupColorDomain].sort();
				if (JSON.stringify(sortedSaved) === JSON.stringify(sortedDerived)) {
					return legend.categories;
				}
			}
			return groupColorDomain;
		}
		if (legend.categories.length > 0) {
			return legend.categories;
		}
		return colorScale.domain();
	}, [dataRender.groupBreaksCategory, groupColorDomain, legend.categories, colorScale]);

	const layoutPoints = useMemo((): LayoutPoint[] => {
		if (filteredData.length === 0) {
			return [];
		}

		const centerY = innerHeight / 2;

		if (beeSwarm.layoutMode === 'force') {
			const groupBy = beeSwarm.groupBy || dataRender.groupBreaksCategory || null;
			const groupCenters =
				groupBy && beeSwarm.layoutMode === 'force'
					? buildBeeswarmGroupCenters(filteredData, groupBy, innerHeight)
					: undefined;

			return computeBeeswarmForce({
				data: filteredData,
				getX: (row) => valueScale(getValue(row)),
				getRadius,
				getGroupKey: groupBy
					? (row) => {
							const value = row[groupBy];
							return value === null || value === undefined || value === '' ? null : String(value);
						}
					: undefined,
				groupCenters,
				centerY,
				strength: beeSwarm.forceStrength,
			});
		}

		return dodge(filteredData, {
			x: (row) => valueScale(getValue(row)),
			radius: getRadius,
			spread: beeSwarm.swarmSpread ?? 24,
		});
	}, [
		beeSwarm.forceStrength,
		beeSwarm.groupBy,
		beeSwarm.layoutMode,
		beeSwarm.swarmSpread,
		dataRender.groupBreaksCategory,
		filteredData,
		getRadius,
		getValue,
		innerHeight,
		valueScale,
	]);

	const swarmInnerHeight = useMemo(() => {
		const maxAbsY = max(layoutPoints, (point) => Math.abs(point.y)) ?? 0;
		const maxRadius = max(layoutPoints, (point) => point.radius) ?? nodes.pointSize;
		return Math.max(innerHeight, (maxAbsY + maxRadius) * 2 + 8);
	}, [innerHeight, layoutPoints, nodes.pointSize]);

	const centerY = swarmInnerHeight / 2;

	const onTickClick = wpEditorFunctions?.tickLabels?.onClick;
	const independentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="independent" onTickClick={onTickClick} />
	);

	const {
		independentAxisProps,
		independentGridProps,
		ariaProps,
		legendProps,
		tooltipVisible,
		labelProps,
		annotationsVisible,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'bee-swarm chart',
				config,
				data: filteredData,
				size,
				tableData,
				dependentScale,
				independentScale: valueScale,
				actualContentHeight: swarmInnerHeight,
				independentTicksComponent,
			}),
		[config, filteredData, size, tableData, dependentScale, valueScale, swarmInnerHeight, independentTicksComponent]
	);

	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<LayoutPoint>();

	const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

	const getCategoryKey = useCallback(
		(row: FlatData) => {
			if (dataRender.groupBreaksCategory) {
				return String(row[dataRender.groupBreaksCategory] ?? '');
			}
			return 'default';
		},
		[dataRender.groupBreaksCategory]
	);

	const getPointColor = useCallback(
		(row: FlatData) => {
			const categoryKey = getCategoryKey(row);
			const fallback = colorScale(categoryKey) ?? colors[0];
			return resolveCategoryColor({
				category: categoryKey,
				fallback,
				dataRender,
			});
		},
		[colorScale, colors, dataRender, getCategoryKey]
	);

	// Per-row overrides land on `__tooltips` keyed by category, since
	// mergeCustomTooltipData has already matched the row on its label.
	const customTooltip = useMemo(
		() =>
			tooltipData
				? getCustomTooltip(tooltipData.data, getCategoryKey(tooltipData.data))
				: { body: '', header: null },
		[tooltipData, getCategoryKey]
	);

	const findNearestPoint = useCallback(
		(localX: number, localY: number): LayoutPoint | null => {
			let nearest: LayoutPoint | null = null;
			let nearestDistance = Infinity;

			for (const point of layoutPoints) {
				const cx = point.x;
				const cy = centerY - point.y;
				const dx = localX - cx;
				const dy = localY - cy;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const threshold = point.radius + 6;
				if (distance <= threshold && distance < nearestDistance) {
					nearest = point;
					nearestDistance = distance;
				}
			}

			return nearest;
		},
		[centerY, layoutPoints]
	);

	let tooltipTimeout = 0;
	const handleMouseMove = useCallback(
		(event: React.MouseEvent | React.TouchEvent) => {
			if (tooltipTimeout) {
				clearTimeout(tooltipTimeout);
			}
			if (!svgRef.current) {
				return;
			}

			const point = getLocalPoint(svgRef.current, event);
			if (!point) {
				return;
			}

			setCursorPosition({ x: point.x, y: point.y });
			const nearestPoint = findNearestPoint(point.x - padding.left, point.y - padding.top);
			if (nearestPoint) {
				showTooltip({
					tooltipLeft: nearestPoint.x,
					tooltipTop: centerY - nearestPoint.y,
					tooltipData: nearestPoint,
				});
			} else {
				hideTooltip();
			}
		},
		[centerY, findNearestPoint, hideTooltip, padding.left, padding.top, showTooltip]
	);

	const handleMouseLeave = useCallback(() => {
		tooltipTimeout = window.setTimeout(() => {
			hideTooltip();
		}, 300);
	}, [hideTooltip]);

	const chartHeight = height + Math.max(0, swarmInnerHeight - innerHeight);

	return (
		<TransitionProvider data={data} family="circle">
			<div
				style={{
					position: 'relative',
					overflow: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={chartWidth}
					height={chartHeight}
					ref={svgRef}
					{...ariaProps}
					style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
				>
					<Group
						top={padding.top}
						left={padding.left}
						onMouseMove={handleMouseMove}
						onMouseLeave={handleMouseLeave}
						role="presentation"
					>
						<rect
							width={innerWidth}
							height={swarmInnerHeight}
							fill="transparent"
							style={{ pointerEvents: 'all' }}
						/>
						<GridColumns {...independentGridProps} height={swarmInnerHeight} />
						{independentAxis.active && (
							<g style={{ pointerEvents: 'none' }}>
								<AxisBottom
									{...independentAxisProps}
									top={swarmInnerHeight}
									numTicks={scaledNumTicks}
								/>
							</g>
						)}
						{layoutPoints.map((point, index) => {
							const row = point.data;
							const categoryKey = getCategoryKey(row);
							const groupValue = getGroupValue(row, dataRender);
							const shapeKey = generateElementKey(row.x, categoryKey, groupValue);
							const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
							const defaultColor = getPointColor(row);
							const categoryOpacity = resolveCategoryOpacity({
								category: categoryKey,
								dataRender,
							});
							const { fill: defaultFill, stroke: defaultStroke } = resolveNodeShapeColors(
								nodes,
								defaultColor
							);
							const shapeFill = customShapeStyles.fill || defaultFill;
							const shapeStroke = customShapeStyles.stroke || defaultStroke;
							const shapeStrokeWidth = customShapeStyles.strokeWidth ?? nodes.pointStrokeWidth;
							const markOpacity = (customShapeStyles.opacity ?? 1) * categoryOpacity;
							const cx = point.x;
							const cy = centerY - point.y;

							return (
								<StyledAnimatedCircle
									key={`bee-swarm-point-${index}`}
									tabIndex={0}
									r={point.radius}
									cx={cx}
									cy={cy}
									stroke={shapeStroke}
									strokeWidth={shapeStrokeWidth}
									opacity={markOpacity}
									fill={shapeFill}
									style={{
										cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
										pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
									}}
									onClick={(event: React.MouseEvent) => {
										wpEditorFunctions?.shapes?.onClick?.(
											row,
											categoryKey,
											defaultColor,
											event.currentTarget,
											groupValue ?? undefined
										);
									}}
									onBlur={() => {
										tooltipTimeout = window.setTimeout(() => {
											hideTooltip();
										}, 300);
									}}
									onFocus={() => {
										if (tooltipTimeout) {
											clearTimeout(tooltipTimeout);
										}
										showTooltip({
											tooltipLeft: cx,
											tooltipTop: cy,
											tooltipData: point,
										});
									}}
								/>
							);
						})}
						{labels.active &&
							!wpEditorFunctions?.labels &&
							layoutPoints.map((point, index) => {
								const row = point.data;
								const categoryKey = getCategoryKey(row);
								const labelColumn = Object.keys(row).find(
									(key) => key !== 'x' && typeof row[key] === 'string'
								);
								const customLabelText = getCustomLabelText(row, categoryKey);
								const customLabel = customLabelText || getCustomLabel(row, categoryKey);
								const fallbackLabel =
									(labelColumn ? String(row[labelColumn]) : String(getValue(row))) || '';
								const labelContent = customLabel || fallbackLabel;
								if (!labelContent) {
									return null;
								}

								return (
									<DraggableLabel
										key={`bee-swarm-label-${index}`}
										x={point.x}
										y={centerY - point.y}
										dataPoint={row}
										category={categoryKey}
										defaultDx={0}
										defaultDy={-point.radius - 4}
										chartInnerWidth={innerWidth}
										chartInnerHeight={swarmInnerHeight}
										defaultLabel={fallbackLabel}
										fill={labels.color}
										{...labelProps}
									>
										{labelContent}
									</DraggableLabel>
								);
							})}
						{tooltipData && tooltipVisible && (
							<g>
								<Circle
									cx={tooltipLeft}
									cy={tooltipTop + 1}
									r={tooltipData.radius + 2}
									fill="transparent"
									stroke="black"
									strokeOpacity={0.1}
									strokeWidth={2}
									pointerEvents="none"
								/>
								<Circle
									cx={tooltipLeft}
									cy={tooltipTop}
									r={tooltipData.radius + 1}
									fill="transparent"
									stroke="white"
									strokeWidth={2}
									pointerEvents="none"
								/>
							</g>
						)}
					</Group>
					{labels.active && wpEditorFunctions?.labels && (
						<Group top={padding.top} left={padding.left}>
							{layoutPoints.map((point, index) => {
								const row = point.data;
								const categoryKey = getCategoryKey(row);
								const labelColumn = Object.keys(row).find(
									(key) => key !== 'x' && typeof row[key] === 'string'
								);
								const customLabelText = getCustomLabelText(row, categoryKey);
								const customLabel = customLabelText || getCustomLabel(row, categoryKey);
								const fallbackLabel =
									(labelColumn ? String(row[labelColumn]) : String(getValue(row))) || '';
								const labelContent = customLabel || fallbackLabel;
								if (!labelContent) {
									return null;
								}

								return (
									<DraggableLabel
										key={`bee-swarm-editor-label-${index}`}
										x={point.x}
										y={centerY - point.y}
										dataPoint={row}
										category={categoryKey}
										defaultDx={0}
										defaultDy={-point.radius - 4}
										chartInnerWidth={innerWidth}
										chartInnerHeight={swarmInnerHeight}
										defaultLabel={fallbackLabel}
										fill={labels.color}
										{...labelProps}
									>
										{labelContent}
									</DraggableLabel>
								);
							})}
						</Group>
					)}
					{annotationsVisible && (
						<AnnotationsLayer
							config={annotations}
							width={chartWidth}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth}
						/>
					)}
					{drawings?.active && !wpEditorFunctions && (
						<DrawingsLayer
							config={drawings}
							width={chartWidth}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth}
						/>
					)}
				</svg>
				{legend.active && dataRender.groupBreaksCategory && (
					<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
						<LegendOrdinal {...legendProps} scale={colorScale} domain={legendDomain}>
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
						top={tooltipTop + padding.top}
						left={tooltipLeft + padding.left}
						tooltip={tooltip}
						cursorX={cursorPosition?.x}
						cursorY={cursorPosition?.y}
						containerRef={svgRef}
						isMobile={isMobileTooltip}
					>
						<>
							{tooltip.headerActive && (
								<div style={{ marginBottom: '10px' }}>
									<strong>
										{customTooltip.header
											? customTooltip.header
											: getTooltipHeaderFormat(
													{
														x: tooltipData.data.x,
														category: getCategoryKey(tooltipData.data),
													},
													tooltip
												)}
									</strong>
								</div>
							)}
						</>
						<div
							dangerouslySetInnerHTML={{
								__html: customTooltip.body
									? customTooltip.body
									: getTooltipFormat({
												x: tooltipData.data.x,
												y: getValue(tooltipData.data),
												category: getCategoryKey(tooltipData.data),
												color: getPointColor(tooltipData.data),
										data: tooltipData.data,},
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

export default BeeSwarm;

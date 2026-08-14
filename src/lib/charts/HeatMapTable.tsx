/* eslint-disable max-lines-per-function */
import { CSSProperties, RefObject, useContext, useMemo, useRef, useState } from 'react';

import type { BaseConfig, FlatData, Size, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	DEFAULT_FONT_FAMILY,
	computeHeatMapTableCells,
	computeHeatMapTableLayout,
	createValueColorScale,
	generateElementKey,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getGroupedData,
	getGroupPositioningHorizontal,
	getGroupValue,
	getLabelFill,
	getLabelFormat,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	resolveShapePaint,
	useSize,
} from '@prc/charting-utilities';
import {
	AnnotationsLayer,
	BreakLine,
	ClickableLegend,
	ClickableTicks,
	DrawingsLayer,
	StyledLegend,
	StyledTooltip,
} from '../overlays';
import { DraggableLabel } from '../labels';

import { AxisLeft, AxisTop } from '@visx/axis';
import { Group } from '@visx/group';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';
import { scaleBand } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';

const HeatMapTable = () => {
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
		colors,
		tooltip,
		legend,
		dataRender,
		labels,
		shapes,
		heatMapTable: heatConfig,
		annotations,
		drawings,
		independentAxis,
		dependentAxis,
	} = config;

	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const flattenedData = useMemo(() => getFlattenedData(data), [data]);
	const columns = dataRender.categories?.length ? dataRender.categories.map(String) : [];
	const getIndependentValue = (d: FlatData) => String(d.x);

	const groupedData = useMemo(() => getGroupedData(flattenedData, dataRender), [flattenedData, dataRender]);
	const flatRows = useMemo(() => groupedData.flatMap(({ data: rows }) => rows), [groupedData]);

	const showColumnAxis = dependentAxis?.active ?? false;
	const columnHeaderHeight = showColumnAxis ? (heatConfig?.columnHeaderHeight ?? 48) : 0;
	const minCellHeight = heatConfig?.minCellHeight ?? 28;
	const rowCount = flatRows.length;
	const rowAreaHeight = Math.max(0, innerHeight - columnHeaderHeight);
	const minRowAreaHeight = rowCount > 0 ? rowCount * minCellHeight : 0;
	const effectiveRowArea = Math.max(rowAreaHeight, minRowAreaHeight);

	const independentScale = useMemo(() => {
		const allValues = groupedData.flatMap(({ data: rows }) => rows.map(getIndependentValue));
		return scaleBand<string>({
			domain: allValues,
			range: [0, effectiveRowArea],
			padding: 0,
		});
	}, [groupedData, effectiveRowArea]);

	const { groupPositioning, actualContentHeight } = useMemo(
		() => getGroupPositioningHorizontal(groupedData, dataRender, independentScale, effectiveRowArea),
		[groupedData, dataRender, independentScale, effectiveRowArea]
	);

	const cellHeight = independentScale.bandwidth();
	// Gap between the y-axis line (x=0) and the heat grid — not total label width.
	// Row labels render in negative x / layout.padding.left, same as horizontal bar charts.
	const gridInsetX = independentAxis?.active ? (heatConfig?.rowLabelWidth ?? 0) : 0;

	const heatLayout = useMemo(
		() =>
			computeHeatMapTableLayout({
				columnCount: columns.length,
				availableWidth: Math.max(0, innerWidth),
				contentHeight: actualContentHeight,
				cellGap: heatConfig?.cellGap ?? 0,
				rowLabelWidth: gridInsetX,
				columnHeaderHeight,
				minCellWidth: heatConfig?.minCellWidth ?? 40,
			}),
		[columns.length, innerWidth, actualContentHeight, heatConfig, gridInsetX, columnHeaderHeight]
	);

	const columnScale = useMemo(() => {
		const gap = heatLayout.cellGap;
		const cellWidth = heatLayout.cellWidth;
		const paddingInner = gap > 0 && cellWidth > 0 ? gap / (cellWidth + gap) : 0;
		return scaleBand<string>({
			domain: columns,
			range: [0, columns.length * (cellWidth + gap)],
			paddingInner,
			paddingOuter: 0,
		});
	}, [columns, heatLayout.cellGap, heatLayout.cellWidth]);

	const tableCells = useMemo(
		() =>
			computeHeatMapTableCells({
				rows: flatRows,
				columns,
				rowKeyField: 'x',
			}),
		[flatRows, columns]
	);

	const cellsByRowKey = useMemo(() => {
		const map = new Map<string, typeof tableCells.cells>();
		tableCells.cells.forEach((cell) => {
			const existing = map.get(cell.rowKey) || [];
			existing.push(cell);
			map.set(cell.rowKey, existing);
		});
		return map;
	}, [tableCells.cells]);

	const emptyFill = heatConfig?.emptyFill ?? '#F5F5F5';
	const colorScale = useMemo(
		() =>
			createValueColorScale({
				mode: dataRender.mapScale,
				domain: dataRender.mapScaleDomain,
				colors: colors?.length ? colors : ['#E8F4FA', '#001E33'],
				emptyFill,
			}),
		[dataRender.mapScale, dataRender.mapScaleDomain, colors, emptyFill]
	);

	const onTickClick = wpEditorFunctions?.tickLabels?.onClick;
	const independentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="independent" onTickClick={onTickClick} />
	);
	const dependentTicksComponent = (props: any) => (
		<ClickableTicks {...props} axisKey="dependent" onTickClick={onTickClick} />
	);

	const sharedPropsData = groupedData.length > 0 ? groupedData[0].data : [];
	const {
		ariaProps,
		legendProps,
		tooltipVisible,
		annotationsVisible,
		labelProps,
		independentAxisProps,
		dependentAxisProps,
	} = useMemo(
		() =>
			getSharedProps({
				chartType: 'heat map table',
				config,
				data: sharedPropsData,
				size,
				tableData,
				independentScale,
				dependentScale: columnScale,
				actualContentHeight,
				independentTicksComponent,
				dependentTicksComponent,
			}),
		[
			config,
			sharedPropsData,
			size,
			tableData,
			independentScale,
			columnScale,
			actualContentHeight,
			independentTicksComponent,
			dependentTicksComponent,
		]
	);

	const {
		tooltipOpen,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipData,
		hideTooltip,
		showTooltip,
	} = useTooltip<FlatData & { fill?: string }>();
	const tooltipTimeoutRef = useRef<number>(0);
	const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

	const scheduleHideTooltip = () => {
		if (tooltipTimeoutRef.current) {
			window.clearTimeout(tooltipTimeoutRef.current);
		}
		tooltipTimeoutRef.current = window.setTimeout(() => {
			hideTooltip();
			setActiveCellKey(null);
		}, 300);
	};

	const showCellTooltip = (event: React.MouseEvent, dataPoint: FlatData, columnKey: string, fill: string) => {
		if (!tooltip.active) {
			return;
		}
		if (tooltipTimeoutRef.current) {
			window.clearTimeout(tooltipTimeoutRef.current);
		}
		if (!svgRef.current) {
			return;
		}
		const point = getLocalPoint(svgRef.current, event);
		if (!point) {
			return;
		}
		setActiveCellKey(generateElementKey(dataPoint.x, columnKey, null));
		showTooltip({
			tooltipLeft: point.x,
			tooltipTop: point.y,
			tooltipData: { ...dataPoint, category: columnKey, fill },
		});
	};

	const siblingOpacity = (cellKey: string) => {
		if (!activeCellKey || !tooltip.deemphasizeSiblings || cellKey === activeCellKey) {
			return 1;
		}
		return tooltip.deemphasizeOpacity ?? 0.35;
	};

	const showValues = heatConfig?.showValues ?? true;
	const cellRadius = heatConfig?.cellRadius ?? 0;
	const shapesEditable = !!wpEditorFunctions?.shapes?.onClick;
	const fontFamily = labels?.fontFamily || DEFAULT_FONT_FAMILY;
	const labelFontSize = labels?.fontSize ?? 12;
	const headerOffset = columnHeaderHeight;

	const contentTotalHeight = headerOffset + actualContentHeight;
	const svgHeight = Math.max(height, padding.top + padding.bottom + contentTotalHeight);

	const rowYByKey = useMemo(() => {
		const map = new Map<string, number>();
		groupPositioning.forEach((groupPos) => {
			const groupScale = scaleBand<string>({
				domain: groupPos.data.map(getIndependentValue),
				range: [0, groupPos.height],
				padding: 0,
			});
			groupPos.data.forEach((dataPoint) => {
				const rowKey = getIndependentValue(dataPoint);
				const rowBandY = groupScale(rowKey);
				if (rowBandY !== undefined) {
					map.set(rowKey, headerOffset + groupPos.startY + rowBandY);
				}
			});
		});
		return map;
	}, [groupPositioning, headerOffset]);

	const formatCellValue = (value: number | null, columnKey: string, dataPoint: FlatData) => {
		if (value === null) {
			return '';
		}
		const custom = getCustomLabelText(dataPoint, columnKey) || getCustomLabel(dataPoint, columnKey);
		if (custom) {
			return String(custom);
		}
		return getLabelFormat(value, columnKey, labels, null);
	};

	const renderCellLabels = (editorMode: boolean) =>
		tableCells.cells.map((cell) => {
			if (cell.value === null) {
				return null;
			}
			const y = rowYByKey.get(cell.rowKey);
			if (y === undefined) {
				return null;
			}
			const { x } = heatLayout.cellPosition(cell.colIndex, y);
			const defaultColor = colorScale.getFill(cell.value);
			const groupValue = getGroupValue(cell.dataPoint, dataRender);
			const shapeKey = generateElementKey(cell.rowKey, cell.columnKey, groupValue);
			const paint = resolveShapePaint(shapes?.customStyles?.[shapeKey], {
				fill: defaultColor,
				opacity: 1,
			});
			const fill = paint.fill || defaultColor;
			const labelText = formatCellValue(cell.value, cell.columnKey, cell.dataPoint);
			if (!labelText) {
				return null;
			}
			const cx = x + heatLayout.cellWidth / 2;
			const cy = y + cellHeight / 2;

			return (
				<DraggableLabel
					key={`heat-label-${editorMode ? 'editor-' : ''}${shapeKey}`}
					x={cx}
					y={cy}
					dataPoint={cell.dataPoint}
					category={cell.columnKey}
					defaultDx={0}
					defaultDy={0}
					chartInnerWidth={innerWidth}
					chartInnerHeight={innerHeight}
					defaultLabel={labelText}
					fill={getLabelFill({
						labelColor: (labels?.color as 'contrast' | 'black' | 'white' | 'inherit') || 'contrast',
						seriesColor: fill,
						backgroundHex: fill,
					})}
					{...labelProps}
					dx={0}
					dy={0}
					textAnchor="middle"
					verticalAnchor="middle"
					fontSize={labelFontSize}
					fontFamily={fontFamily}
				>
					{labelText}
				</DraggableLabel>
			);
		});

	return (
		<div
			style={{
				position: 'relative',
				overflow: overflow as CSSProperties['overflowX'],
			}}
		>
			<svg
				width={chartWidth}
				height={svgHeight}
				ref={svgRef}
				{...ariaProps}
				style={{
					pointerEvents: tooltip.active || shapesEditable ? 'auto' : 'none',
				}}
			>
				<Group top={padding.top} left={padding.left} role="presentation">
					{showColumnAxis && (
						<AxisTop
							left={gridInsetX}
							top={columnHeaderHeight}
							{...dependentAxisProps}
							tickValues={columns}
							numTicks={columns.length}
							scale={columnScale}
						/>
					)}

					{groupPositioning.map((groupPos, groupIndex) => {
						const { data: rows, startY, height: groupHeight, breakHeight } = groupPos;
						const groupScale = scaleBand<string>({
							domain: rows.map(getIndependentValue),
							range: [0, groupHeight],
							padding: 0,
						});

						return (
							<Group key={`heat-group-${groupIndex}-${groupPos.group}`}>
								{rows.flatMap((dataPoint) => {
									const rowKey = getIndependentValue(dataPoint);
									const rowBandY = groupScale(rowKey);
									if (rowBandY === undefined) {
										return [];
									}
									const rowY = headerOffset + startY + rowBandY;
									const rowCells = cellsByRowKey.get(rowKey) || [];

									return rowCells.map((cell) => {
										const { x } = heatLayout.cellPosition(cell.colIndex, rowY);
										const defaultColor = colorScale.getFill(cell.value);
										const groupValue = getGroupValue(cell.dataPoint, dataRender);
										const shapeKey = generateElementKey(cell.rowKey, cell.columnKey, groupValue);
										const paint = resolveShapePaint(shapes?.customStyles?.[shapeKey], {
											fill: defaultColor,
											opacity: 1,
										});
										const fill = paint.fill || defaultColor;
										const opacity = (paint.opacity ?? 1) * siblingOpacity(shapeKey);

										return (
											<rect
												key={`heat-cell-${shapeKey}`}
												className="visx-bar"
												x={x}
												y={rowY}
												width={heatLayout.cellWidth}
												height={cellHeight}
												rx={cellRadius}
												ry={cellRadius}
												fill={fill}
												opacity={opacity}
												style={{
													cursor: shapesEditable ? 'pointer' : 'default',
													pointerEvents: shapesEditable || tooltip.active ? 'all' : undefined,
												}}
												onMouseMove={
													tooltip.active
														? (event) =>
																showCellTooltip(
																	event,
																	cell.dataPoint,
																	cell.columnKey,
																	fill
																)
														: undefined
												}
												onMouseLeave={tooltip.active ? scheduleHideTooltip : undefined}
												onClick={
													shapesEditable
														? (event) => {
																wpEditorFunctions.shapes.onClick(
																	cell.dataPoint,
																	cell.columnKey,
																	defaultColor,
																	event.currentTarget,
																	groupValue
																);
															}
														: undefined
												}
											/>
										);
									});
								})}

								{groupIndex > 0 && (
									<BreakLine
										x1={0}
										x2={heatLayout.totalWidth + padding.right}
										y1={headerOffset + startY - breakHeight / 2}
										y2={headerOffset + startY - breakHeight / 2}
										variation={dataRender.groupBreaks?.breakStyles?.variation || 'solid'}
										stroke={dataRender.groupBreaks?.breakStyles?.stroke || '#A4A4A4'}
										strokeWidth={dataRender.groupBreaks?.breakStyles?.strokeWidth || 1.4}
										strokeDasharray={dataRender.groupBreaks?.breakStyles?.strokeDasharray || 'none'}
									/>
								)}
							</Group>
						);
					})}

					{independentAxis?.active &&
						groupPositioning.map((groupPos, groupIndex) => {
							const { data: rows, startY, height: groupHeight } = groupPos;
							const groupScale = scaleBand<string>({
								domain: rows.map(getIndependentValue),
								range: [headerOffset + startY, headerOffset + startY + groupHeight],
								padding: 0,
							});

							return (
								<AxisLeft
									key={`heat-axis-${groupIndex}`}
									{...independentAxisProps}
									tickValues={rows.map(getIndependentValue)}
									numTicks={rows.length}
									scale={groupScale}
								/>
							);
						})}

					{showValues && !wpEditorFunctions?.labels && renderCellLabels(false)}
				</Group>

				{showValues && wpEditorFunctions?.labels && (
					<Group top={padding.top} left={padding.left} role="presentation">
						{renderCellLabels(true)}
					</Group>
				)}

				{annotationsVisible && (
					<AnnotationsLayer
						config={annotations}
						width={chartWidth}
						height={svgHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
				{drawings?.active && !wpEditorFunctions && (
					<DrawingsLayer
						config={drawings}
						width={chartWidth}
						height={svgHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
			</svg>

			{legend.active && (
				<StyledLegend legend={legend} layoutWidth={width} chartWidth={chartWidth}>
					{colorScale.mode === 'threshold' && (
						<LegendThreshold {...legendProps} scale={colorScale.scale}>
							{(legendLabels) => (
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
					{colorScale.mode === 'ordinal' && (
						<LegendOrdinal {...legendProps} scale={colorScale.scale} domain={colorScale.domain as string[]}>
							{(legendLabels) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => colorScale.scale(label.datum)}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendOrdinal>
					)}
					{colorScale.mode === 'linear' && (
						<LegendLinear {...legendProps} scale={colorScale.scale}>
							{(legendLabels) => (
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
					{tooltip.headerActive && (
						<div style={{ marginBottom: '10px' }}>
							<strong>
								{(() => {
									const category = String(tooltipData.category || columns[0] || 'y');
									const { header } = getCustomTooltip(tooltipData, category);
									if (header) {
										return header;
									}
									return getTooltipHeaderFormat(
										{
											x: tooltipData.x,
											category,
										},
										tooltip
									);
								})()}
							</strong>
						</div>
					)}
					<div
						dangerouslySetInnerHTML={{
							__html: (() => {
								const category = String(tooltipData.category || columns[0] || 'y');
								const customBody = getCustomTooltip(tooltipData, category).body;
								if (customBody) {
									return customBody;
								}
								const yVal =
									typeof tooltipData.y === 'number'
										? tooltipData.y
										: Number(tooltipData[category]) || 0;
								return getTooltipFormat({
										x: tooltipData.x,
										y: yVal,
										category,
										color: tooltipData.fill || colorScale.getFill(yVal),
										data: tooltipData,},
									tooltip,
									dataRender
								);
							})(),
						}}
					/>
				</StyledTooltip>
			)}
		</div>
	);
};

export default HeatMapTable;

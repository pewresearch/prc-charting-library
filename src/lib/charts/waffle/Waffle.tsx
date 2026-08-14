/* eslint-disable max-lines-per-function */
import { CSSProperties, RefObject, useContext, useMemo, useRef, useState } from 'react';

import type { BaseConfig, FlatData, Size, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	computeWaffleCells,
	computeWaffleLayout,
	getChartDimensions,
	getCustomTooltip,
	getFlattenedData,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getWaffleCategoryInputs,
	getLocalPoint,
	resolveWaffleCellSize,
	useSize,
} from '@prc/charting-utilities';
import { AnnotationsLayer, ClickableLegend, DrawingsLayer, StyledLegend, StyledTooltip } from '../../overlays';
import WaffleMarks from './WaffleMarks';

import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';

function resolveWaffleGrid(waffleConfig: BaseConfig['waffle']) {
	const legacySize = waffleConfig?.gridSize;
	return {
		columns: waffleConfig?.columns ?? legacySize ?? 10,
		rows: waffleConfig?.rows ?? legacySize ?? 10,
		cellSize: waffleConfig?.cellSize ?? 14,
		cellSizeMode: waffleConfig?.cellSizeMode ?? 'clamp',
		cellGap: waffleConfig?.cellGap ?? 0.1,
		max: waffleConfig?.max ?? null,
	};
}

const Waffle = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const { layout, colors, tooltip, legend, dataRender, shapes, waffle: waffleConfig, annotations, drawings } = config;

	const { width, height, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const flattenedData = useMemo(() => getFlattenedData(data), [data]);
	const category = dataRender.categories[0] || 'y';
	const grid = resolveWaffleGrid(waffleConfig);

	const categoryInputs = useMemo(
		() => getWaffleCategoryInputs(flattenedData, category, legend?.categories),
		[flattenedData, category, legend?.categories]
	);

	const waffleData = useMemo(
		() =>
			computeWaffleCells({
				mode: 'whole',
				categories: categoryInputs,
				columns: grid.columns,
				rows: grid.rows,
				max: grid.max,
			}),
		[categoryInputs, grid.columns, grid.rows, grid.max]
	);

	const dataByCategory = useMemo(() => new Map(flattenedData.map((row) => [String(row.x), row])), [flattenedData]);

	// Pie-like color domain: row labels (x), optionally ordered by legend.categories.
	const domain = useMemo(() => {
		const dataKeys = flattenedData.map((row) => String(row.x));
		if (legend?.categories?.length) {
			const filtered = legend.categories.map(String).filter((key) => dataByCategory.has(key));
			if (filtered.length > 0) {
				return filtered;
			}
		}
		return dataKeys;
	}, [legend?.categories, dataByCategory, flattenedData]);

	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain,
				range: colors?.length ? colors : ['#0090C0'],
			}),
		[domain, colors]
	);

	const resolvedCellSize = useMemo(
		() =>
			resolveWaffleCellSize({
				mode: grid.cellSizeMode,
				cellSize: grid.cellSize,
				columns: grid.columns,
				rows: grid.rows,
				cellGap: grid.cellGap,
				availableWidth: innerWidth,
				availableHeight: innerHeight,
			}),
		[grid.cellSizeMode, grid.cellSize, grid.columns, grid.rows, grid.cellGap, innerWidth, innerHeight]
	);

	const waffleLayout = useMemo(
		() =>
			computeWaffleLayout({
				columns: grid.columns,
				rows: grid.rows,
				cellSize: resolvedCellSize,
				cellGap: grid.cellGap,
			}),
		[grid.columns, grid.rows, resolvedCellSize, grid.cellGap]
	);

	const { ariaProps, legendProps, tooltipVisible, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'waffle chart',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);

	const {
		tooltipOpen,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipData,
		hideTooltip,
		showTooltip,
	} = useTooltip<FlatData>();
	let tooltipTimeout: number;

	const [activeCategory, setActiveCategory] = useState<string | null>(null);

	const siblingMarkOpacity = (categoryKey: string) => {
		if (!activeCategory || !tooltip.deemphasizeSiblings || categoryKey === activeCategory) {
			return 1;
		}
		return tooltip.deemphasizeOpacity ?? 0.35;
	};

	const scheduleHideTooltip = () => {
		if (tooltipTimeout) {
			window.clearTimeout(tooltipTimeout);
		}
		tooltipTimeout = window.setTimeout(() => {
			hideTooltip();
			setActiveCategory(null);
		}, 300);
	};

	const showCategoryTooltip = (event: React.MouseEvent, row: FlatData) => {
		if (!tooltip.active) {
			return;
		}
		if (tooltipTimeout) {
			window.clearTimeout(tooltipTimeout);
		}
		if (!svgRef.current) {
			return;
		}
		const point = getLocalPoint(svgRef.current, event);
		if (!point) {
			return;
		}
		setActiveCategory(String(row.x));
		showTooltip({
			tooltipLeft: point.x,
			tooltipTop: point.y,
			tooltipData: row,
		});
	};

	const gridLeft = padding.left + Math.max(0, (chartWidth - padding.left - padding.right - waffleLayout.width) / 2);
	const gridTop = padding.top + Math.max(0, (height - padding.top - padding.bottom - waffleLayout.height) / 2);

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
				style={{
					pointerEvents: tooltip.active || wpEditorFunctions?.shapes ? 'auto' : 'none',
				}}
			>
				<Group top={gridTop} left={gridLeft} role="presentation">
					<WaffleMarks
						cells={waffleData.cells}
						layout={waffleLayout}
						cellShape={waffleConfig?.cellShape ?? 'square'}
						cellRadius={waffleConfig?.cellRadius ?? 3}
						emptyFill={waffleConfig?.emptyFill ?? '#E6E7E8'}
						colorScale={(key) => colorScale(key)}
						categoryKey={category}
						dataByCategory={dataByCategory}
						dataRender={dataRender}
						customStyles={shapes?.customStyles}
						wpEditorFunctions={wpEditorFunctions}
						tooltipActive={tooltip.active}
						onCellMouseMove={showCategoryTooltip}
						onCellMouseLeave={scheduleHideTooltip}
						siblingMarkOpacity={siblingMarkOpacity}
					/>
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
					<LegendOrdinal {...legendProps} scale={colorScale} domain={domain}>
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
					{tooltip.headerActive && (
						<div style={{ marginBottom: '10px' }}>
							<strong>
								{(() => {
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
							__html:
								getCustomTooltip(tooltipData, category).body ||
								getTooltipFormat({
										x: tooltipData.x,
										y: Number(tooltipData[category]) || 0,
										category,
										color: colorScale(String(tooltipData.x)),
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

export default Waffle;

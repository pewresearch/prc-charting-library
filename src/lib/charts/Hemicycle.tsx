/* eslint-disable max-lines-per-function */
import { CSSProperties, MouseEvent, RefObject, useContext, useMemo, useRef, useState } from 'react';

import type { BaseConfig, FlatData, Size, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	baseConfig,
	computeHemicycleBarSegments,
	computeHemicycleSeats,
	computeHemicycleSquareScale,
	generateElementKey,
	hemicycleTooltipPoint,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getFlattenedData,
	getGroupValue,
	getLabelFill,
	getLabelFormat,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getWaffleCategoryInputs,
	orderRows,
	resolvePatternFill,
	resolveShapePaint,
	useSize,
} from '@prc/charting-utilities';
import {
	AnnotationsLayer,
	ClickableLegend,
	DrawingsLayer,
	SeriesPatternDefs,
	StyledLegend,
	StyledTooltip,
} from '../overlays';
import { DraggableLabel } from '../labels';

import { Group } from '@visx/group';
import { LegendOrdinal } from '@visx/legend';
import { scaleOrdinal } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';

const LABEL_BLOCK_HEIGHT = 24;

function resolveHemicycleConfig(hemicycleConfig: BaseConfig['hemicycle'] | undefined) {
	const defaults = baseConfig.hemicycle;
	return {
		...defaults,
		...hemicycleConfig,
		stackedBar: { ...defaults.stackedBar, ...hemicycleConfig?.stackedBar },
	};
}

const Hemicycle = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const { layout, colors, tooltip, legend, dataRender, labels, shapes, annotations, drawings, seriesStyles } = config;
	const hemicycle = resolveHemicycleConfig(config.hemicycle);
	const { stackedBar } = hemicycle;

	const { width, parentClass, padding } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const flattenedData = useMemo(() => getFlattenedData(data), [data]);
	const category = dataRender.categories[0] || 'y';

	// Parties are series keyed by row label. Palette slots follow series (legend) order, so
	// sorting or reordering never recolors a party.
	const seriesInputs = useMemo(
		() => getWaffleCategoryInputs(flattenedData, category, legend?.categories),
		[flattenedData, category, legend?.categories]
	);

	// Seat order: value sort when set, otherwise the order of the data table.
	const categoryInputs = useMemo(
		() =>
			orderRows(getWaffleCategoryInputs(flattenedData, category, null), {
				getValue: (input) => input.value,
				sortOrder: dataRender.sortOrder,
			}),
		[flattenedData, category, dataRender.sortOrder]
	);

	const { seats, seatRadius, counts, totalSeats } = useMemo(
		() =>
			computeHemicycleSeats({
				categories: categoryInputs,
				totalSeats: hemicycle.totalSeats,
				rows: hemicycle.rows,
				innerRadiusRatio: hemicycle.innerRadiusRatio,
			}),
		[categoryInputs, hemicycle.totalSeats, hemicycle.rows, hemicycle.innerRadiusRatio]
	);

	// Squares follow their row, so corners reach into diagonal neighbors. Shrink them to fit.
	const squareScale = useMemo(
		() => (hemicycle.seatShape === 'square' ? computeHemicycleSquareScale(seats, seatRadius) : 1),
		[hemicycle.seatShape, seats, seatRadius]
	);

	const barSegments = useMemo(
		() => (stackedBar.active ? computeHemicycleBarSegments(counts, totalSeats) : []),
		[stackedBar.active, counts, totalSeats]
	);

	const dataByCategory = useMemo(() => new Map(flattenedData.map((row) => [String(row.x), row])), [flattenedData]);

	const domain = useMemo(() => seriesInputs.map(({ key }) => key), [seriesInputs]);

	const colorScale = useMemo(
		() =>
			scaleOrdinal<string, string>({
				domain,
				range: colors?.length ? colors : ['#0090C0'],
			}),
		[domain, colors]
	);

	const { ariaProps, legendProps, labelProps, tooltipVisible, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'hemicycle chart',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);

	// Unit hemicycle: outer row on radius 1, seats extend seatRadius past it.
	const unitOuter = 1 + seatRadius;
	const barBlock = stackedBar.active ? stackedBar.gap + stackedBar.height : 0;
	const labelBlock = labels.active ? LABEL_BLOCK_HEIGHT : 0;
	const availableArcHeight = Math.max(0, innerHeight - barBlock - labelBlock);
	const radius = Math.max(0, Math.min(innerWidth / (2 * unitOuter), availableArcHeight / (unitOuter + seatRadius)));
	const arcWidth = 2 * unitOuter * radius;
	const arcHeight = (unitOuter + seatRadius) * radius;
	const centerX = padding.left + innerWidth / 2;
	const centerY = padding.top + unitOuter * radius;
	const seatSize = seatRadius * radius * (1 - Math.min(0.9, Math.max(0, hemicycle.seatGap)));
	const arcBottom = centerY + seatRadius * radius;
	const barTop = arcBottom + stackedBar.gap;
	const barLeft = centerX - arcWidth / 2;
	// SVG height follows the arc so narrow viewports do not leave dead space.
	const svgHeight = padding.top + arcHeight + barBlock + labelBlock + padding.bottom;
	const renderedInnerHeight = svgHeight - padding.top - padding.bottom;

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

	const siblingOpacity = (categoryKey: string) => {
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

	const showPartyTooltip = (event: MouseEvent<Element>, row: FlatData) => {
		if (!tooltip.active || !svgRef.current) {
			return;
		}
		if (tooltipTimeout) {
			window.clearTimeout(tooltipTimeout);
		}
		const point = getLocalPoint(svgRef.current, event);
		if (!point) {
			return;
		}
		setActiveCategory(String(row.x));
		showTooltip({ tooltipLeft: point.x, tooltipTop: point.y, tooltipData: row });
	};

	const shapesEditable = !!wpEditorFunctions?.shapes?.onClick;
	const editorPointerStyle: CSSProperties = {
		cursor: shapesEditable ? 'pointer' : 'default',
		pointerEvents: shapesEditable ? 'all' : undefined,
	};

	/** Shared paint and handlers for a seat or bar segment of one party. */
	const getPartyMarkProps = (categoryKey: string | null) => {
		if (!categoryKey) {
			return {
				fill: hemicycle.emptyFill,
				style: { pointerEvents: 'none' } as CSSProperties,
			};
		}
		const dataPoint = dataByCategory.get(categoryKey) || ({ x: categoryKey, [category]: 0 } as FlatData);
		const defaultColor = colorScale(categoryKey);
		const groupValue = getGroupValue(dataPoint, dataRender);
		const shapeKey = generateElementKey(dataPoint.x, category, groupValue);
		const paint = resolveShapePaint(
			shapes?.customStyles?.[shapeKey],
			{ fill: defaultColor, opacity: 1 },
			seriesStyles?.[categoryKey]
		);
		return {
			fill: resolvePatternFill(paint, categoryKey),
			stroke: paint.stroke,
			strokeWidth: paint.strokeWidth,
			opacity: (paint.opacity ?? 1) * siblingOpacity(categoryKey),
			style: editorPointerStyle,
			onMouseMove: tooltip.active
				? (event: MouseEvent<Element>) => showPartyTooltip(event, dataPoint)
				: undefined,
			onMouseLeave: tooltip.active ? scheduleHideTooltip : undefined,
			onClick: shapesEditable
				? (event: MouseEvent<Element>) =>
						wpEditorFunctions.shapes.onClick(
							dataPoint,
							category,
							defaultColor,
							event.currentTarget,
							groupValue
						)
				: undefined,
		};
	};

	const partyLabels = useMemo(() => {
		if (!labels.active) {
			return [];
		}
		const labelY = (stackedBar.active ? barTop + stackedBar.height : arcBottom) + 6;
		return categoryInputs
			.map((input, categoryIndex) => {
				const count = counts[categoryIndex] ?? 0;
				if (count === 0) {
					return null;
				}
				let x: number;
				if (stackedBar.active) {
					const segment = barSegments.find((entry) => entry.categoryIndex === categoryIndex);
					x = barLeft + (((segment?.start ?? 0) + (segment?.end ?? 0)) / 2) * arcWidth;
				} else {
					const partySeats = seats.filter((seat) => seat.categoryIndex === categoryIndex);
					const meanAngle =
						partySeats.reduce((sum, seat) => sum + seat.angle, 0) / Math.max(1, partySeats.length);
					x = centerX + Math.cos(meanAngle) * radius;
				}
				const dataPoint =
					dataByCategory.get(input.key) || ({ x: input.key, [category]: input.value } as FlatData);
				return { key: input.key, x, y: labelY, count, dataPoint };
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
	}, [
		labels.active,
		stackedBar.active,
		stackedBar.height,
		barTop,
		arcBottom,
		categoryInputs,
		counts,
		barSegments,
		barLeft,
		arcWidth,
		seats,
		centerX,
		radius,
		dataByCategory,
		category,
	]);

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
				<defs>
					<SeriesPatternDefs seriesStyles={seriesStyles} resolveFill={(key) => colorScale(key)} />
				</defs>
				<Group top={centerY} left={centerX} role="presentation" className="cb__hemicycle-seats">
					{seats.map((seat) => {
						const cx = seat.x * radius;
						const cy = seat.y * radius;
						const markProps = getPartyMarkProps(seat.categoryKey);
						if (hemicycle.seatShape === 'square') {
							const half = seatSize * squareScale;
							return (
								<rect
									key={`seat-${seat.index}`}
									className="visx-bar"
									x={cx - half}
									y={cy - half}
									width={half * 2}
									height={half * 2}
									transform={`rotate(${seat.rotation} ${cx} ${cy})`}
									{...markProps}
								/>
							);
						}
						return (
							<circle
								key={`seat-${seat.index}`}
								className="visx-circle"
								cx={cx}
								cy={cy}
								r={seatSize}
								{...markProps}
							/>
						);
					})}
				</Group>
				{stackedBar.active && (
					<Group top={barTop} left={barLeft} role="presentation" className="cb__hemicycle-bar">
						{barSegments.map((segment) => {
							const categoryKey =
								segment.categoryIndex >= 0 ? categoryInputs[segment.categoryIndex].key : null;
							return (
								<rect
									key={`bar-${segment.categoryIndex}`}
									className="visx-bar"
									x={segment.start * arcWidth}
									y={0}
									width={Math.max(0, (segment.end - segment.start) * arcWidth)}
									height={stackedBar.height}
									{...getPartyMarkProps(categoryKey)}
								/>
							);
						})}
					</Group>
				)}
				{partyLabels.length > 0 && (
					<Group className="cb__hemicycle-labels">
						{partyLabels.map(({ key, x, y, count, dataPoint }) => {
							const defaultLabel = getLabelFormat(count, category, labels, null, dataPoint);
							return (
								<DraggableLabel
									key={`label-${key}`}
									x={x}
									y={y}
									dataPoint={dataPoint}
									category={category}
									seriesKey={key}
									defaultDx={0}
									defaultDy={0}
									chartInnerWidth={innerWidth}
									chartInnerHeight={renderedInnerHeight}
									defaultLabel={defaultLabel}
									{...labelProps}
									fill={getLabelFill({
										labelColor: labels.color === 'contrast' ? 'inherit' : labels.color,
										seriesColor: colorScale(key),
									})}
									textAnchor="middle"
									verticalAnchor="start"
								>
									{getCustomLabelText(dataPoint, category) ||
										getCustomLabel(dataPoint, category) ||
										defaultLabel}
								</DraggableLabel>
							);
						})}
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
								{getCustomTooltip(tooltipData, category).header ||
									getTooltipHeaderFormat({ x: tooltipData.x, category }, tooltip)}
							</strong>
						</div>
					)}
					<div
						dangerouslySetInnerHTML={{
							__html:
								getCustomTooltip(tooltipData, category).body ||
								getTooltipFormat(
									{
										x: tooltipData.x,
										...hemicycleTooltipPoint(tooltipData, category, categoryInputs, counts),
										category,
										color: colorScale(String(tooltipData.x)),
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

export default Hemicycle;

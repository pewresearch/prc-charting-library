/**
 * MapBubbleLegend
 *
 * Proportional-symbol legend for maps in bubble mode. Replaces the standard
 * threshold/ordinal/linear legend when `dataRender.mapStyle === 'bubble'`.
 *
 * Two layouts (driven by `legend.bubbleLegend.layout`):
 * - `'stacked'` (default): nested concentric circles sharing a bottom baseline,
 *   labels sit inside the top of each ring (the classic proportional-symbol
 *   legend — see Observable's US bubble map example).
 * - `'spread'`: circles laid out side-by-side with labels below.
 *
 * Label placement (driven by `legend.bubbleLegend.labelPosition`):
 * - `'outside'` (default): labels render above the top edge of each circle in
 *   stacked mode, or below the circles in spread mode.
 * - `'inside'`: labels render just inside the top edge of each circle.
 *
 * Per-item text overrides are read from `legend.customLabels[String(value)].text`,
 * and clicks are wired to `wpEditorFunctions.legendItems.onClick` so editors can
 * abbreviate or rewrite the auto-generated labels via the standard popover.
 */
import {
	contrastLabelFillForLightDark,
	DataContext,
	decodeHtmlEntities,
	type BaseConfig,
	type LegendItemCustomization,
	type TableData,
} from '@prc/charting-utilities';
import { useContext, type CSSProperties, type SVGProps } from 'react';

export interface MapBubbleLegendProps {
	bubbleRadiusScale: (value: number) => number;
	maxDataValue: number;
	/** Bubble fill color (typically `colors[0]`). */
	fill: string;
	/**
	 * Map bubble stroke color. Used only when layout='spread' AND
	 * fillMode='category'; `legend.bubbleLegend.stroke` overrides it in every layout.
	 */
	stroke?: string;
	strokeWidth?: number;
	/** Map bubble fill opacity. Applied to filled circles. */
	opacity?: number;
	refValues?: number[];
	/** `'category'` = filled with `fill`; `'none'` = outline only. */
	fillMode?: 'category' | 'none';
	/** Stack vs spread. Falls back to context value, then to `'stacked'`. */
	layout?: 'stacked' | 'spread';
	/**
	 * Label placement relative to each bubble. Falls back to context value,
	 * then to `'outside'`.
	 */
	labelPosition?: 'inside' | 'outside';
	formatValue?: (v: number) => string;
	/** Label color. Defaults to `currentColor` for theme-awareness. */
	labelColor?: string;
	fontSize?: number;
}

const defaultFormat = (v: number) =>
	new Intl.NumberFormat(undefined, {
		notation: 'compact',
		maximumSignificantDigits: 3,
	}).format(v);

/**
 * Auto-pick up to three representative values when refValues is empty.
 *
 * @param max - Maximum data value across the bound category.
 * @return Up to three values at 25%, 50%, and 100% of `max` (deduped, positive).
 */
function autoRefValues(max: number): number[] {
	if (max <= 0) return [];
	const candidates = [Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max)].filter(
		(v, i, arr) => v > 0 && arr.indexOf(v) === i
	);
	return candidates.slice(0, 3);
}

const MapBubbleLegend = ({
	bubbleRadiusScale,
	maxDataValue,
	fill,
	stroke = '#ffffff',
	strokeWidth = 1,
	opacity = 0.7,
	refValues = [],
	fillMode = 'category',
	layout: layoutProp,
	labelPosition: labelPositionProp,
	formatValue = defaultFormat,
	labelColor,
	fontSize: fontSizeProp,
}: MapBubbleLegendProps) => {
	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const legendConfig = context?.config?.legend;
	const customLabels: Record<string, LegendItemCustomization> = legendConfig?.customLabels ?? {};
	const onLegendItemClick = context?.wpEditorFunctions?.legendItems?.onClick;

	// Context fallback for layout/fontSize so callers don't need to thread them.
	const layout = layoutProp ?? legendConfig?.bubbleLegend?.layout ?? 'stacked';
	const labelPosition = labelPositionProp ?? legendConfig?.bubbleLegend?.labelPosition ?? 'outside';
	const fontSize = fontSizeProp ?? legendConfig?.fontSize ?? 11;

	const values =
		refValues.length > 0 ? [...refValues].sort((a, b) => a - b).slice(0, 3) : autoRefValues(maxDataValue);

	if (!values.length) return null;

	const circles = values.map((v) => ({ value: v, radius: Math.max(1, bubbleRadiusScale(v)) }));
	// Largest first in render order so smaller circles paint on top (stacked) and
	// hit-test order is consistent (spread).
	const sorted = [...circles].sort((a, b) => b.radius - a.radius);
	const maxR = sorted[0].radius;

	// An explicit `legend.bubbleLegend.stroke` always wins — it is the only way to
	// make the rings match a map whose bubbles carry a custom stroke, and nesting
	// must not silently discard it.
	//
	// Without one, auto-contrast: a white stroke (the map bubbles' default)
	// disappears in outline-only mode and obscures circle boundaries when nested,
	// so fall back to currentColor unless the layout keeps the circles apart.
	const useMapStroke = layout === 'spread' && fillMode === 'category';
	const circleStroke = legendConfig?.bubbleLegend?.stroke || (useMapStroke ? stroke : 'currentColor');
	const circleFill = fillMode === 'none' ? 'transparent' : fill;

	const containerStyle: CSSProperties = {
		display: 'inline-block',
		verticalAlign: 'middle',
	};

	// Resolve display text + per-item styling for each value. Mirrors the
	// override surface ClickableLegend exposes (text, fontSize, color, fontWeight,
	// fontStyle, fontFamily, textOutline) so editors get the same popover
	// experience for radius-legend items as for standard legend items.
	// `markerStyle` / `markerFill` are intentionally ignored — the circle IS
	// the data mark, not a swatch.
	const itemFor = (value: number) => {
		const itemKey = String(value);
		const customEntry = customLabels[itemKey];
		const displayText = customEntry?.text ? decodeHtmlEntities(customEntry.text) : formatValue(value);

		const effectiveFontSize = customEntry?.fontSize ?? fontSize;
		const effectiveColor = customEntry?.color || labelColor || 'currentColor';
		const outlineColor = customEntry?.textOutline
			? contrastLabelFillForLightDark(customEntry.color || '#000000')
			: undefined;

		const textProps: SVGProps<SVGTextElement> = {
			fontSize: effectiveFontSize,
			fill: effectiveColor,
			fontWeight: customEntry?.fontWeight,
			fontStyle: customEntry?.fontStyle,
			fontFamily: customEntry?.fontFamily,
			stroke: outlineColor,
			strokeWidth: outlineColor ? 2 : undefined,
			paintOrder: outlineColor ? 'stroke' : undefined,
			style: { fontVariantNumeric: 'tabular-nums' },
		};

		return { itemKey, displayText, effectiveFontSize, textProps };
	};

	if (layout === 'stacked') {
		// Nested concentric — all circles share bottom baseline at y = svgHeight.
		// When labels render outside, reserve room above the largest ring so its
		// label isn't clipped (or pushed into the chart by `overflow: visible`).
		const topPad = labelPosition === 'outside' ? fontSize + 4 : 0;
		const svgWidth = maxR * 2;
		const svgHeight = maxR * 2 + topPad;
		const cx = maxR;

		return (
			<div style={containerStyle} aria-label="Bubble size legend">
				<svg
					width={svgWidth}
					height={svgHeight}
					role="img"
					aria-label="Proportional symbol legend"
					style={{ overflow: 'visible' }}
				>
					{sorted.map(({ value, radius }) => {
						const cy = svgHeight - radius;
						const { itemKey, displayText, effectiveFontSize, textProps } = itemFor(value);
						// Label sits either just above each ring's top edge
						// (outside, default) or just inside it (inside). Uses
						// the item's own font size so per-item overrides remain
						// readable. Note: in stacked + outside, smaller rings'
						// labels sit above their own top edge but still inside
						// the larger ring they're nested in — switch to
						// `'spread'` if visually overlapping labels are a problem.
						const topY = svgHeight - 2 * radius;
						const labelY = labelPosition === 'outside' ? topY - 4 : topY + effectiveFontSize + 2;
						const handleClick = onLegendItemClick
							? (e: React.MouseEvent<SVGGElement>) =>
									onLegendItemClick(itemKey, displayText, e.currentTarget)
							: undefined;
						const handleKeyDown = onLegendItemClick
							? (e: React.KeyboardEvent<SVGGElement>) => {
									if (e.key === 'Enter' || e.key === ' ') {
										onLegendItemClick(itemKey, displayText, e.currentTarget);
									}
								}
							: undefined;
						return (
							<g
								key={`bubble-legend-${itemKey}`}
								role={onLegendItemClick ? 'button' : undefined}
								tabIndex={onLegendItemClick ? 0 : undefined}
								onClick={handleClick}
								onKeyDown={handleKeyDown}
								style={{
									cursor: onLegendItemClick ? 'pointer' : 'default',
									pointerEvents: 'auto',
								}}
							>
								<circle
									cx={cx}
									cy={cy}
									r={radius}
									fill={circleFill}
									fillOpacity={fillMode === 'category' ? opacity : 1}
									stroke={circleStroke}
									strokeWidth={strokeWidth}
								/>
								<text x={cx} y={labelY} textAnchor="middle" {...textProps}>
									{displayText}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
		);
	}

	// Spread layout — side-by-side circles. Labels render below (outside,
	// default) or just inside the top edge of each circle (inside).
	const gap = 16;
	const labelMargin = 6;
	const labelH = fontSize + 4;
	let x = 0;
	const positioned = sorted.map((c) => {
		const cx = x + c.radius;
		x = cx + c.radius + gap;
		return { ...c, cx };
	});
	const svgWidth = x - gap;
	const svgHeight = maxR * 2 + (labelPosition === 'outside' ? labelMargin + labelH : 0);

	return (
		<div style={containerStyle} aria-label="Bubble size legend">
			<svg
				width={svgWidth}
				height={svgHeight}
				role="img"
				aria-label="Proportional symbol legend"
				style={{ overflow: 'visible' }}
			>
				{positioned.map(({ value, radius, cx }) => {
					const cy = maxR;
					const { itemKey, displayText, effectiveFontSize, textProps } = itemFor(value);
					// Outside: baseline below the largest circle, offset by this
					// item's own fontSize so a per-item override doesn't clip
					// descenders. Inside: just below the top edge of this
					// circle, mirroring the stacked-inside placement.
					const labelY =
						labelPosition === 'outside'
							? maxR * 2 + labelMargin + effectiveFontSize
							: maxR - radius + effectiveFontSize + 2;
					const handleClick = onLegendItemClick
						? (e: React.MouseEvent<SVGGElement>) => onLegendItemClick(itemKey, displayText, e.currentTarget)
						: undefined;
					const handleKeyDown = onLegendItemClick
						? (e: React.KeyboardEvent<SVGGElement>) => {
								if (e.key === 'Enter' || e.key === ' ') {
									onLegendItemClick(itemKey, displayText, e.currentTarget);
								}
							}
						: undefined;
					return (
						<g
							key={`bubble-legend-${itemKey}`}
							role={onLegendItemClick ? 'button' : undefined}
							tabIndex={onLegendItemClick ? 0 : undefined}
							onClick={handleClick}
							onKeyDown={handleKeyDown}
							style={{
								cursor: onLegendItemClick ? 'pointer' : 'default',
								pointerEvents: 'auto',
							}}
						>
							<circle
								cx={cx}
								cy={cy}
								r={radius}
								fill={circleFill}
								fillOpacity={fillMode === 'category' ? opacity : 1}
								stroke={circleStroke}
								strokeWidth={strokeWidth}
							/>
							<text x={cx} y={labelY} textAnchor="middle" {...textProps}>
								{displayText}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
};

export default MapBubbleLegend;

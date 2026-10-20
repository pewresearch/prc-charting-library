/**
 * MapBubbleLayer
 *
 * Shared proportional-symbol overlay for all Albers USA and World map types.
 * Consumed inside an @visx/geo render prop where `features` and per-feature
 * `projection` functions are already in scope.
 *
 * Rendering contract:
 * - Polygons in bubble mode are inert (handled by the parent component).
 * - Bubbles are sorted largest-first so smaller bubbles sit on top.
 * - Tooltip handlers live on the bubbles, not the polygons.
 * - Radii are scaleSqrt so perceived circle area is proportional to value.
 * - String data values are coerced via parseFloat before comparison.
 * - Bubbles are `AnimatedCircle`s, so a data change tweens radius and position
 *   rather than cutting. Keyed by feature id so the same place keeps its circle
 *   across updates. With animation off (the default) these render exactly as the
 *   static circles they replaced.
 */
import { EventType } from '@visx/event/lib/types';
import {
	CategoryStyle,
	FeatureShape,
	getCustomTooltip,
	getGroupColorDomain,
	getLocalPoint,
	resolvePaint,
	resolvePatternFill,
} from '@prc/charting-utilities';
import { AnimatedCircle } from '../../animation';
import { getDisplayCentroid } from './getDisplayCentroid';

// ── Paint ─────────────────────────────────────────────────────────────────────

export interface BubbleGroups {
	/** Group column, or undefined when bubbles are one series. */
	groupBy?: string;
	/** Series key for every bubble when ungrouped: the mapped category. */
	seriesKey?: string;
	/** Palette slot fill for a group, in color sorter order. */
	groupFill: (group: string) => string;
}

/**
 * Bubble groups mirror the color sorter: one slot per group value, in
 * `groupBreaksCategoryValues` order, so `colors[i]` is group i. Without a
 * group column, every bubble is one series keyed by the mapped category.
 *
 * @param root0
 * @param root0.groupBy    Group column; empty means one series.
 * @param root0.category   Mapped value category.
 * @param root0.groupOrder Saved group order.
 * @param root0.data       Map rows.
 * @param root0.colors     Compiled palette.
 */
export function getBubbleGroups({
	groupBy,
	category,
	groupOrder,
	data,
	colors,
}: {
	groupBy?: string;
	category?: string;
	groupOrder?: Array<string | number> | null;
	data: Record<string, unknown>[];
	colors: string[];
}): BubbleGroups {
	if (!groupBy) {
		return { groupBy: undefined, seriesKey: category, groupFill: () => colors[0] };
	}
	const domain = getGroupColorDomain(data as any, groupBy, { groupOrder });
	return {
		groupBy,
		groupFill: (group) => {
			const index = domain.indexOf(group);
			return colors[(index < 0 ? 0 : index) % colors.length];
		},
	};
}

/**
 * A feature's series key: its group value, or the mapped category when
 * bubbles are one series.
 *
 * @param groups     Bubble groups from `getBubbleGroups`.
 * @param properties Feature properties.
 */
export function getBubbleGroup(
	groups: BubbleGroups | undefined,
	properties: Record<string, unknown> | undefined
): string | undefined {
	return groups?.groupBy ? String(properties?.[groups.groupBy] ?? '') : groups?.seriesKey;
}

/**
 * Bubble paint: `map.bubble` is the chart default; a group's series style
 * lays over it. Series opacity is the bubble's fill opacity.
 *
 * @param root0
 * @param root0.fill         Palette fill for this bubble.
 * @param root0.bubbleConfig `map.bubble` settings.
 * @param root0.group        Group value, when grouped.
 * @param root0.seriesStyle  `seriesStyles[group]`.
 */
export function resolveBubblePaint({
	fill,
	bubbleConfig,
	group,
	seriesStyle,
}: {
	fill: string;
	bubbleConfig: BubbleConfig;
	group?: string;
	seriesStyle?: CategoryStyle | null;
}) {
	const paint = resolvePaint({
		defaults: {
			fill,
			opacity: bubbleConfig.opacity ?? 0.7,
			stroke: bubbleConfig.stroke ?? '#ffffff',
			strokeWidth: bubbleConfig.strokeWidth ?? 1,
		},
		series: group ? seriesStyle : undefined,
	});
	return {
		fill: (group ? resolvePatternFill(paint, group) : paint.fill) ?? fill,
		fillOpacity: paint.opacity,
		stroke: paint.stroke,
		strokeWidth: paint.strokeWidth,
	};
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BubbleConfig {
	minRadius?: number;
	maxRadius?: number;
	opacity?: number;
	stroke?: string;
	strokeWidth?: number;
}

/** One entry from a @visx/geo render prop. */
export interface BubbleFeatureEntry {
	feature: FeatureShape;
	projection: (geo: any) => [number, number] | null;
}

export interface MapBubbleLayerProps {
	/** Features array from the @visx/geo render prop. */
	features: BubbleFeatureEntry[];
	/** The data category key (e.g. "Response", "value"). */
	category: string;
	/**
	 * Pre-built scaleSqrt: value → pixel radius.
	 * Build with domain [0, maxDataValue] and range [minRadius, maxRadius].
	 */
	bubbleRadiusScale: (value: number) => number;
	/** Fill colour applied to every bubble (typically colors[0]). */
	fill: string;
	/** Group column and per-group fill; omit for one series. */
	groups?: BubbleGroups;
	/** Named series styles, keyed by group value. */
	seriesStyles?: Record<string, CategoryStyle | undefined> | null;
	/** Bubble appearance config from map.bubble in the chart config. */
	bubbleConfig?: BubbleConfig;
	/** SVG ref used to convert mouse events to local coordinates. */
	svgRef: React.RefObject<SVGSVGElement>;
	/** visx showTooltip from useTooltip. */
	showTooltip: (args: { tooltipData: any; tooltipTop: number; tooltipLeft: number }) => void;
	/** visx hideTooltip from useTooltip (debounced by caller via tooltipTimeout). */
	hideTooltip: () => void;
	/** Ref to the tooltip debounce timer — cleared on each mouseenter. */
	tooltipTimeoutRef: React.MutableRefObject<number>;
	/**
	 * Optional per-feature pixel offsets applied after centroid projection.
	 * Keyed by whatever getOffsetKey returns. Used by the states map to nudge
	 * Alaska, Hawaii, etc. into readable positions.
	 */
	coordOffsets?: Record<string, number[]>;
	/**
	 * Given a feature, return the key used to look up coordOffsets.
	 * Defaults to `feature.id?.toString()`.
	 */
	getOffsetKey?: (feature: FeatureShape) => string | undefined;
	/**
	 * Return the human-readable name for the tooltip header.
	 * Defaults to `feature.properties?.name`.
	 */
	getName?: (feature: FeatureShape) => string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapBubbleLayer = ({
	features,
	category,
	bubbleRadiusScale,
	fill,
	groups,
	seriesStyles,
	bubbleConfig = {},
	svgRef,
	showTooltip,
	hideTooltip,
	tooltipTimeoutRef,
	coordOffsets,
	getOffsetKey,
	getName,
}: MapBubbleLayerProps) => {
	const bubbles = features
		.map(({ feature, projection }) => {
			const { id, properties } = feature;
			if (!id) return null;

			const coords: [number, number] | null = projection(getDisplayCentroid(feature));
			if (!coords) return null;

			// Apply optional per-feature pixel offsets (e.g. state nudges)
			if (coordOffsets && getOffsetKey) {
				const key = getOffsetKey(feature);
				if (key && coordOffsets[key]) {
					coords[0] += coordOffsets[key][0];
					coords[1] += coordOffsets[key][1];
				}
			}

			// Coerce value — data can arrive as string or number
			const rawVal = properties?.[category];
			if (rawVal === null || rawVal === undefined) return null;
			const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
			if (isNaN(val)) return null;

			const name = getName ? getName(feature) : (properties?.name ?? id.toString());
			return { id, properties, coords, val, name };
		})
		.filter(Boolean)
		// Largest first → smallest rendered last → smallest sits on top
		.sort((a, b) => Math.abs((b as any).val) - Math.abs((a as any).val));

	return (
		<>
			{bubbles.map((item) => {
				const { id, properties, coords, val, name } = item as any;
				const r = bubbleRadiusScale(Math.abs(val));
				const group = getBubbleGroup(groups, properties);
				const groupFill = group ? groups!.groupFill(group) : fill;
				const paint = resolveBubblePaint({
					fill: groupFill,
					bubbleConfig,
					group,
					seriesStyle: group ? seriesStyles?.[group] : undefined,
				});

				const handleMouseMove = (event: EventType) => {
					if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
					if (!svgRef.current) return;
					const svgCoords = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
					const { body: _tip, header: _hdr } = getCustomTooltip(properties, category);
					showTooltip({
						tooltipData: {
							x: name,
							id,
							y: val,
							category,
							fill: groupFill,
							customTooltip: _tip,
							customHeader: _hdr,
						},
						tooltipTop: svgCoords.y,
						tooltipLeft: svgCoords.x,
					});
				};

				const handleMouseLeave = () => {
					tooltipTimeoutRef.current = window.setTimeout(() => hideTooltip(), 300);
				};

				// Keyboard-focus handler: use pre-computed centroid coords so the
				// tooltip is positioned at the bubble rather than at (0,0), which is
				// what getLocalPoint returns for synthetic FocusEvents.
				const handleFocus = () => {
					if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
					const { body: _tip, header: _hdr } = getCustomTooltip(properties, category);
					showTooltip({
						tooltipData: {
							x: name,
							id,
							y: val,
							category,
							fill: groupFill,
							customTooltip: _tip,
							customHeader: _hdr,
						},
						tooltipTop: coords[1],
						tooltipLeft: coords[0],
					});
				};

				const handleBlur = () => {
					tooltipTimeoutRef.current = window.setTimeout(() => hideTooltip(), 300);
				};

				return (
					<AnimatedCircle
						// Feature id, not the index into the value-sorted list: that
						// order changes with the data, and an index-based key would
						// remount every bubble and lose the tween.
						key={`bubble-${id}`}
						cx={coords[0]}
						cy={coords[1]}
						r={r}
						fill={paint.fill}
						fillOpacity={paint.fillOpacity}
						stroke={paint.stroke}
						strokeWidth={paint.strokeWidth}
						role="img"
						aria-label={`${name}: ${val}`}
						tabIndex={0}
						style={{ cursor: 'default' }}
						onMouseMove={handleMouseMove}
						onMouseLeave={handleMouseLeave}
						onFocus={handleFocus}
						onBlur={handleBlur}
					/>
				);
			})}
		</>
	);
};

export default MapBubbleLayer;

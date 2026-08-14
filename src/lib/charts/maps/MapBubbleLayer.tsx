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
import { FeatureShape, getCustomTooltip, getLocalPoint } from '@prc/charting-utilities';
import { AnimatedCircle } from '../../animation';
import { getDisplayCentroid } from './getDisplayCentroid';

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
	bubbleConfig = {},
	svgRef,
	showTooltip,
	hideTooltip,
	tooltipTimeoutRef,
	coordOffsets,
	getOffsetKey,
	getName,
}: MapBubbleLayerProps) => {
	const { opacity = 0.7, stroke = '#ffffff', strokeWidth = 1 } = bubbleConfig;

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
			if (rawVal == null) return null;
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
							fill,
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
							fill,
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
						fill={fill}
						fillOpacity={opacity}
						stroke={stroke}
						strokeWidth={strokeWidth}
						role="img"
						aria-label={`${name}: ${val}`}
						tabIndex={0}
						style={{ cursor: 'pointer' }}
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

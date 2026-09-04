/**
 * MapGeoPointLayer
 *
 * Proportional (or fixed-radius) circles projected from explicit latitude /
 * longitude columns on flat chart data. Used when dataRender.mapStyle is
 * 'geo-points' — e.g. regional bubble maps that are not country topology features.
 *
 * Bubbles are `AnimatedCircle`s, so a data change tweens radius and position
 * instead of cutting. That is what lets a year scrubber replace the rows and
 * have the same set of places visibly grow in place. `AnimatedCircle` reads
 * `config.animation` itself, so with animation off (the default) it renders
 * exactly as the static circle it replaced.
 */
import type { MutableRefObject, RefObject } from 'react';
import { EventType } from '@visx/event/lib/types';
import { FlatData, getCustomTooltip, getLocalPoint } from '@prc/charting-utilities';
import { AnimatedCircle } from '../../animation';
import type { BubbleConfig } from './MapBubbleLayer';

export interface MapGeoPointLayerProps {
	/** Flat chart rows. */
	data: FlatData[];
	/** Project [longitude, latitude] → SVG [x, y]. */
	project: (coords: [number, number]) => [number, number] | null;
	/** Column used for bubble radius. */
	sizeCategory: string;
	/** Column used for the tooltip / aria label. Falls back to `x`. */
	labelColumn?: string;
	/** Latitude column name. */
	latitudeColumn?: string;
	/** Longitude column name. */
	longitudeColumn?: string;
	bubbleRadiusScale: (value: number) => number;
	fill: string;
	bubbleConfig?: BubbleConfig;
	svgRef: RefObject<SVGSVGElement>;
	showTooltip: (args: { tooltipData: any; tooltipTop: number; tooltipLeft: number }) => void;
	hideTooltip: () => void;
	tooltipTimeoutRef: MutableRefObject<number>;
	/**
	 * When true, draw a fixed-radius locator marker instead of a sized bubble.
	 * Used by orthographic country/region locator globes.
	 */
	fixedRadius?: number;
	/**
	 * When false, bind `cx`/`cy` directly (no position spring). Locator
	 * markers must not glide: a country change would otherwise mount the
	 * new centroid on the old camera and slide it home as the globe turns.
	 * Bubble maps keep the default so year-scrub radius/position still tweens.
	 */
	animatePosition?: boolean;
}

const MapGeoPointLayer = ({
	data,
	project,
	sizeCategory,
	labelColumn = 'x',
	latitudeColumn = 'Latitude',
	longitudeColumn = 'Longitude',
	bubbleRadiusScale,
	fill,
	bubbleConfig = {},
	svgRef,
	showTooltip,
	hideTooltip,
	tooltipTimeoutRef,
	fixedRadius,
	animatePosition = true,
}: MapGeoPointLayerProps) => {
	const { opacity = 0.7, stroke = '#ffffff', strokeWidth = 1 } = bubbleConfig;

	// How many times each place label has been seen. A bubble's React key has to
	// be the place itself so it survives a data change and tweens — but labels
	// are author data and are not guaranteed unique, so a repeat gets a suffix
	// rather than colliding.
	const labelOccurrences = new Map<string, number>();

	const points = data
		.map((row, index) => {
			const latRaw = row[latitudeColumn];
			const lonRaw = row[longitudeColumn];
			const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw ?? ''));
			const lon = typeof lonRaw === 'number' ? lonRaw : parseFloat(String(lonRaw ?? ''));
			if (Number.isNaN(lat) || Number.isNaN(lon)) {
				return null;
			}

			const coords = project([lon, lat]);
			if (!coords) {
				return null;
			}

			const rawVal = row[sizeCategory];
			const val =
				fixedRadius != null ? 1 : typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? ''));
			if (Number.isNaN(val)) {
				return null;
			}

			const name = String(row[labelColumn] ?? row.x ?? index);
			const seen = labelOccurrences.get(name) ?? 0;
			labelOccurrences.set(name, seen + 1);
			return { id: name, key: 0 === seen ? name : `${name}-${seen}`, row, coords, val, name };
		})
		.filter(Boolean)
		.sort((a, b) => Math.abs((b as any).val) - Math.abs((a as any).val));

	return (
		<>
			{points.map((item) => {
				const { id, key, row, coords, val, name } = item as {
					id: string;
					key: string;
					row: FlatData;
					coords: [number, number];
					val: number;
					name: string;
				};
				const r = fixedRadius != null ? fixedRadius : bubbleRadiusScale(Math.abs(val));

				const handleMouseMove = (event: EventType) => {
					if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
					if (!svgRef.current) return;
					const svgCoords = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
					const { body: _tip, header: _hdr } = getCustomTooltip(row, sizeCategory);
					showTooltip({
						tooltipData: {
							x: name,
							id,
							y: fixedRadius != null ? undefined : val,
							category: sizeCategory,
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

				const markerProps = {
					cx: coords[0],
					cy: coords[1],
					r,
					fill,
					fillOpacity: opacity,
					stroke,
					strokeWidth,
					role: 'img' as const,
					'aria-label': fixedRadius != null ? name : `${name}: ${val}`,
					tabIndex: 0,
					style: { cursor: 'pointer' as const },
					onMouseMove: handleMouseMove,
					onMouseLeave: handleMouseLeave,
				};

				if (!animatePosition) {
					return <circle key={`geo-point-${key}`} {...markerProps} />;
				}

				return (
					<AnimatedCircle
						// Keyed by place, not by position in the value-sorted list:
						// a year change can reorder that list, and an index-based key
						// would remount the bubbles and lose the tween.
						key={`geo-point-${key}`}
						{...markerProps}
					/>
				);
			})}
		</>
	);
};

export default MapGeoPointLayer;

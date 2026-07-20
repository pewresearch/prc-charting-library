/**
 * getDisplayCentroid
 *
 * d3-geo's `geoCentroid` returns the spherical centroid of an entire feature.
 * For `MultiPolygon` countries with scattered overseas territories — France
 * (French Guiana, Martinique, Réunion, French Polynesia…), the Netherlands
 * (Caribbean Netherlands), Norway (Svalbard, Jan Mayen), Denmark (Greenland,
 * Faroes), Portugal (Azores, Madeira), Spain (Canary Islands), and so on —
 * that combined centroid is pulled away from the country's main landmass, so
 * labels and bubbles render in the wrong place (mid-ocean, wrong continent).
 *
 * This helper returns the centroid of the single largest polygon by spherical
 * area instead. For `Polygon` features it is identical to `geoCentroid`.
 */
import { geoArea, geoCentroid } from '@visx/vendor/d3-geo';

type AnyFeature = {
	geometry?: {
		type?: string;
		coordinates?: any;
	};
};

export function getDisplayCentroid(feature: AnyFeature): [number, number] {
	const geom = feature?.geometry;
	if (!geom || geom.type !== 'MultiPolygon') {
		return geoCentroid(feature as any) as [number, number];
	}

	const polygons = (geom.coordinates ?? []) as number[][][][];
	if (polygons.length < 2) {
		return geoCentroid(feature as any) as [number, number];
	}

	let largestIndex = 0;
	let largestArea = -Infinity;
	for (let i = 0; i < polygons.length; i += 1) {
		const area = geoArea({ type: 'Polygon', coordinates: polygons[i] } as any);
		if (area > largestArea) {
			largestArea = area;
			largestIndex = i;
		}
	}

	return geoCentroid({
		type: 'Polygon',
		coordinates: polygons[largestIndex],
	} as any) as [number, number];
}

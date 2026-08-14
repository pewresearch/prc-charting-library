import { useCallback, useMemo, useState } from 'react';

import { buildUnifiedTooltipColumns, findNearestColumn, UnifiedColumn } from '@prc/charting-utilities';

// Bind the unified tooltip column model to a chart's scales and pointer events.
// Every memo is gated on `isUnified`, so a chart in point mode pays for one
// boolean and nothing else.
export function useUnifiedTooltip({
	tooltip,
	flattenedData,
	categories,
	independentScale,
	dependentScale,
	getIndependentValue,
	getSeriesDependentValue,
	getSeriesColor,
}: {
	tooltip: { mode?: 'point' | 'unified' };
	flattenedData: any[];
	categories: string[];
	independentScale: (value: any) => number;
	dependentScale: (value: any) => number;
	getIndependentValue: (d: any) => any;
	/** Stacked charts return the cumulative top; line charts the raw value. */
	getSeriesDependentValue?: (row: any, category: string, value: number) => number;
	getSeriesColor: (category: string, index: number) => string;
}) {
	const isUnified = 'unified' === tooltip.mode;
	const [activeColumn, setActiveColumn] = useState<UnifiedColumn | null>(null);

	const columns = useMemo(() => {
		if (!isUnified) {
			return [];
		}
		return buildUnifiedTooltipColumns({
			rows: flattenedData,
			categories,
			// `buildUnifiedTooltipColumns` calls `toPixelX(getX(row))`, so the
			// scale receives the parsed Date or number the voronoi accessor uses.
			getX: getIndependentValue,
			toPixelX: independentScale,
			toPixelY: (value, row, category) =>
				dependentScale(getSeriesDependentValue ? getSeriesDependentValue(row, category, value) : value),
			getColor: getSeriesColor,
		});
	}, [
		isUnified,
		flattenedData,
		categories,
		getIndependentValue,
		independentScale,
		dependentScale,
		getSeriesDependentValue,
		getSeriesColor,
	]);

	const snapTo = useCallback(
		(px: number) => {
			const next = findNearestColumn(columns, px);
			setActiveColumn(next);
			return next;
		},
		[columns]
	);

	const clear = useCallback(() => setActiveColumn(null), []);

	return { isUnified, columns, activeColumn, snapTo, clear };
}

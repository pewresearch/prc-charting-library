import type { FlatData, Labels, Legend } from '@prc/charting-utilities';
import { useMemo } from 'react';

import {
	buildOnLineSeriesLabels,
	getDirectLabelScaleFactors,
	getStackedSeriesDependentValue,
} from '@prc/charting-utilities';
import { getDeclutterOffset, useLabelDeclutter } from './useLabelDeclutter';

export { getStackedSeriesDependentValue };

export function useDirectSeriesLegend({
	legend,
	labels,
	dataRender,
	flattenedData,
	innerWidth,
	innerHeight,
	padding,
	layout,
	independentScale,
	dependentScale,
	getIndependentValue,
	getSeriesDependentValue,
}: {
	legend: Legend;
	labels: Labels;
	dataRender: { categories: string[] };
	flattenedData: FlatData[];
	innerWidth: number;
	innerHeight: number;
	padding: { left: number; top: number };
	layout: {
		width: number;
		height: number;
		padding: { left: number; right: number; top: number; bottom: number };
	};
	independentScale: (value: any) => number;
	dependentScale: (value: any) => number;
	getIndependentValue: (d: FlatData) => any;
	getSeriesDependentValue?: (d: FlatData, category: string, categoryIndex: number) => number;
}) {
	const isDirectLegend = legend.active && legend.variation === 'direct';

	const labelScales = useMemo(
		() => getDirectLabelScaleFactors(innerWidth, innerHeight, layout),
		[innerWidth, innerHeight, layout]
	);

	const directLegendCategories = useMemo(() => {
		const ordered = legend.categories.length > 0 ? legend.categories : dataRender.categories;
		return ordered.filter((category: string) =>
			flattenedData.some((d: FlatData) => d[category] !== '' && d[category] !== undefined && d[category] !== null)
		);
	}, [legend.categories, dataRender.categories, flattenedData]);

	const directSeriesDeclutterInputs = useMemo(() => {
		if (!isDirectLegend) {
			return [];
		}
		return buildOnLineSeriesLabels({
			categories: directLegendCategories,
			flattenedData,
			legend,
			innerWidth,
			independentScale,
			dependentScale,
			getIndependentValue,
			getSeriesDependentValue,
			padding,
			scales: labelScales,
		});
	}, [
		isDirectLegend,
		directLegendCategories,
		flattenedData,
		legend,
		innerWidth,
		independentScale,
		dependentScale,
		getIndependentValue,
		getSeriesDependentValue,
		padding,
		labelScales,
	]);

	const directSeriesOffsets = useLabelDeclutter(
		directSeriesDeclutterInputs,
		{
			padding: labels.declutterPadding ?? 4,
			lockX: true,
			iterations: 160,
			anchorStrengthY: 0.5,
			innerWidth,
			innerHeight,
		},
		isDirectLegend
	);

	return {
		isDirectLegend,
		directSeriesDeclutterInputs,
		directSeriesOffsets,
		labelScales,
		getDeclutterOffset,
	};
}

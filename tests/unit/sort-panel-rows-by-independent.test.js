import { describe, expect, it } from '@jest/globals';
import { facetDataByGroup } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/facetDataByGroup';
import { sortPanelRowsByIndependent } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/sortPanelRowsByIndependent';
import { getFirstLastLabelPlacement } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/buildLineChartLabels';

// Table blocks keep author row order, which is often newest first.
const descendingRows = [
	{ x: '2026', 'Bad thing': 61, Country: 'Germany' },
	{ x: '2022', 'Bad thing': 41, Country: 'Germany' },
	{ x: '2026', 'Bad thing': 43, Country: 'Japan' },
	{ x: '2022', 'Bad thing': 23, Country: 'Japan' },
];

describe('sortPanelRowsByIndependent', () => {
	it('orders each panel series left to right along the independent axis', () => {
		const panels = sortPanelRowsByIndependent(facetDataByGroup(descendingRows, 'Country'), (row) => Number(row.x));

		expect(panels[0].series[0].rows.map((row) => row.x)).toEqual(['2022', '2026']);
		expect(panels[1].series[0].rows.map((row) => row.x)).toEqual(['2022', '2026']);
	});

	it('sends the earliest point outward to the left under the outside layout', () => {
		const panels = sortPanelRowsByIndependent(facetDataByGroup(descendingRows, 'Country'), (row) => Number(row.x));
		const { rows } = panels[0].series[0];
		const placementFor = (pointIndex) =>
			getFirstLastLabelPlacement({
				pointIndex,
				pointCount: rows.length,
				labels: { firstLastLabelLayout: 'outside' },
			});

		expect(rows[0].x).toBe('2022');
		expect(placementFor(0)).toMatchObject({ defaultDx: -5, textAnchor: 'end' });
		expect(placementFor(1)).toMatchObject({ defaultDx: 5, textAnchor: 'start' });
	});
});

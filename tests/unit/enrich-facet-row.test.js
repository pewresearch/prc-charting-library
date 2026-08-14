import { enrichFacetRow, isFacetMetaKey } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/enrichFacetRow';
import { facetDataByColumn, deriveCategories } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/facetDataByColumn';
import { facetDataByGroup } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/facetDataByGroup';

describe('enrichFacetRow', () => {
	it('preserves tooltip/label metadata and mirrors the series value onto the category key', () => {
		const row = {
			x: '2009',
			Chrome: 12,
			IE: 60,
			__tooltips: { Chrome: { body: 'Chrome tip', header: '2009' } },
			__labels: { Chrome: '12%' },
			__labelVisible: { Chrome: true },
			__labelPositions: { Chrome: { dx: 4, dy: -2 } },
			__labelStyles: { Chrome: { fill: '#111' } },
		};

		expect(enrichFacetRow(row, 'Chrome')).toEqual({
			x: '2009',
			y: 12,
			Chrome: 12,
			__tooltips: row.__tooltips,
			__labels: row.__labels,
			__labelVisible: row.__labelVisible,
			__labelPositions: row.__labelPositions,
			__labelStyles: row.__labelStyles,
		});
	});

	it('identifies underscore-prefixed meta keys', () => {
		expect(isFacetMetaKey('__tooltips')).toBe(true);
		expect(isFacetMetaKey('Chrome')).toBe(false);
	});
});

describe('facetDataByColumn metadata', () => {
	it('keeps customization metadata on faceted rows', () => {
		const data = [
			{
				x: '2009',
				Chrome: 1,
				IE: 60,
				__tooltips: { Chrome: 'tip', IE: 'ie tip' },
				__labels: { Chrome: '1%' },
			},
		];
		const panels = facetDataByColumn(data);
		expect(panels[0].rows[0]).toMatchObject({
			x: '2009',
			y: 1,
			Chrome: 1,
			__tooltips: data[0].__tooltips,
			__labels: data[0].__labels,
		});
	});

	it('does not treat __meta keys as panel categories', () => {
		const data = [{ x: 'A', Chrome: 10, __tooltips: {}, __labels: {} }];
		expect(deriveCategories(data)).toEqual(['Chrome']);
		expect(facetDataByColumn(data).map((p) => p.key)).toEqual(['Chrome']);
	});
});

describe('facetDataByGroup metadata', () => {
	it('keeps customization metadata on group-faceted series rows', () => {
		const data = [
			{
				x: 2022,
				Reliable: 83,
				Country: 'Sweden',
				__tooltips: { Reliable: { body: 'sv' } },
				__labels: { Reliable: '83%' },
			},
		];
		const panels = facetDataByGroup(data, 'Country');
		expect(panels[0].series[0].rows[0]).toMatchObject({
			x: 2022,
			y: 83,
			Reliable: 83,
			__tooltips: data[0].__tooltips,
			__labels: data[0].__labels,
		});
	});
});

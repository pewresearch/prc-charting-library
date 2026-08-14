import { getGroupColorDomain } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/groupColorDomain';

const scatterGroups = [
	{ Grouping: 'North America' },
	{ Grouping: 'Europe' },
	{ Grouping: 'Asia-Pacific' },
	{ Grouping: 'Middle East-North Africa' },
	{ Grouping: 'Sub-Saharan Africa' },
	{ Grouping: 'Latin America-Carribean' },
];

describe('getGroupColorDomain', () => {
	it('keeps first-seen group order instead of sorting alphabetically', () => {
		expect(getGroupColorDomain(scatterGroups, 'Grouping')).toEqual([
			'North America',
			'Europe',
			'Asia-Pacific',
			'Middle East-North Africa',
			'Sub-Saharan Africa',
			'Latin America-Carribean',
		]);
	});

	it('pairs the first palette color with the first-seen group', () => {
		const domain = getGroupColorDomain(scatterGroups, 'Grouping');
		const colors = ['#456A83', '#7E7E7E', '#BF3B27', '#ea9e2c', '#1D1B12', '#949d48'];
		expect(domain[0]).toBe('North America');
		expect(colors[domain.indexOf('North America')]).toBe('#456A83');
		expect(colors[domain.indexOf('Asia-Pacific')]).toBe('#BF3B27');
		expect(colors[domain.indexOf('Latin America-Carribean')]).toBe('#949d48');
	});

	it('honors an explicit group order and appends leftover groups', () => {
		expect(
			getGroupColorDomain(scatterGroups, 'Grouping', {
				groupOrder: ['Latin America-Carribean', 'Europe'],
			})
		).toEqual([
			'Latin America-Carribean',
			'Europe',
			'North America',
			'Asia-Pacific',
			'Middle East-North Africa',
			'Sub-Saharan Africa',
		]);
	});

	it('prefers a matching legend order over first-seen order', () => {
		expect(
			getGroupColorDomain(scatterGroups, 'Grouping', {
				legendCategories: [
					'Asia-Pacific',
					'Europe',
					'Latin America-Carribean',
					'Middle East-North Africa',
					'North America',
					'Sub-Saharan Africa',
				],
			})
		).toEqual([
			'Asia-Pacific',
			'Europe',
			'Latin America-Carribean',
			'Middle East-North Africa',
			'North America',
			'Sub-Saharan Africa',
		]);
	});

	it('ignores a legend order that does not match the current groups', () => {
		expect(
			getGroupColorDomain(scatterGroups, 'Grouping', {
				legendCategories: ['North America', 'Europe'],
			})
		).toEqual([
			'North America',
			'Europe',
			'Asia-Pacific',
			'Middle East-North Africa',
			'Sub-Saharan Africa',
			'Latin America-Carribean',
		]);
	});

	it('returns an empty domain when the group key is missing', () => {
		expect(getGroupColorDomain(scatterGroups, '')).toEqual([]);
		expect(getGroupColorDomain(scatterGroups, null)).toEqual([]);
	});
});

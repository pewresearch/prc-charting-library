import { computeWafflePanelRatios } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/waffle/computeWafflePanelRatios';

describe('computeWafflePanelRatios', () => {
	it('returns panel percentages that sum to 100', () => {
		const ratios = computeWafflePanelRatios([
			{ key: 'North America', value: 35 },
			{ key: 'Europe', value: 30 },
			{ key: 'Asia', value: 35 },
		]);

		expect(ratios.get('North America')).toBe(35);
		expect(ratios.get('Europe')).toBe(30);
		expect(ratios.get('Asia')).toBe(35);
	});
});

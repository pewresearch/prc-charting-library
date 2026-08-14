/**
 * Categories whose direct-legend labels were dropped by declutterOmitWithin
 * should not keep first/last value labels either — a lone "<1%" with no series
 * name reads as an orphan.
 */
import { getOmittedDirectLegendCategories } from '../../src/lib/labels/getOmittedDirectLegendCategories';

describe('getOmittedDirectLegendCategories', () => {
	it('returns categories whose direct-legend offsets are hidden', () => {
		const inputs = [
			{ id: 'direct-series::0::Jews', category: 'Jews', x: 0, y: 0, text: 'Jews' },
			{ id: 'direct-series::1::Buddhists', category: 'Buddhists', x: 0, y: 10, text: 'Buddhists' },
		];
		const offsets = new Map([
			['direct-series::0::Jews', { dx: 0, dy: 0 }],
			['direct-series::1::Buddhists', { dx: 0, dy: 0, hidden: true }],
		]);

		expect([...getOmittedDirectLegendCategories(inputs, offsets)]).toEqual(['Buddhists']);
	});

	it('returns an empty set when nothing is hidden', () => {
		const inputs = [{ id: 'direct-series::0::Jews', category: 'Jews', x: 0, y: 0, text: 'Jews' }];
		const offsets = new Map([['direct-series::0::Jews', { dx: 0, dy: 0 }]]);

		expect(getOmittedDirectLegendCategories(inputs, offsets).size).toBe(0);
	});
});

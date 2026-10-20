import { describe, expect, it } from '@jest/globals';
import {
	generateTickLabelKey,
	resolveTickLabelEntry,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/tickLabelKeys';

describe('resolveTickLabelEntry', () => {
	it('keeps a panel-scoped tick label out of the other panels', () => {
		const entries = {
			[generateTickLabelKey(2024, 'Germany')]: { text: 'two four' },
		};

		expect(resolveTickLabelEntry(entries, 2024, 'Germany')).toEqual({ text: 'two four' });
		expect(resolveTickLabelEntry(entries, 2024, 'Japan')).toBeUndefined();
	});

	it('still applies a chart-wide entry to every panel and to single-plot charts', () => {
		const entries = { 2024: { text: 'two four' } };

		expect(resolveTickLabelEntry(entries, 2024, 'Germany')).toEqual({ text: 'two four' });
		expect(resolveTickLabelEntry(entries, 2024, null)).toEqual({ text: 'two four' });
	});

	it('layers a panel override on top of the chart-wide styling', () => {
		const entries = {
			2024: { fill: '#c00', fontWeight: 'bold' },
			[generateTickLabelKey(2024, 'Germany')]: { text: 'two four' },
		};

		expect(resolveTickLabelEntry(entries, 2024, 'Germany')).toEqual({
			fill: '#c00',
			fontWeight: 'bold',
			text: 'two four',
		});
	});
});

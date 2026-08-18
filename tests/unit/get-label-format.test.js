/**
 * Label values against a display floor.
 */
import { getLabelFormat } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/labels';

const PERCENT_LABEL = {
	absoluteValue: false,
	truncateDecimal: true,
	toFixedDecimal: 1,
	toLocaleString: true,
	abbreviateValue: false,
	labelUnit: '%',
	labelUnitPosition: 'end',
	minDisplayValue: 0.1,
};

describe('getLabelFormat decimal places (PRC-819)', () => {
	const BASE = {
		absoluteValue: false,
		toLocaleString: false,
		abbreviateValue: false,
		truncateDecimal: false,
		labelUnit: '',
		labelUnitPosition: 'end',
		minDisplayValue: null,
	};

	it('renders exactly the configured number of decimal places', () => {
		expect(getLabelFormat(20, 'Series', { ...BASE, toFixedDecimal: 3 }, null)).toBe('20.000');
	});

	it('pads a whole number at one place', () => {
		expect(getLabelFormat(20, 'Series', { ...BASE, toFixedDecimal: 1 }, null)).toBe('20.0');
	});

	it('pads with locale formatting', () => {
		expect(getLabelFormat(20, 'Series', { ...BASE, toFixedDecimal: 2, toLocaleString: true }, null)).toBe('20.00');
	});

	it('rounds then pads to the configured places', () => {
		expect(getLabelFormat(20.04, 'Series', { ...BASE, toFixedDecimal: 3 }, null)).toBe('20.040');
	});

	it('keeps a number as it is when no decimal places are configured', () => {
		expect(getLabelFormat(12.5, 'Series', { ...BASE, toFixedDecimal: 0 }, null)).toBe('12.5');
	});

	// Charts published before Decimal Places became authoritative carry
	// truncateDecimal: true and must render exactly as they do today.
	it('leaves a legacy truncating chart unchanged', () => {
		expect(
			getLabelFormat(
				44,
				'Series',
				{
					...BASE,
					truncateDecimal: true,
					toFixedDecimal: 3,
					toLocaleString: true,
					labelUnit: '%',
				},
				null
			)
		).toBe('44%');
	});
});

describe('getLabelFormat with a display floor', () => {
	it('keeps the unit on a floored value', () => {
		expect(getLabelFormat(0.04, 'Buddhists', PERCENT_LABEL, null)).toBe('<0.1%');
	});
});

/**
 * Tooltip values against a display floor, plus template-over-format precedence.
 */
import { getTooltipFormat } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/tooltips';

const PERCENT_TOOLTIP = {
	format: '{{row}}: {{value}}%',
	dateFormat: '%Y',
	absoluteValue: false,
	toFixedDecimal: 1,
	toLocaleString: true,
	abbreviateValue: false,
	minDisplayValue: 0.1,
};

describe('getTooltipFormat with a display floor', () => {
	it('substitutes the floor into the format template', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: 0.04, category: 'Buddhists', color: '#FDA727' },
			PERCENT_TOOLTIP,
			undefined
		);
		// Every placeholder is wrapped in a span, so the template's `%` lands
		// just outside the substituted value.
		expect(result).toContain('&lt;0.1</span>%');
	});

	it('does not emit a bare angle bracket into tooltip markup', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: 0.04, category: 'Buddhists', color: '#FDA727' },
			PERCENT_TOOLTIP,
			undefined
		);
		expect(result).not.toMatch(/<0\.1/);
	});

	it('floors the absolute value when the chart takes absolute values', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: -0.04, category: 'Buddhists', color: '#FDA727' },
			{ ...PERCENT_TOOLTIP, absoluteValue: true },
			undefined
		);
		expect(result).toContain('&lt;0.1</span>%');
	});

	it('leaves an ordinal map value alone', () => {
		const result = getTooltipFormat(
			{ x: 'Chad', y: 'Majority Muslim', category: 'Chad', color: '#000' },
			PERCENT_TOOLTIP,
			{ mapScale: 'ordinal' }
		);
		expect(result).toContain('Majority Muslim');
	});
});

describe('getTooltipFormat template precedence', () => {
	const POINT = {
		x: 2040,
		y: 12.5,
		category: 'Buddhists',
		color: '#FDA727',
	};

	it('substitutes tokens in the rich template HTML', () => {
		const result = getTooltipFormat(
			POINT,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				template: '<strong>{{row}}</strong>: {{value}}% ({{column}})',
			},
			undefined
		);
		expect(result).toBe('<strong>2040</strong>: 12.5% (Buddhists)');
	});

	it('ignores format when template is set', () => {
		const result = getTooltipFormat(
			POINT,
			{
				...PERCENT_TOOLTIP,
				format: '{{row}}: {{value}}%',
				minDisplayValue: null,
				template: '<em>{{column}}</em>',
			},
			undefined
		);
		expect(result).toBe('<em>Buddhists</em>');
		expect(result).not.toContain('12.5');
	});

	it('runs the value token through the number pipeline', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: 12345.678, category: 'Buddhists', color: '#FDA727' },
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				toFixedDecimal: 1,
				toLocaleString: true,
				abbreviateValue: false,
				template: '{{value}}',
			},
			undefined
		);
		expect(result).toBe('12,345.7');
	});

	it('applies minDisplayValue to the value token and escapes the floor', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: 0.04, category: 'Buddhists', color: '#FDA727' },
			{
				...PERCENT_TOOLTIP,
				template: '{{value}}%',
			},
			undefined
		);
		expect(result).toBe('&lt;0.1%');
	});

	it('applies absoluteValue to the value token', () => {
		const result = getTooltipFormat(
			{ x: 2040, y: -12.5, category: 'Buddhists', color: '#FDA727' },
			{
				...PERCENT_TOOLTIP,
				absoluteValue: true,
				minDisplayValue: null,
				template: '{{value}}',
			},
			undefined
		);
		expect(result).toBe('12.5');
	});

	it('preserves RichText markup around substituted tokens', () => {
		const result = getTooltipFormat(
			POINT,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				template: '<strong>{{value}}</strong> <em>{{column}}</em>',
			},
			undefined
		);
		expect(result).toBe('<strong>12.5</strong> <em>Buddhists</em>');
	});

	it('applies legacy .isColor() inside a template', () => {
		const result = getTooltipFormat(
			POINT,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				template: '{{column.isColor()}}: {{value}}%',
			},
			undefined
		);
		expect(result).toBe(
			'<span style="color: #FDA727; font-weight: normal; text-transform: none;">Buddhists</span>: 12.5%'
		);
	});

	it('falls back to mustache format when template is null', () => {
		const result = getTooltipFormat(
			POINT,
			{
				...PERCENT_TOOLTIP,
				template: null,
				minDisplayValue: null,
			},
			undefined
		);
		expect(result).toContain('2040');
		expect(result).toContain('12.5');
		expect(result).not.toContain('<strong>');
	});
});

describe('getTooltipFormat row-field tokens', () => {
	const STACKED_ROW = {
		x: 'Women',
		y: 25,
		category: 'Dem/Lean Dem',
		color: '#006699',
		data: {
			x: 'Women',
			Total: '42',
			'Rep/Lean Rep': '67',
			'Dem/Lean Dem': '25',
			grouping: 'gender',
		},
	};

	it('applies absoluteValue to numeric row fields', () => {
		const result = getTooltipFormat(
			{
				x: 'Women',
				y: -50,
				category: 'Rep/Lean Rep',
				color: '#006699',
				data: {
					x: 'Women',
					'Rep/Lean Rep': '-50',
					'Dem/Lean Dem': '25',
					grouping: 'gender',
				},
			},
			{
				...PERCENT_TOOLTIP,
				absoluteValue: true,
				minDisplayValue: null,
				toLocaleString: false,
				template: '{{Rep/Lean Rep}} vs {{Dem/Lean Dem}}',
			},
			undefined
		);
		expect(result).toBe('50 vs 25');
	});

	it('leaves non-numeric row fields untouched when absoluteValue is on', () => {
		const result = getTooltipFormat(
			STACKED_ROW,
			{
				...PERCENT_TOOLTIP,
				absoluteValue: true,
				minDisplayValue: null,
				toLocaleString: false,
				template: '{{grouping}}',
			},
			undefined
		);
		expect(result).toBe('gender');
	});

	it('substitutes arbitrary row keys from data', () => {
		const result = getTooltipFormat(
			STACKED_ROW,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				toLocaleString: false,
				template: '{{x}} ({{grouping}})',
			},
			undefined
		);
		expect(result).toBe('Women (gender)');
	});

	it('resolves keys with spaces and slashes', () => {
		const result = getTooltipFormat(
			STACKED_ROW,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				toLocaleString: false,
				template: '{{Rep/Lean Rep}} / {{Dem/Lean Dem}}',
			},
			undefined
		);
		expect(result).toBe('67 / 25');
	});

	it('virtual value wins over a row field named value and uses the number pipeline', () => {
		const result = getTooltipFormat(
			{
				x: 2040,
				y: 12.5,
				category: 'Series',
				color: '#000',
				data: {
					x: 2040,
					value: 'raw-from-row',
				},
			},
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				toLocaleString: false,
				toFixedDecimal: 1,
				template: '{{value}}',
			},
			undefined
		);
		expect(result).toBe('12.5');
	});

	it('leaves sibling series cells as raw row values', () => {
		const result = getTooltipFormat(
			STACKED_ROW,
			{
				...PERCENT_TOOLTIP,
				minDisplayValue: null,
				toLocaleString: false,
				toFixedDecimal: 0,
				template: '{{value}}% (Total {{Total}})',
			},
			undefined
		);
		expect(result).toBe('25% (Total 42)');
	});
});

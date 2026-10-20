import { describe, expect, test } from '@jest/globals';
import { createValueColorScale } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/createValueColorScale';

describe('createValueColorScale legend items', () => {
	test('threshold has one item per bin, even with spare and repeated palette colors', () => {
		const scale = createValueColorScale({
			mode: 'threshold',
			domain: [10, 20, 50],
			colors: ['#f00', '#bbb', '#ccc', '#ddd', '#eee', '#f00'],
		});

		expect(scale.legendItems.map((item) => item.text)).toEqual([
			'Less than 10',
			'10 to 20',
			'20 to 50',
			'More than 50',
		]);
		expect(scale.legendItems.map((item) => item.value)).toEqual(['#f00', '#bbb', '#ccc', '#ddd']);
	});

	test('ordinal has one item per category in legend order, keeping each category color', () => {
		const scale = createValueColorScale({
			mode: 'ordinal',
			domain: ['Dem', 'Rep', 'Law &amp; Order'],
			colors: ['#aaa', '#bbb', '#ccc', '#ddd'],
			legendOrder: ['Law &amp; Order', 'Dem', 'Rep'],
		});

		expect(scale.legendItems.map((item) => [item.text, item.value, item.datum])).toEqual([
			['Law & Order', '#ccc', 'Law &amp; Order'],
			['Dem', '#aaa', 'Dem'],
			['Rep', '#bbb', 'Rep'],
		]);
	});

	test('linear has one item per ramp stop, matching the color sorter rows', () => {
		const scale = createValueColorScale({
			mode: 'linear',
			domain: [0, 50, 100],
			colors: ['#ffffff', '#ff0000', '#000000'],
		});

		expect(scale.legendItems.map((item) => item.text)).toEqual(['0', '50', '100']);
		expect(scale.getFill(50)).toBe('rgb(255, 0, 0)');
		expect(scale.legendItems[1].value).toBe('rgb(255, 0, 0)');
	});
});

describe('createValueColorScale empty values', () => {
	test('zero takes a scale color; undefined, null, and empty string take the empty fill', () => {
		const scale = createValueColorScale({
			mode: 'threshold',
			domain: [10],
			colors: ['#aaa', '#bbb'],
			emptyFill: '#eee',
		});

		expect(scale.getFill(0)).toBe('#aaa');
		expect([undefined, null, ''].map(scale.getFill)).toEqual(['#eee', '#eee', '#eee']);
	});
});

describe('createValueColorScale palette colors', () => {
	test('discrete modes keep light-dark colors; the linear ramp resolves them', () => {
		const colors = ['light-dark(#aaaaaa, #111111)', '#bbbbbb'];
		const threshold = createValueColorScale({ mode: 'threshold', domain: [10], colors });
		const ordinal = createValueColorScale({ mode: 'ordinal', domain: ['A', 'B'], colors });
		const linear = createValueColorScale({ mode: 'linear', domain: [0, 100], colors });

		expect(threshold.getFill(5)).toBe('light-dark(#aaaaaa, #111111)');
		expect(threshold.legendItems[0].value).toBe('light-dark(#aaaaaa, #111111)');
		expect(ordinal.getFill('A')).toBe('light-dark(#aaaaaa, #111111)');
		expect(linear.getFill(0)).toBe('rgb(170, 170, 170)');
	});
});

describe('createValueColorScale style key and paint', () => {
	test('threshold keys series paint by bin language', () => {
		const scale = createValueColorScale({
			mode: 'threshold',
			domain: [10],
			colors: ['#aaa', '#bbb'],
			seriesStyles: { 'Less than 10': { stroke: '#000000', strokeWidth: 3 } },
		});

		expect(scale.styleKey(5)).toBe('Less than 10');
		expect(scale.getPaint(5, { stroke: '#ffffff', strokeWidth: 1, opacity: 1 })).toEqual({
			fill: '#aaa',
			stroke: '#000000',
			strokeWidth: 3,
			strokeOpacity: undefined,
			opacity: 1,
		});
	});

	test('keyFill returns the scale color behind a style key, for hatch defs', () => {
		const colors = ['#aaa', '#bbb', '#ccc'];
		const threshold = createValueColorScale({ mode: 'threshold', domain: [10], colors });
		const ordinal = createValueColorScale({ mode: 'ordinal', domain: ['A', 'B'], colors });
		const linear = createValueColorScale({ mode: 'linear', domain: [0, 100], colors });

		expect(threshold.keyFill('More than 10')).toBe('#bbb');
		expect(ordinal.keyFill('B')).toBe('#bbb');
		expect(linear.keyFill('50')).toBeUndefined();
	});
});

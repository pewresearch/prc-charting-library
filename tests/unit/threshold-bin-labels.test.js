import { describe, expect, test } from '@jest/globals';
import { resolveBinPaint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/createValueColorScale';
import {
	getThresholdLegendLabels,
	mapScaleStyleKey,
	thresholdBinLabel,
	thresholdLabelFill,
	thresholdLegendItems,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/thresholdLegendLabels';

describe('threshold bin labels', () => {
	test('builds the same language as the color sorter', () => {
		expect(
			getThresholdLegendLabels([10, 20, 50], {
				labelLower: 'Less than ',
				labelDelimiter: 'to',
				labelUpper: 'More than ',
			})
		).toEqual(['Less than 10', '10 to 20', '20 to 50', 'More than 50']);
	});

	test('maps a numeric value to the matching bin language key', () => {
		const domain = [10, 20, 50];

		expect(thresholdBinLabel(5, domain)).toBe('Less than 10');
		expect(thresholdBinLabel(10, domain)).toBe('10 to 20');
		expect(thresholdBinLabel(20, domain)).toBe('20 to 50');
		expect(thresholdBinLabel(50, domain)).toBe('More than 50');
		expect(thresholdBinLabel(80, domain)).toBe('More than 50');
	});

	test('mapScaleStyleKey uses bin language only for threshold', () => {
		expect(mapScaleStyleKey('ordinal', 'Democrat', ['Democrat'])).toBe('Democrat');
		expect(mapScaleStyleKey('threshold', 5, [10])).toBe('Less than 10');
	});

	test('a linear ramp keeps its scale fill and map defaults, ignoring series styles', () => {
		const seriesStyles = {
			42: { fill: '#123456', pattern: 'striped', stroke: '#000000', strokeWidth: 3, opacity: 0.2 },
		};
		const paint = resolveBinPaint('#abcdef', mapScaleStyleKey('linear', 42, [0, 100]), seriesStyles, {
			stroke: '#ffffff',
			strokeWidth: 1,
			opacity: 1,
		});

		expect(paint).toEqual({
			fill: '#abcdef',
			stroke: '#ffffff',
			strokeWidth: 1,
			strokeOpacity: undefined,
			opacity: 1,
		});
	});

	test('legend has one item per bin when a series fill repeats a spare palette color', () => {
		const items = thresholdLegendItems([10, 20, 50], ['#f00', '#bbb', '#ccc', '#ddd', '#eee', '#f00']);

		expect(items.map((item) => item.text)).toEqual(['Less than 10', '10 to 20', '20 to 50', 'More than 50']);
		expect(items.map((item) => item.value)).toEqual(['#f00', '#bbb', '#ccc', '#ddd']);
		expect(items.map((item) => item.datum)).toEqual([undefined, 10, 20, 50]);
	});

	test('thresholdLabelFill returns the palette slot for a bin label', () => {
		expect(thresholdLabelFill('Less than 10', [10, 20], undefined, ['#aaa', '#bbb', '#ccc'])).toBe('#aaa');
	});
});

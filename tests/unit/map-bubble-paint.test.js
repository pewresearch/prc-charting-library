import { describe, expect, test } from '@jest/globals';
import { getBubbleGroup, getBubbleGroups, resolveBubblePaint } from '../../src/lib/charts/maps/MapBubbleLayer';

const ROWS = [
	{ x: 'Texas', value: 30, Lean: 'Rep' },
	{ x: 'Oregon', value: 8, Lean: 'Dem' },
];

describe('getBubbleGroups', () => {
	test('without a group column every bubble takes the first color', () => {
		const groups = getBubbleGroups({ groupBy: '', data: ROWS, colors: ['#111', '#222'] });

		expect(groups.groupBy).toBeUndefined();
		expect(groups.groupFill('Rep')).toBe('#111');
	});

	test('with a group column each group takes its sorter slot', () => {
		const groups = getBubbleGroups({
			groupBy: 'Lean',
			groupOrder: ['Dem', 'Rep'],
			data: ROWS,
			colors: ['#111', '#222'],
		});

		expect(groups.groupBy).toBe('Lean');
		expect(groups.groupFill('Dem')).toBe('#111');
		expect(groups.groupFill('Rep')).toBe('#222');
	});
});

describe('getBubbleGroup', () => {
	test('grouped bubbles key by group value', () => {
		const grouped = getBubbleGroups({ groupBy: 'Lean', category: 'value', data: ROWS, colors: ['#111'] });

		expect(getBubbleGroup(grouped, ROWS[0])).toBe('Rep');
	});

	test('ungrouped bubbles are one series keyed by the mapped category', () => {
		const ungrouped = getBubbleGroups({ groupBy: '', category: 'value', data: ROWS, colors: ['#111'] });

		expect(getBubbleGroup(ungrouped, ROWS[0])).toBe('value');
		expect(ungrouped.groupFill('value')).toBe('#111');
	});
});

describe('resolveBubblePaint', () => {
	test('without a series style the bubble keeps the map bubble defaults', () => {
		expect(resolveBubblePaint({ fill: '#111', bubbleConfig: {} })).toEqual({
			fill: '#111',
			fillOpacity: 0.7,
			stroke: '#ffffff',
			strokeWidth: 1,
		});
	});

	test('a group series style lays fill, stroke, and opacity over the defaults', () => {
		const paint = resolveBubblePaint({
			fill: '#111',
			bubbleConfig: { opacity: 0.5 },
			group: 'Rep',
			seriesStyle: { fill: '#c00', stroke: '#000', strokeWidth: 2, opacity: 0.9 },
		});

		expect(paint).toEqual({ fill: '#c00', fillOpacity: 0.9, stroke: '#000', strokeWidth: 2 });
	});

	test('a hatched group paints through its pattern def', () => {
		const paint = resolveBubblePaint({
			fill: '#111',
			bubbleConfig: {},
			group: 'Rep',
			seriesStyle: { pattern: 'striped' },
		});

		expect(paint.fill).toMatch(/^url\(#.*rep.*\)$/i);
	});
});

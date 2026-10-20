import { resolvePatternFill } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/resolvePatternFill';
import { resolveBarPaint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/resolveShapePaint';

describe('resolvePatternFill', () => {
	test('a striped series mark fills with the pattern def url', () => {
		expect(resolvePatternFill({ fill: '#456A83', pattern: 'striped' }, 'Reps')).toBe('url(#series-pattern-reps)');
	});

	test('a solid series keeps the identity fill', () => {
		expect(resolvePatternFill({ fill: '#456A83', pattern: 'solid' }, 'Reps')).toBe('#456A83');
	});

	test('a category with spaces still makes a referenceable def url', () => {
		expect(resolvePatternFill({ fill: '#456A83', pattern: 'striped' }, 'Very liberal')).toBe(
			'url(#series-pattern-very-liberal)'
		);
	});

	test('switching a patterned series back to solid restores the bar fill', () => {
		const paint = resolveBarPaint({ fill: '#456A83', opacity: 1 }, { pattern: 'solid' }, undefined);

		expect(resolvePatternFill(paint, 'Reps')).toBe('#456A83');
	});

	test('an individual mark fill stays solid over a patterned series', () => {
		const paint = resolveBarPaint({ fill: '#456A83', opacity: 1 }, { pattern: 'striped' }, { fill: '#F4C245' });

		expect(resolvePatternFill(paint, 'Reps')).toBe('#F4C245');
	});

	test('a lines spec still hatches through the def url', () => {
		expect(
			resolvePatternFill({ fill: '#456A83', pattern: { type: 'striped', width: 12, height: 12 } }, 'Reps')
		).toBe('url(#series-pattern-reps)');
	});
});

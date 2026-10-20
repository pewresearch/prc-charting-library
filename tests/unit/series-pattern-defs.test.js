/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import { SeriesPatternDefs } from '../../src/lib/overlays/SeriesPatternDefs';

describe('SeriesPatternDefs', () => {
	test('emits a def id for each non-solid series pattern', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(SeriesPatternDefs, {
					seriesStyles: {
						Reps: { pattern: 'striped', fill: '#456A83' },
						Dems: { fill: '#BF3B27' },
					},
				})
			)
		);

		expect(container.querySelector('#series-pattern-reps')).not.toBeNull();
		expect(container.querySelector('#series-pattern-dems')).toBeNull();
	});

	test('emits a def for a lines spec with custom tile size', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(SeriesPatternDefs, {
					seriesStyles: {
						Reps: {
							pattern: { type: 'striped', width: 12, height: 12 },
							fill: '#456A83',
						},
					},
				})
			)
		);

		const def = container.querySelector('#series-pattern-reps');

		expect(def?.getAttribute('width')).toBe('12');
	});

	test('paints the pattern background with the mark fill so the bar stays solid', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(SeriesPatternDefs, {
					seriesStyles: {
						Reps: { pattern: 'striped' },
					},
					resolveFill: () => '#456A83',
				})
			)
		);

		const background = container.querySelector('#series-pattern-reps rect');

		expect(background?.getAttribute('fill')).toBe('#456A83');
	});

	test('takes the hatch stroke from the pattern spec, not the mark fill', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(SeriesPatternDefs, {
					seriesStyles: {
						Reps: {
							pattern: { type: 'striped', stroke: '#ffffff' },
						},
					},
					resolveFill: () => '#456A83',
				})
			)
		);

		const line = container.querySelector('#series-pattern-reps path');

		expect(line?.getAttribute('stroke')).toBe('#ffffff');
	});
});

/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import { PatternDef } from '../../src/lib/primitives/PatternDef';

describe('PatternDef', () => {
	test('a striped pattern emits a def with the given id', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(PatternDef, {
					id: 'series-pattern-Reps',
					pattern: 'striped',
					stroke: '#456A83',
				})
			)
		);

		expect(container.querySelector('#series-pattern-Reps')).not.toBeNull();
	});

	test('a dotted pattern emits a def with the given id', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(PatternDef, {
					id: 'series-pattern-Dems',
					pattern: 'dotted',
					stroke: '#BF3B27',
				})
			)
		);

		expect(container.querySelector('#series-pattern-Dems')).not.toBeNull();
	});

	test('a crosshatch pattern emits a def with the given id', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(PatternDef, {
					id: 'series-pattern-Ind',
					pattern: 'crosshatch',
					stroke: '#111111',
				})
			)
		);

		expect(container.querySelector('#series-pattern-Ind')).not.toBeNull();
	});

	test('a lines spec passes tile size through to the def', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(PatternDef, {
					id: 'series-pattern-Reps',
					pattern: { type: 'striped', width: 12, height: 12 },
					stroke: '#456A83',
				})
			)
		);

		const def = container.querySelector('#series-pattern-Reps');

		expect(def).not.toBeNull();
		expect(def?.getAttribute('width')).toBe('12');
		expect(def?.getAttribute('height')).toBe('12');
	});
});

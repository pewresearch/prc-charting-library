/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import AnimatedBar from '../../src/lib/animation/AnimatedBar';

const GEOMETRY = { x: 0, y: 0, width: 10, height: 10 };

function bar(fill) {
	return createElement('svg', null, createElement(AnimatedBar, { ...GEOMETRY, fill }));
}

describe('AnimatedBar pattern fills', () => {
	test('switching a solid bar to a pattern points the fill at the def', () => {
		const { container, rerender } = render(bar('#456A83'));

		rerender(bar('url(#series-pattern-reps)'));

		expect(container.querySelector('rect')?.getAttribute('fill')).toBe('url(#series-pattern-reps)');
	});

	test('switching a patterned bar back to solid restores the color', () => {
		const { container, rerender } = render(bar('url(#series-pattern-reps)'));

		rerender(bar('#456A83'));

		expect(container.querySelector('rect')?.getAttribute('fill')).toBe('#456A83');
	});
});

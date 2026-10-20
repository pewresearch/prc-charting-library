/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { ClickableLegend } from '../../src/lib/overlays/ClickableLegend';

test('editor legend buttons do not claim toggle state', () => {
	const { getByRole } = render(
		createElement(
			DataProvider,
			{
				value: {
					config: { legend: { variation: 'grouped', markerStyle: 'rect' } },
					wpEditorFunctions: {
						legendItems: { onClick: jest.fn() },
					},
				},
			},
			createElement(ClickableLegend, {
				labels: [{ text: 'Reps', datum: 'Reps', index: 0 }],
			})
		)
	);

	expect(getByRole('button').hasAttribute('aria-pressed')).toBe(false);
});

test('hidden detached placeholders cannot be dragged', () => {
	const { container } = render(
		createElement(
			DataProvider,
			{
				value: {
					config: { legend: { variation: 'detached', markerStyle: 'none' } },
					wpEditorFunctions: {
						legendItems: { onItemDragEnd: jest.fn() },
					},
				},
			},
			createElement(ClickableLegend, {
				labels: [{ text: '\u200B', datum: 'placeholder', index: 0 }],
			})
		)
	);

	expect(container.firstElementChild.style.pointerEvents).toBe('none');
});

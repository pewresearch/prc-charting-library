/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { ClickableLegend } from '../../src/lib/overlays/ClickableLegend';

test('detached legend drag persists the final pointer position', () => {
	const onItemDragEnd = jest.fn();
	const { getByRole } = render(
		createElement(
			DataProvider,
			{
				value: {
					config: {
						legend: {
							variation: 'detached',
							markerStyle: 'rect',
							customLabels: { Reps: { offsetX: 0, offsetY: 0 } },
						},
					},
					wpEditorFunctions: {
						legendItems: {
							onClick: jest.fn(),
							onItemDragEnd,
						},
					},
				},
			},
			createElement(ClickableLegend, {
				labels: [{ text: 'Reps', datum: 'Reps', index: 0 }],
			})
		)
	);

	const item = getByRole('button');
	fireEvent.mouseDown(item, { clientX: 0, clientY: 0 });
	fireEvent.mouseMove(document, { clientX: 5, clientY: 4 });
	fireEvent.mouseMove(document, { clientX: 12, clientY: 9 });
	fireEvent.mouseUp(document, { clientX: 12, clientY: 9 });

	expect(onItemDragEnd).toHaveBeenCalledWith('Reps', 12, 9);
});

test('a zero-distance drag does not suppress the legend click', () => {
	const onClick = jest.fn();
	const { getByRole } = render(
		createElement(
			DataProvider,
			{
				value: {
					config: {
						legend: {
							variation: 'detached',
							markerStyle: 'rect',
							customLabels: { Reps: { offsetX: 0, offsetY: 0 } },
						},
					},
					wpEditorFunctions: {
						legendItems: {
							onClick,
							onItemDragEnd: jest.fn(),
						},
					},
				},
			},
			createElement(ClickableLegend, {
				labels: [{ text: 'Reps', datum: 'Reps', index: 0 }],
			})
		)
	);

	const item = getByRole('button');
	fireEvent.mouseDown(item, { clientX: 0, clientY: 0 });
	fireEvent.mouseMove(document, { clientX: 0, clientY: 0 });
	fireEvent.mouseUp(document, { clientX: 0, clientY: 0 });
	fireEvent.click(item);

	expect(onClick).toHaveBeenCalledWith('Reps', 'Reps', item);
});

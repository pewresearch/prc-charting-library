/**
 * Grouped small-multiple labels must keep panel identity when the facet row
 * no longer has the group column (PRC-915).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { createElement } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { DraggableLabel } from '../../src/lib/labels/DraggableLabel';

const strippedRow = {
	x: '2026-01-01T05:00:00.000Z',
	y: 61,
	'Bad thing': 61,
};

function renderLabel(onClick, groupValue) {
	return render(
		createElement(
			'svg',
			null,
			createElement(
				DataProvider,
				{
					value: {
						config: {
							dataRender: {
								groupBreaksActive: true,
								groupBreaksCategory: 'Country',
							},
							layout: {
								width: 640,
								height: 400,
								padding: { top: 0, bottom: 0, left: 0, right: 0 },
							},
						},
						wpEditorFunctions: {
							labels: { onClick },
						},
					},
				},
				createElement(
					DraggableLabel,
					{
						x: 10,
						y: 10,
						dataPoint: strippedRow,
						category: 'Bad thing',
						defaultLabel: '61',
						groupValue,
					},
					'61'
				)
			)
		)
	);
}

describe('DraggableLabel grouped small multiples (PRC-915)', () => {
	it('passes an explicit groupValue through onClick when the row has no Country', () => {
		const onClick = jest.fn();
		const { getByText } = renderLabel(onClick, 'Germany');

		fireEvent.click(getByText('61'));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onClick.mock.calls[0][4]).toBe('Germany');
	});

	it('does not invent a groupValue from a stripped facet row', () => {
		const onClick = jest.fn();
		const { getByText } = renderLabel(onClick, null);

		fireEvent.click(getByText('61'));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onClick.mock.calls[0][4]).toBeNull();
	});
});

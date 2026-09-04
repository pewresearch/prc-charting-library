/**
 * Diff-column cell clicks must pass authored display text as defaultLabel.
 * Flattening coerces "+3" to 3; saving that coerced string into customLabels
 * permanently drops the plus sign (PRC-866).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { createElement } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { DiffColumn } from '../../src/lib/charts/DiffColumn';

const row = { x: 'Germany', Diff: 3, __raw: { Diff: '+3' } };

const diffColumn = {
	active: true,
	category: 'Diff',
	columnHeader: 'Diff',
	dx: 0,
	dy: 0,
	style: {
		rectStrokeWidth: 0,
		rectStrokeColor: 'none',
		rectFill: 'none',
		fill: '#000',
		headerFill: '#000',
		textOutline: false,
		headerTextOutline: false,
		fontWeight: 'normal',
		fontSize: '10',
		fontStyle: 'normal',
		fontFamily: 'sans-serif',
		headerFontSize: '10',
		width: 40,
		marginLeft: 8,
		heightOffset: 0,
	},
};

function renderDiffColumn(onClick) {
	return render(
		createElement(
			'svg',
			null,
			createElement(
				DataProvider,
				{
					value: {
						wpEditorFunctions: {
							diffColumn: { onClick },
						},
					},
				},
				createElement(DiffColumn, {
					diffColumn,
					layout: { type: 'bar' },
					dataRender: { x: 'x' },
					flattenedData: [row],
					labels: { labelPositionDY: 0 },
					innerHeight: 100,
					innerWidth: 200,
					scale: () => 20,
					showHeader: false,
					groupValue: null,
				})
			)
		)
	);
}

describe('DiffColumn defaultLabel (PRC-866)', () => {
	it('passes authored plus-sign text, not the coerced number', () => {
		const onClick = jest.fn();
		const { getByText } = renderDiffColumn(onClick);

		fireEvent.click(getByText('+3'));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onClick.mock.calls[0][2]).toBe('+3');
		expect(onClick.mock.calls[0][2]).not.toBe('3');
	});
});

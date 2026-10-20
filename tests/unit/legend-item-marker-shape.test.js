/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { ClickableLegend } from '../../src/lib/overlays/ClickableLegend';

const LABELS = [{ text: 'Reps', datum: 'Reps', index: 0 }];

function renderLegend({ legend = {}, shape = 'rect', shapeStyle, variation = 'grouped' }) {
	return render(
		createElement(
			DataProvider,
			{
				value: {
					config: {
						legend: { variation, markerStyle: shape, ...legend },
					},
				},
			},
			createElement(ClickableLegend, {
				labels: LABELS,
				shape,
				fill: () => '#456A83',
				shapeStyle,
			})
		)
	);
}

describe('grouped legend per-item marker shape', () => {
	test('a per-item circle overrides the legend default square', () => {
		const { container } = renderLegend({
			legend: { customLabels: { Reps: { markerStyle: 'circle' } } },
		});

		expect(container.querySelector('svg > circle')).not.toBeNull();
		expect(container.querySelector('svg > rect')).toBeNull();
	});
});

describe('legend marker styles', () => {
	test('applies shapeStyle to the rendered marker', () => {
		const { container } = renderLegend({
			shapeStyle: () => ({ opacity: 0.25 }),
		});

		expect(container.querySelector('svg > rect').style.opacity).toBe('0.25');
	});
});

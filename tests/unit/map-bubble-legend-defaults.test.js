import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import MapBubbleLegend from '../../src/lib/charts/maps/MapBubbleLegend';

function renderLegend(legend, dataRender = {}) {
	return render(
		createElement(
			DataProvider,
			{ value: { config: { legend, dataRender } } },
			createElement(MapBubbleLegend, {
				bubbleRadiusScale: (value) => value / 10,
				maxDataValue: 100,
				fill: '#456A83',
				fillMode: legend.bubbleLegend?.fill,
			})
		)
	);
}

describe('map bubble legend defaults', () => {
	test('the default legend draws outline rings in the text color', () => {
		const { container } = renderLegend(baseConfig.legend);
		const circles = [...container.querySelectorAll('circle')];

		expect(circles.length).toBeGreaterThan(0);
		for (const circle of circles) {
			expect(circle.getAttribute('fill')).toBe('transparent');
			expect(circle.getAttribute('stroke')).toBe('currentColor');
		}
	});

	test('category fill still paints the circles', () => {
		const { container } = renderLegend({
			...baseConfig.legend,
			bubbleLegend: { ...baseConfig.legend.bubbleLegend, fill: 'category' },
		});

		expect(container.querySelector('circle').getAttribute('fill')).toBe('#456A83');
	});

	test('grouped bubbles force outline rings, even with category fill saved', () => {
		const { container } = renderLegend(
			{
				...baseConfig.legend,
				bubbleLegend: { ...baseConfig.legend.bubbleLegend, fill: 'category' },
			},
			{ groupBreaksCategory: 'Lean' }
		);

		expect(container.querySelector('circle').getAttribute('fill')).toBe('transparent');
		expect(container.querySelector('circle').getAttribute('stroke')).toBe('currentColor');
	});
});

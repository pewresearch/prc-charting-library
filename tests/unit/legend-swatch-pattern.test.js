/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { ClickableLegend } from '../../src/lib/overlays/ClickableLegend';

const LABELS = [{ text: 'Reps', datum: 'Reps', index: 0 }];

function renderLegend({ seriesStyles, legend = {}, shape = 'rect', labels = LABELS }) {
	return render(
		createElement(
			DataProvider,
			{
				value: {
					config: {
						legend: { variation: 'grouped', ...legend },
						seriesStyles,
					},
				},
			},
			createElement(ClickableLegend, {
				labels,
				shape,
				fill: () => '#456A83',
			})
		)
	);
}

describe('legend swatch patterns', () => {
	test('a hatched series paints its rect swatch through a pattern def', () => {
		const { container } = renderLegend({
			seriesStyles: { Reps: { pattern: 'striped' } },
		});

		const def = container.querySelector('[id^="legend-pattern-reps-"]');
		const rect = container.querySelector('svg > rect');

		expect(def).not.toBeNull();
		expect(rect.getAttribute('fill')).toBe(`url(#${def.id})`);
	});

	test('a hatched series paints its circle swatch through a pattern def', () => {
		const { container } = renderLegend({
			seriesStyles: { Reps: { pattern: 'dotted' } },
			shape: 'circle',
		});

		const def = container.querySelector('[id^="legend-pattern-reps-"]');
		expect(container.querySelector('svg > circle').getAttribute('fill')).toBe(`url(#${def.id})`);
	});

	test('an outline marker keeps the flat swatch', () => {
		const { container } = renderLegend({
			seriesStyles: { Reps: { pattern: 'striped' } },
			legend: { markerFill: 'outline' },
		});

		expect(container.querySelector('[id^="legend-pattern-reps-"]')).toBeNull();
		expect(container.querySelector('svg > rect').getAttribute('fill')).toBe('none');
	});

	test('a line marker keeps the flat swatch', () => {
		const { container } = renderLegend({
			seriesStyles: { Reps: { pattern: 'striped' } },
			shape: 'line',
		});

		expect(container.querySelector('[id^="legend-pattern-reps-"]')).toBeNull();
		expect(container.querySelector('line').getAttribute('stroke')).toBe('currentColor');
	});

	test('a solid series keeps the flat swatch', () => {
		const { container } = renderLegend({ seriesStyles: {} });

		expect(container.querySelector('[id^="legend-pattern-reps-"]')).toBeNull();
		expect(container.querySelector('svg > rect').getAttribute('fill')).toBe('currentColor');
	});

	test('pattern ids stay unique across legend instances', () => {
		const first = renderLegend({
			seriesStyles: { Reps: { pattern: 'striped' } },
		});
		const second = renderLegend({
			seriesStyles: { Reps: { pattern: 'dotted' } },
		});
		const ids = [
			first.container.querySelector('[id^="legend-pattern-reps"]').id,
			second.container.querySelector('[id^="legend-pattern-reps"]').id,
		];

		expect(new Set(ids).size).toBe(2);
	});

	test('a threshold legend looks up hatch by bin language, not scale datum', () => {
		const { container } = renderLegend({
			labels: [{ text: 'Less than 10', datum: 10, value: '#aad4e8', index: 0 }],
			seriesStyles: {
				'Less than 10': { pattern: 'striped', fill: '#123456' },
			},
		});

		const def = container.querySelector('[id^="legend-pattern-"]');
		expect(def).not.toBeNull();
		expect(container.querySelector('svg > rect').getAttribute('fill')).toBe(`url(#${def.id})`);
	});
});

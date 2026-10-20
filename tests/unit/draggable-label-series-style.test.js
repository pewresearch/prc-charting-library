import { describe, expect, it } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider } from '@prc/charting-utilities';
import { DraggableLabel } from '../../src/lib/labels/DraggableLabel';

const row = {
	x: 'Adults',
	y: 61,
	Dems: 61,
};

function renderLabel(seriesStyles) {
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
								groupBreaksActive: false,
							},
							layout: {
								width: 640,
								height: 400,
								padding: { top: 0, bottom: 0, left: 0, right: 0 },
							},
							labels: {
								fontWeight: 200,
							},
							seriesStyles,
						},
					},
				},
				createElement(
					DraggableLabel,
					{
						x: 10,
						y: 10,
						dataPoint: row,
						category: 'Dems',
						defaultLabel: '61',
						fontWeight: 200,
					},
					'61'
				)
			)
		)
	);
}

describe('DraggableLabel series styles', () => {
	it('uses the series label font weight over the chart default', () => {
		const { container } = renderLabel({
			Dems: { label: { fontWeight: 700 } },
		});

		expect(container.querySelector('text').getAttribute('font-weight')).toBe('700');
	});

	it('uses the series label color over the chart default', () => {
		const { container } = renderLabel({
			Dems: { label: { color: '#BF3B27' } },
		});

		expect(container.querySelector('text').getAttribute('fill')).toBe('#BF3B27');
	});

	it('uses the series label font size over the chart default', () => {
		const { container } = renderLabel({
			Dems: { label: { fontSize: 16 } },
		});

		expect(container.querySelector('text').getAttribute('font-size')).toBe('16');
	});

	it('uses the series label font style over the chart default', () => {
		const { container } = renderLabel({
			Dems: { label: { fontStyle: 'italic' } },
		});

		expect(container.querySelector('text').getAttribute('font-style')).toBe('italic');
	});

	it('uses the series label font family over the chart default', () => {
		const { container } = renderLabel({
			Dems: { label: { fontFamily: 'Georgia' } },
		});

		expect(container.querySelector('text').getAttribute('font-family')).toBe('Georgia');
	});

	it('hides the label when the series hides labels', () => {
		const { container } = renderLabel({
			Dems: { labelsVisible: false },
		});

		expect(container.querySelector('text')).toBeNull();
	});

	it('draws a text outline when the series turns outline on', () => {
		const { container } = renderLabel({
			Dems: { label: { textOutline: true } },
		});

		expect(container.querySelector('text').getAttribute('stroke')).not.toBeNull();
	});

	it('looks up series label styles by seriesKey when category is a data column', () => {
		const { container } = render(
			createElement(
				'svg',
				null,
				createElement(
					DataProvider,
					{
						value: {
							config: {
								dataRender: {
									groupBreaksActive: false,
								},
								layout: {
									width: 640,
									height: 400,
									padding: { top: 0, bottom: 0, left: 0, right: 0 },
								},
								labels: {
									fontWeight: 200,
								},
								seriesStyles: {
									Democrat: { label: { fontWeight: 700, color: '#BF3B27' } },
								},
							},
						},
					},
					createElement(
						DraggableLabel,
						{
							x: 10,
							y: 10,
							dataPoint: { x: 'CA', Share: 'Democrat' },
							category: 'Share',
							seriesKey: 'Democrat',
							defaultLabel: 'CA',
							fontWeight: 200,
						},
						'CA'
					)
				)
			)
		);

		const text = container.querySelector('text');
		expect(text.getAttribute('font-weight')).toBe('700');
		expect(text.getAttribute('fill')).toBe('#BF3B27');
	});
});

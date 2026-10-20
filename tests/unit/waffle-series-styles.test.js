import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import Waffle from '../../src/lib/charts/waffle/Waffle';

const ROWS = [
	{ x: 'Yes', Share: 60 },
	{ x: 'No', Share: 40 },
];

function renderWaffle(seriesStyles) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'waffle', width: 400, height: 400 },
		colors: ['#111111', '#222222'],
		dataRender: { ...baseConfig.dataRender, x: 'x', categories: ['Share'] },
		seriesStyles,
	};
	return render(createElement(DataProvider, { value: { data: ROWS, config, tableData: {} } }, createElement(Waffle)));
}

const cellPaint = (container) =>
	new Set(
		[...container.querySelectorAll('svg rect.visx-bar')]
			.filter((node) => !node.closest('pattern'))
			.map((node) => `${node.getAttribute('fill')} ${node.getAttribute('stroke')}`)
	);

describe('waffle series styles', () => {
	test('a row paints stroke and hatch on that row cells only', () => {
		const { container } = renderWaffle({ Yes: { stroke: '#abcdef', pattern: 'striped' } });
		const paint = cellPaint(container);
		const yes = [...paint].find((entry) => entry.startsWith('url('));
		const id = yes?.match(/^url\(#(.+)\)/)?.[1];

		expect(yes).toMatch(/ #abcdef$/);
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
		expect(paint.has('#222222 null')).toBe(true);
	});
});

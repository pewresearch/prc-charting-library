import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import Sankey from '../../src/lib/charts/Sankey';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const ROWS = [
	{ x: 'Source', target: 'Left', value: 10 },
	{ x: 'Source', target: 'Right', value: 5 },
];

function renderSankey(seriesStyles) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'sankey', width: 400, height: 300 },
		colors: ['#111111', '#222222', '#333333'],
		labels: { ...baseConfig.labels, active: true },
		sankey: { ...baseConfig.sankey, sourceKey: 'x', targetKey: 'target', valueKey: 'value' },
		seriesStyles,
	};
	return render(createElement(DataProvider, { value: { data: ROWS, config, tableData: {} } }, createElement(Sankey)));
}

const nodes = (container) => [...container.querySelectorAll('.visx-sankey-node')];

describe('sankey series styles', () => {
	test('a node row paints stroke and hatch on that node only', () => {
		const { container } = renderSankey({ Source: { stroke: '#abcdef', strokeWidth: 2, pattern: 'striped' } });
		const [source, left] = nodes(container);
		const id = source.getAttribute('fill').match(/^url\(#(.+)\)$/)?.[1];

		expect(source.getAttribute('stroke')).toBe('#abcdef');
		expect(source.getAttribute('stroke-width')).toBe('2');
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
		expect(left.getAttribute('fill')).toBe('#222222');
	});

	test('a node row label style applies to that node label, centered on the node', () => {
		const { container } = renderSankey({ Left: { label: { fontWeight: 700 } } });
		const labels = [...container.querySelectorAll('text')].filter((node) =>
			['Source', 'Left', 'Right'].includes(node.textContent)
		);

		expect(labels.map((node) => `${node.textContent}:${node.getAttribute('font-weight')}`)).toEqual([
			`Source:${baseConfig.labels.fontWeight}`,
			'Left:700',
			`Right:${baseConfig.labels.fontWeight}`,
		]);
		expect(labels.every((node) => node.getAttribute('dominant-baseline') === 'middle')).toBe(true);
		expect(container.querySelector('[verticalAnchor], [verticalanchor]')).toBeNull();
	});
});

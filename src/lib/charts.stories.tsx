/**
 * Storybook stories for the PRC charting library.
 *
 * These render the real editor path — `<ChartBuilderWrapper config data />` —
 * exactly as the block editor (prc-chart-builder) and src/examples/App.tsx do.
 * No WordPress backend, REST, or Interactivity API is involved: Storybook
 * aliases `useChartStore` to its editor no-op stub (see .storybook/main.ts), so
 * the `config` / `data` props are the sole source of truth.
 *
 * Sample configs come from ./presets/*; sample data mirrors src/examples/App.tsx.
 */
import { ChartBuilderWrapper, ChartBuilderTextWrapper } from './controller';

import type { BaseConfig } from '@prc/charting-utilities';
import { randomDataPointsCountries } from '@prc/charting-utilities';

import divergingBarConfig from './presets/divergingBar';
import divergingBarVerticalConfig from './presets/divergingBarVertical';
import dotPlotConfig from './presets/dotPlot';
import dotPlotWithErrorBarsConfig, { dotPlotData } from './presets/dotPlotErrors';
import explodedBarConfig from './presets/explodedBar';
import horizontalBarConfig from './presets/horizontalBar';
import lineConfig from './presets/line';
import pieConfig from './presets/pie';
import scatterConfig from './presets/scatter';
import stackedBarConfig from './presets/stackedBar';
import treemapConfig from './presets/treemap';
import verticalBarConfig from './presets/verticalBar';
import verticalStackedBarConfig from './presets/verticalStackedBar';

// Global chart typography + `.cb__*` overlay styles used by the text wrapper.
import '../examples/styles.scss';

import type { Meta, StoryObj } from '@storybook/react-webpack5';

const PARENT_CLASS = 'wp-chart-builder-wrapper';

/**
 * Renders a chart the way prc-chart-builder does: inside a sized element whose
 * class matches `config.layout.parentClass`, which is what
 * `useSize(parentClass, svgRef)` measures via `closest()`. Without this the
 * hook falls back to `window` dimensions and charts size unpredictably. Many
 * presets leave `parentClass` undefined, so we force a known class here and
 * mirror it on the wrapper element.
 */
function ChartFrame({
	config,
	data,
	tableData,
}: {
	config: BaseConfig;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	tableData?: any;
}) {
	const framedConfig: BaseConfig = {
		...config,
		layout: { ...config.layout, parentClass: PARENT_CLASS },
	};
	const { width } = framedConfig.layout;
	const { active, title, subtitle, note, source, tag } = framedConfig.metadata;

	return (
		<div className={PARENT_CLASS} style={{ width, maxWidth: '100%' }}>
			<ChartBuilderTextWrapper
				active={active}
				width={width}
				horizontalRules={framedConfig.layout.horizontalRules}
				title={title}
				subtitle={subtitle}
				note={note}
				source={source}
				tag={tag}
			>
				<ChartBuilderWrapper config={framedConfig} data={data} tableData={tableData} />
			</ChartBuilderTextWrapper>
		</div>
	);
}

const meta: Meta<typeof ChartFrame> = {
	title: 'Charting Library/Charts',
	component: ChartFrame,
	parameters: {
		// Charts measure their container; give stories room and disable the
		// centering layout so width math is predictable.
		layout: 'padded',
	},
};

export default meta;

type Story = StoryObj<typeof ChartFrame>;

const verticalBarData = [
	{ x: 'Strongly agree', y: 21 },
	{ x: 'Somewhat agree', y: 34 },
	{ x: 'Somewhat disagree', y: 27 },
	{ x: 'Strongly disagree', y: 14 },
	{ x: 'No answer', y: 4 },
];

const verticalStackedBarData = [
	{ y: 3, y1: 9, y2: 7, y3: 3, x: 'Lesotho' },
	{ y: 5, y1: 0, y2: 8, y3: 3, x: 'Libya' },
	{ y: 15, y1: 8, y2: 7, y3: 10, x: 'Guam' },
	{ y: 10, y1: 8, y2: 12, y3: 8, x: 'Samoa' },
	{ y: 10, y1: 10, y2: 0, y3: 7, x: 'Jersey' },
];

const divergingData = [
	[
		{
			Agree: 1,
			'Strongly Agree': 4,
			Disagree: 5,
			Neither: 3,
			x: 'Sweden',
			__tooltips: { Agree: 'Hey Fella', Disagree: 'Boop' },
			__labels: { Agree: ':)', Disagree: 'Yooo', Neither: '🫠' },
		},
		{ Agree: 1, 'Strongly Agree': 8, Disagree: 4, Neither: 2, x: 'Vietnam' },
		{ Agree: 5, 'Strongly Agree': 8, Disagree: 3, Neither: 4, x: 'Germany' },
		{
			Agree: 8,
			'Strongly Agree': 9,
			Disagree: 4,
			Neither: 8,
			x: 'French West Indies',
			isHighlighted: true,
		},
		{
			Agree: 10,
			'Strongly Agree': 3,
			Disagree: 6,
			Neither: 2,
			x: 'Philippines',
		},
	],
];

const lineData = [
	[
		{
			x: '1/2000',
			Smartphones: '20',
			Tablets: '30',
			PCs: '90',
			__tooltips: {
				Smartphones: 'in 2000: 20',
				Tablets: 'in 2000: 30',
			},
			__labels: { Smartphones: '20%', Tablets: '30%' },
		},
		{ x: '12/2010', Smartphones: '40', Tablets: '50', PCs: '55' },
		{ x: '3/2015', Smartphones: '', Tablets: '50', PCs: '60' },
		{ x: '2/2020', Smartphones: '70', Tablets: '30', PCs: '40' },
	],
];

const scatterData = [
	[
		{
			x: '2000',
			Smartphones: '20',
			Tablets: '30',
			__tooltips: {
				Smartphones: 'in 2000: 20',
				Tablets: 'in 2000: 30',
			},
			__labels: { Smartphones: '20%', Tablets: '30%' },
		},
		{ x: '2010', Smartphones: '40', Tablets: '50' },
		{ x: '2015', Smartphones: '', Tablets: '50' },
		{ x: '2020', Smartphones: '70', Tablets: '30' },
	],
];

const treemapData = [
	[
		{ x: 'Christians', y: 31, category: 'World religions' },
		{ x: 'Muslims', y: 25, category: 'World religions' },
		{ x: 'Unaffiliated', y: 16, category: 'World religions' },
		{ x: 'Hindus', y: 15, category: 'World religions' },
		{ x: 'Buddhists', y: 7, category: 'World religions' },
		{ x: 'Folk religions', y: 6, category: 'World religions' },
	],
];

export const VerticalBar: Story = {
	render: () => <ChartFrame config={verticalBarConfig} data={verticalBarData} />,
};

export const HorizontalBar: Story = {
	render: () => <ChartFrame config={horizontalBarConfig} data={[randomDataPointsCountries(5, 1, 100)]} />,
};

export const StackedBar: Story = {
	render: () => <ChartFrame config={stackedBarConfig} data={[randomDataPointsCountries(5, 1, 10)]} />,
};

export const VerticalStackedBar: Story = {
	render: () => <ChartFrame config={verticalStackedBarConfig} data={verticalStackedBarData} />,
};

export const DivergingBar: Story = {
	render: () => <ChartFrame config={divergingBarConfig} data={divergingData} />,
};

export const DivergingBarVertical: Story = {
	render: () => <ChartFrame config={divergingBarVerticalConfig} data={divergingData} />,
};

export const ExplodedBar: Story = {
	render: () => <ChartFrame config={explodedBarConfig} data={[randomDataPointsCountries(10, 1, 10)]} />,
};

export const DotPlot: Story = {
	render: () => <ChartFrame config={dotPlotConfig} data={[randomDataPointsCountries(8, 1, 10)]} />,
};

export const DotPlotWithErrorBars: Story = {
	render: () => <ChartFrame config={dotPlotWithErrorBarsConfig} data={[dotPlotData]} />,
};

export const Line: Story = {
	render: () => <ChartFrame config={lineConfig} data={lineData} />,
};

export const Scatter: Story = {
	render: () => <ChartFrame config={scatterConfig} data={scatterData} />,
};

export const Pie: Story = {
	render: () => <ChartFrame config={pieConfig} data={[randomDataPointsCountries(4, 2, 100)]} />,
};

export const Treemap: Story = {
	render: () => <ChartFrame config={treemapConfig} data={treemapData} />,
};

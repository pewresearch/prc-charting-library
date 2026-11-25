// React Dependencies
import { useContext, Suspense } from 'react';
// External Dependencies
import styled from '@emotion/styled';
// Internal Dependencies
import { BaseConfig, createLazyComponent, DataContext, TableData } from '@prc/charting-utilities';
import {
	BarHorizontal,
	BarVertical,
	BeeSwarm,
	DivergingBarHorizontal,
	DivergingBarVertical,
	DotPlot,
	ExplodedBar,
	Line,
	Pie,
	Radar,
	Scatter,
	StackedBarHorizontal,
	StackedBarVertical,
	StackedArea,
	Treemap,
	SankeyChart,
	SmallMultiples,
	Waffle,
	HeatMapTable,
	Hemicycle,
} from '../charts';

// Lazy load map components - these will be code-split with their topology files.
// createLazyComponent, unlike React.lazy, can load a failed chunk again.
const AlbersUSA = createLazyComponent(() => import('../charts/maps/AlbersUSA'));
const AlbersUSACounties = createLazyComponent(() => import('../charts/maps/AlbersUSACounties'));
const AlbersUSACBSA = createLazyComponent(() => import('../charts/maps/AlbersUSACBSA'));
const BlockUSA = createLazyComponent(() => import('../charts/maps/BlockUSA'));
const HexUSA = createLazyComponent(() => import('../charts/maps/HexUSA'));
const World = createLazyComponent(() => import('../charts/maps/World'));
const WorldOrthographic = createLazyComponent(() => import('../charts/maps/WorldOrthographic'));

const ChartContainer = styled.div<{ maxWidth: number; minHeight?: number }>`
	max-width: ${(props: { maxWidth: number; minHeight?: number }) => props.maxWidth}px;
	min-height: ${(props: { maxWidth: number; minHeight?: number }) =>
		props.minHeight !== undefined ? `${props.minHeight}px` : 'auto'};
	width: 100%;
	height: auto;
`;

const ChartBuilder = () => {
	const { config } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const { type, orientation, width, height } = config.layout;

	switch (type) {
		case 'bar':
			if (orientation === 'vertical') {
				return (
					<ChartContainer className="cb__chart cb__chart__bar--vertical" maxWidth={width} minHeight={height}>
						<BarVertical />
					</ChartContainer>
				);
			}
			return (
				<ChartContainer className="cb__chart cb__chart__bar--horizontal" maxWidth={width} minHeight={height}>
					<BarHorizontal />
				</ChartContainer>
			);
		case 'pie':
			return (
				<ChartContainer className="cb__chart cb__chart__pie" maxWidth={width} minHeight={height}>
					<Pie />
				</ChartContainer>
			);
		case 'stacked-bar':
			if (orientation === 'vertical') {
				return (
					<ChartContainer
						className="cb__chart cb__chart__stacked-bar--vertical"
						maxWidth={width}
						minHeight={height}
					>
						<StackedBarVertical />
					</ChartContainer>
				);
			}
			return (
				<ChartContainer
					className="cb__chart cb__chart__stacked-bar--horizontal"
					maxWidth={width}
					minHeight={height}
				>
					<StackedBarHorizontal />
				</ChartContainer>
			);
		case 'diverging-bar':
			if (orientation === 'vertical') {
				return (
					<ChartContainer
						className="cb__chart cb__chart__diverging-bar--vertical"
						maxWidth={width}
						minHeight={height}
					>
						<DivergingBarVertical />
					</ChartContainer>
				);
			}
			return (
				<ChartContainer
					className="cb__chart cb__chart__diverging-bar--horizontal"
					maxWidth={width}
					minHeight={height}
				>
					<DivergingBarHorizontal />
				</ChartContainer>
			);
		case 'exploded-bar':
			return (
				<ChartContainer className="cb__chart cb__chart__exploded-bar" maxWidth={width} minHeight={height}>
					<ExplodedBar />
				</ChartContainer>
			);
		case 'line':
			return (
				<ChartContainer className="cb__chart cb__chart__line" maxWidth={width} minHeight={height}>
					<Line />
				</ChartContainer>
			);
		case 'stacked-area':
			return (
				<ChartContainer className="cb__chart cb__chart__stacked-area" maxWidth={width} minHeight={height}>
					<StackedArea />
				</ChartContainer>
			);
		case 'dot-plot':
			return (
				<ChartContainer className="cb__chart cb__chart__dot-plot" maxWidth={width} minHeight={height}>
					<DotPlot />
				</ChartContainer>
			);
		case 'scatter':
			return (
				<ChartContainer className="cb__chart cb__chart__scatter" maxWidth={width} minHeight={height}>
					<Scatter />
				</ChartContainer>
			);
		case 'bee-swarm':
			return (
				<ChartContainer className="cb__chart cb__chart__bee-swarm" maxWidth={width} minHeight={height}>
					<BeeSwarm />
				</ChartContainer>
			);
		case 'map-usa':
			return (
				<ChartContainer className="cb__chart cb__chart__map-usa" maxWidth={width} minHeight={height}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<AlbersUSA />
					</Suspense>
				</ChartContainer>
			);
		case 'map-usa-counties':
			return (
				<ChartContainer className="cb__chart cb__chart__map-usa-counties" maxWidth={width} minHeight={height}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<AlbersUSACounties />
					</Suspense>
				</ChartContainer>
			);
		case 'map-usa-cbsa':
			return (
				<ChartContainer className="cb__chart cb__chart__map-usa-cbsa" maxWidth={width} minHeight={height}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<AlbersUSACBSA />
					</Suspense>
				</ChartContainer>
			);
		case 'map-usa-block':
			// Block cartogram SVG height scales with width (aspect-ratio grid).
			// Skip layout.height min-height so the wrapper doesn't leave dead
			// space when the map shrinks on narrow viewports.
			return (
				<ChartContainer className="cb__chart cb__chart__map-usa-block" maxWidth={width}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<BlockUSA />
					</Suspense>
				</ChartContainer>
			);
		case 'map-usa-hex':
			return (
				<ChartContainer className="cb__chart cb__chart__map-usa-hex" maxWidth={width}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<HexUSA />
					</Suspense>
				</ChartContainer>
			);
		case 'map-world':
			return (
				<ChartContainer className="cb__chart cb__chart__map-world" maxWidth={width} minHeight={height}>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<World />
					</Suspense>
				</ChartContainer>
			);
		case 'map-world-orthographic':
			return (
				<ChartContainer
					className="cb__chart cb__chart__map-world-orthographic"
					maxWidth={width}
					minHeight={height}
				>
					<Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading map...</div>}>
						<WorldOrthographic />
					</Suspense>
				</ChartContainer>
			);
		case 'treemap':
			return (
				<ChartContainer className="cb__chart cb__chart__treemap" maxWidth={width} minHeight={height}>
					<Treemap />
				</ChartContainer>
			);
		case 'sankey':
			return (
				<ChartContainer className="cb__chart cb__chart__sankey" maxWidth={width} minHeight={height}>
					<SankeyChart />
				</ChartContainer>
			);
		case 'radar':
			return (
				<ChartContainer className="cb__chart cb__chart__radar" maxWidth={width} minHeight={height}>
					<Radar />
				</ChartContainer>
			);
		case 'small-multiples':
			// SVG height is derived from locked panelHeight × rowCount.
			// Skip layout.height min-height so restack can grow the wrapper.
			return (
				<ChartContainer className="cb__chart cb__chart__small-multiples" maxWidth={width}>
					<SmallMultiples />
				</ChartContainer>
			);
		case 'waffle':
			return (
				<ChartContainer className="cb__chart cb__chart__waffle" maxWidth={width} minHeight={height}>
					<Waffle />
				</ChartContainer>
			);
		case 'heat-map-table':
			return (
				<ChartContainer className="cb__chart cb__chart__heat-map-table" maxWidth={width} minHeight={height}>
					<HeatMapTable />
				</ChartContainer>
			);
		case 'hemicycle':
			// SVG height follows the arc radius, so skip layout.height min-height.
			return (
				<ChartContainer className="cb__chart cb__chart__hemicycle" maxWidth={width}>
					<Hemicycle />
				</ChartContainer>
			);
		default:
			return (
				<ChartContainer className="cb__chart cb__chart__line" maxWidth={width} minHeight={height}>
					<Line />
				</ChartContainer>
			);
	}
};

export default ChartBuilder;

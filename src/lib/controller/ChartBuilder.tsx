// React Dependencies
import { useContext, lazy, Suspense } from 'react';
// External Dependencies
import styled from '@emotion/styled';
// Internal Dependencies
import { BaseConfig, DataContext, TableData } from '@prc/charting-utilities';
import {
	BarHorizontal,
	BarVertical,
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
} from '../charts';

// Lazy load map components - these will be code-split with their topology files
const AlbersUSA = lazy(() => import('../charts/maps/AlbersUSA'));
const AlbersUSACounties = lazy(() => import('../charts/maps/AlbersUSACounties'));
const AlbersUSACBSA = lazy(() => import('../charts/maps/AlbersUSACBSA'));
const BlockUSA = lazy(() => import('../charts/maps/BlockUSA'));
const HexUSA = lazy(() => import('../charts/maps/HexUSA'));
const World = lazy(() => import('../charts/maps/World'));
const WorldOrthographic = lazy(() => import('../charts/maps/WorldOrthographic'));

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
			} else {
				return (
					<ChartContainer
						className="cb__chart cb__chart__bar--horizontal"
						maxWidth={width}
						minHeight={height}
					>
						<BarHorizontal />
					</ChartContainer>
				);
			}
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
			} else {
				return (
					<ChartContainer
						className="cb__chart cb__chart__stacked-bar--horizontal"
						maxWidth={width}
						minHeight={height}
					>
						<StackedBarHorizontal />
					</ChartContainer>
				);
			}
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
			} else {
				return (
					<ChartContainer
						className="cb__chart cb__chart__diverging-bar--horizontal"
						maxWidth={width}
						minHeight={height}
					>
						<DivergingBarHorizontal />
					</ChartContainer>
				);
			}
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
		default:
			return (
				<ChartContainer className="cb__chart cb__chart__line" maxWidth={width} minHeight={height}>
					<Line />
				</ChartContainer>
			);
	}
};

export default ChartBuilder;

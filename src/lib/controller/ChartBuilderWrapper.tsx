// External dependencies
import { ErrorBoundary } from 'react-error-boundary';

// Internal dependencies
import ChartBuilder from './ChartBuilder';
import { DataProvider } from '@prc/charting-utilities';
import useChartStore, { ChartStoreSlice } from '../store/useChartStore';
// Types
import { BaseConfig } from '@prc/charting-utilities';
import { TableData } from '@prc/charting-utilities';

type WrapperProps = {
	data?: any;
	config?: BaseConfig;
	tableData?: TableData;
	fallbackImg?: string;
	wpEditorFunctions?: any;
	/**
	 * Editor-only animation preview flag (PRC-17). Forwarded into
	 * `DataContext` so `useAnimationConfig` lifts its editor-forced
	 * `immediate` for one entrance when the author clicks "Preview
	 * animation". The frontend (`view.js`) never passes this.
	 */
	animationPreview?: boolean;
	/**
	 * When provided, the wrapper subscribes to `state.charts[chartId]` in
	 * the named Interactivity store and overrides the `data`, `config`,
	 * and `tableData` props with whatever the store currently has. The
	 * props remain the source of truth on first mount and when the hook
	 * returns undefined (editor build, store slice missing, etc.).
	 */
	interactivityNamespace?: string;
	chartId?: string;
};

/**
 * Test-only render-count spy (PRC-17 slice 4). Completely inert in production:
 * it does nothing unless a test harness has first installed a counter map at
 * `window.__PRC_CHART_RENDER_COUNTS__`. The robustness gate uses it to assert
 * that an atomic `actions.setChart()` collapses a multi-field update (e.g. new
 * data + new config introducing a category) into a SINGLE wrapper render — a
 * torn render that self-heals on the next pass is invisible to final-DOM
 * assertions, so render count is the only reliable signal of atomicity.
 *
 * @param chartId Chart id whose renders to tally.
 */
function recordRender(chartId?: string) {
	if (typeof window === 'undefined' || !chartId) {
		return;
	}
	const counts = (window as any).__PRC_CHART_RENDER_COUNTS__;
	if (!counts) {
		return;
	}
	counts[chartId] = (counts[chartId] || 0) + 1;
}

function ErrorFallback(props: any) {
	const { error, fallbackImg } = props;
	console.log({ 'Error:': error.message });
	return (
		<>
			{fallbackImg && <img src={fallbackImg} alt="fallback" style={{ width: '100%', height: 'auto' }} />}
			{!fallbackImg && (
				<div role="alert">
					<p>This chart is currently unavailable. Please try again later</p>
				</div>
			)}
		</>
	);
}

const ChartBuilderWrapper = ({
	data,
	config,
	tableData,
	fallbackImg,
	wpEditorFunctions,
	animationPreview,
	interactivityNamespace,
	chartId,
}: WrapperProps) => {
	// useChartStore is a no-op stub in the editor build (webpack alias),
	// so this hook call is safe to run unconditionally. In the Preact view
	// bundle it subscribes to the live signal proxy and re-renders the
	// wrapper whenever any leaf of `state.charts[chartId]` mutates.
	const slice = useChartStore<ChartStoreSlice>(interactivityNamespace, chartId);

	// Tally this render for the atomicity gate (no-op in production).
	recordRender(chartId);

	// Slice always wins when present. The props are the seed values written
	// by `view.js`'s renderChart action before mount, which is also the
	// value the slice carries on first read, so the slice/prop selection is
	// identity-preserving until an external caller writes to the store.
	const resolvedData = slice?.data !== undefined ? slice.data : data;
	const resolvedConfig = slice?.config !== undefined ? (slice.config as BaseConfig) : config;
	const resolvedTableData = slice?.tableData !== undefined ? (slice.tableData as TableData) : tableData;

	// Config is required to render any chart — caller (view.js's renderChart
	// or editor-mounted ChartBuilder) must always provide one via either prop
	// or store seed. If neither is present, surface the fallback so we don't
	// crash mid-render.
	if (!resolvedConfig) {
		return <ErrorFallback error={new Error('ChartBuilderWrapper: missing config')} fallbackImg={fallbackImg} />;
	}

	return (
		// @ts-ignore
		<DataProvider
			value={{
				data: resolvedData,
				config: resolvedConfig,
				tableData: resolvedTableData,
				wpEditorFunctions,
				animationPreview,
			}}
		>
			<ErrorBoundary FallbackComponent={(props) => <ErrorFallback {...props} fallbackImg={fallbackImg} />}>
				<ChartBuilder />
			</ErrorBoundary>
		</DataProvider>
	);
};

export default ChartBuilderWrapper;

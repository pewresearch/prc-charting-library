/**
 * Editor-only stub for `useChartStore`. The editor (React) bundle does not
 * load `@wordpress/interactivity`, so the hook is a no-op that returns
 * undefined. Consumers (`ChartBuilderWrapper`) treat undefined as "fall
 * back to inline data/config/tableData props" — which is the editor's
 * existing behavior.
 *
 * The Preact view bundle never resolves to this file; webpack's `resolve.alias`
 * in the editor config swaps `./store/useChartStore` for this module so
 * `@wordpress/interactivity` is never imported into the editor bundle.
 */

export interface ChartStoreSlice {
	data?: unknown;
	config?: unknown;
	tableData?: unknown;
	attributes?: unknown;
	currentViewport?: string;
	isQuestionExpanded?: boolean;
	shouldRender?: boolean;
	chartHash?: string;
	iframeHeight?: number | null;
}

export function useChartStore<T = ChartStoreSlice>(_namespace?: string, _chartId?: string): T | undefined {
	return undefined;
}

export default useChartStore;

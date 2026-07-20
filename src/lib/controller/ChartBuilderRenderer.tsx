// React Dependencies
import { createRoot } from 'react-dom/client';
// Internal Dependencies
import ChartBuilderWrapper from './ChartBuilderWrapper';
// Types
import { BaseConfig } from '@prc/charting-utilities';
import { TableData } from '@prc/charting-utilities';

/**
 * Options form for `ChartBuilderRenderer`. When supplied, the wrapper
 * subscribes to `state.charts[chartId]` in the named interactivity store
 * and re-renders on signal mutations. Fallback props are used until/unless
 * the store slice is populated.
 */
export interface ChartBuilderRendererOptions {
	namespace: string;
	chartId: string;
	fallbackData?: any;
	fallbackConfig?: BaseConfig;
	fallbackTableData?: TableData;
}

function isOptions(value: unknown): value is ChartBuilderRendererOptions {
	return typeof value === 'object' && value !== null && 'namespace' in value && 'chartId' in value;
}

/**
 * Mount the `ChartBuilderWrapper` inside the DOM node `#${id}`.
 *
 * Two call signatures are supported. The new options form is the path
 * exercised by the Preact view bundle — it wires the wrapper to the
 * Interactivity store so any block on the page can drive the chart
 * by mutating `state.charts[chartId]`. The legacy positional form is
 * retained for `prc-custom-charts` and any standalone consumer that
 * still expects React semantics.
 *
 *   ChartBuilderRenderer(id, data, config, tableData)
 *   ChartBuilderRenderer(id, { namespace, chartId, fallbackData?, fallbackConfig?, fallbackTableData? })
 */
function ChartBuilderRenderer(id: string, options: ChartBuilderRendererOptions): void;
function ChartBuilderRenderer(id: string, data: any, config: BaseConfig, tableData?: TableData): void;
function ChartBuilderRenderer(
	id: string,
	secondArg: ChartBuilderRendererOptions | any,
	config?: BaseConfig,
	tableData?: TableData
): void {
	const root = document.getElementById(id);
	if (!root) {
		return;
	}

	if (isOptions(secondArg)) {
		const { namespace, chartId, fallbackData, fallbackConfig, fallbackTableData } = secondArg;
		createRoot(root).render(
			<ChartBuilderWrapper
				interactivityNamespace={namespace}
				chartId={chartId}
				data={fallbackData}
				config={fallbackConfig as BaseConfig}
				tableData={fallbackTableData}
			/>
		);
		return;
	}

	createRoot(root).render(
		<ChartBuilderWrapper data={secondArg} config={config as BaseConfig} tableData={tableData} />
	);
}

export default ChartBuilderRenderer;

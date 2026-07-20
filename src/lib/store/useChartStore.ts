/**
 * Subscribe a chart component to a per-chart slice of an
 * `@wordpress/interactivity` store. Reads the live signal proxy at
 * `store(namespace).state.charts[chartId]` and forces a re-render whenever
 * any tracked leaf of that slice mutates.
 *
 * The bridge uses `watch` (interactivity's re-export of
 * `@preact/signals`'s `effect`) for autotracking. Because tracking is owned
 * by interactivity's signals runtime — not the chart bundle's — this works
 * even though the chart Script Module and `@wordpress/interactivity` each
 * ship their own preact runtime. We do NOT rely on `@preact/signals`'s
 * implicit `options.diffed` integration, which would require a shared
 * preact instance.
 *
 * `useSyncExternalStore` drives the React/Preact re-render. We expose a
 * version-counter snapshot because the slice itself is a stable Proxy
 * reference — reads change but the ref does not, so a reference compare
 * would never trigger a re-render. The version is bumped inside the
 * `watch` callback so each tracked mutation produces a fresh snapshot.
 *
 * In the React editor build, `@wordpress/interactivity` is not loaded.
 * The hook still imports successfully (it's an externalized module ref);
 * at runtime, `store()` will throw or return undefined, so we guard and
 * return undefined. Editor consumers (`ChartBuilderWrapper`) fall back
 * to their existing `data`/`config`/`tableData` props.
 *
 * @template T
 * @param    namespace Interactivity store namespace (e.g. 'prc-chart-builder/chart').
 *                     Undefined disables the subscription (editor build).
 * @param    chartId   Chart instance id (matches `data-prc-chart-id`).
 *                     Undefined disables the subscription.
 * @return The live slice proxy at `state.charts[chartId]`, or undefined.
 */
import { useSyncExternalStore } from 'preact/compat';
import { useCallback, useRef } from 'preact/hooks';

// `@wordpress/interactivity` is a Script Module dep, externalized at build
// time. The editor (React/window-global) build never loads interactivity,
// so we tolerate runtime failures and return undefined.
import { store, watch } from '@wordpress/interactivity';

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

/**
 * Max recursion depth when deep-tracking the config subtree. Config is a
 * shallow, bounded object (axis/legend/colors/animation/etc.), so this only
 * guards against an unexpected cycle or pathological nesting.
 */
const TRACK_MAX_DEPTH = 8;

/**
 * Recursively READ every enumerable leaf of `node` so the interactivity
 * `PropSignal` for each accessed property (and each container's structure via
 * the `ownKeys` trap) is registered as a dependency of the enclosing `watch`.
 *
 * This is what makes a NESTED `setConfig` deep-merge reactive. Interactivity's
 * state proxy is per-property reactive: reading `slice.config` subscribes only
 * to the slice's `config` prop, NOT to `config.colors`. Slice 4's `setConfig`
 * mutates nested props in place (e.g. `config.colors`, `config.axis.x...`), so
 * without walking the subtree those mutations would fire signals nobody is
 * subscribed to and the chart would never re-render. `setData` /
 * `setTableData` replace their slice wholesale (a top-level prop write), so
 * they do NOT need deep tracking — only `config` does.
 *
 * Reading is the entire point — the returned values are discarded. Functions
 * and primitives are leaves: touching them via the parent's property read has
 * already subscribed, so we stop. A `WeakSet` guards against cycles.
 *
 * @param node  Current node (object, array, or leaf).
 * @param depth Current recursion depth.
 * @param seen  Visited objects, to break cycles.
 */
function trackDeep(node: unknown, depth: number, seen: WeakSet<object>): void {
	if (depth > TRACK_MAX_DEPTH || node === null || typeof node !== 'object') {
		return;
	}
	if (seen.has(node)) {
		return;
	}
	seen.add(node);
	if (Array.isArray(node)) {
		// Reading `.length` + each index subscribes to replacement and
		// per-element mutation.
		for (let i = 0; i < node.length; i++) {
			trackDeep(node[i], depth + 1, seen);
		}
		return;
	}
	// `for...in` over the proxy hits the `ownKeys` trap (subscribes to the
	// container's structure signal), and each value read subscribes to that
	// property's signal.
	for (const key in node as Record<string, unknown>) {
		let value: unknown;
		try {
			value = (node as Record<string, unknown>)[key];
		} catch {
			// A getter that throws (e.g. a pending computed) — skip it.
			continue;
		}
		trackDeep(value, depth + 1, seen);
	}
}

export function useChartStore<T = ChartStoreSlice>(namespace?: string, chartId?: string): T | undefined {
	const versionRef = useRef(0);
	const subscribe = useCallback(
		(notify: () => void): (() => void) => {
			if (!namespace || !chartId || typeof store !== 'function') {
				return () => {};
			}
			let dispose: (() => void) | undefined;
			try {
				dispose = watch(() => {
					const ns = store(namespace);
					const slice = (ns?.state as { charts?: Record<string, ChartStoreSlice> } | undefined)?.charts?.[
						chartId
					];
					if (slice) {
						// Touch each top-level prop so the interactivity-side
						// signals runtime registers a dependency on it. These
						// are replaced wholesale by their actions (setData,
						// setTableData, the slice-3 mount), so a top-level read
						// is enough to react to them.
						void slice.data;
						void slice.tableData;
						void slice.attributes;
						void slice.currentViewport;
						void slice.isQuestionExpanded;
						void slice.shouldRender;
						void slice.chartHash;
						void slice.iframeHeight;
						// `config` is mutated by `setConfig` IN PLACE at nested
						// paths (object-merge), so a top-level read alone would
						// miss those. Walk the whole config subtree to subscribe
						// at every path the deep-merge can touch.
						trackDeep(slice.config, 0, new WeakSet());
					}
					versionRef.current += 1;
					notify();
				});
			} catch {
				// Interactivity not loaded (editor build) or store namespace
				// not yet registered — caller falls back to props.
				return () => {};
			}
			return dispose ?? (() => {});
		},
		[namespace, chartId]
	);

	const getSnapshot = useCallback(() => versionRef.current, []);

	// preact/compat 10.x's useSyncExternalStore has a 2-arg signature
	// (no getServerSnapshot). The hook is not SSR-aware in preact, which is
	// fine for our purposes since the Preact view bundle only runs in the
	// browser.
	useSyncExternalStore(subscribe, getSnapshot);

	if (!namespace || !chartId || typeof store !== 'function') {
		return undefined;
	}
	try {
		const ns = store(namespace);
		const slice = (ns?.state as { charts?: Record<string, T> } | undefined)?.charts?.[chartId];
		return slice;
	} catch {
		return undefined;
	}
}

export default useChartStore;

/**
 * `react-dom/client` shim for the Preact (frontend) build.
 *
 * preact/compat ships through preact 10.x without `createRoot` / `hydrateRoot`
 * (see https://github.com/preactjs/preact/issues/3236). The chart library
 * source imports `createRoot` from `react-dom/client` because the React 18
 * editor build needs that API. In the Preact webpack config we alias
 * `react-dom/client` to this file, which re-exports preact/compat plus a
 * minimal React-18-shaped `createRoot` implemented on top of preact's
 * imperative `render(vnode, container)`.
 *
 * Only the React 18 client surface that the charting library actually uses is
 * implemented: createRoot(container).render(vnode) and root.unmount(). If
 * additional client APIs (hydrateRoot, root.unmount semantics around portals,
 * etc.) become needed, extend here.
 */

import * as compat from 'preact/compat';

const { render } = compat;

export function createRoot(container) {
	return {
		render(element) {
			render(element, container);
		},
		unmount() {
			render(null, container);
		},
	};
}

export default { ...compat, createRoot };

export * from 'preact/compat';

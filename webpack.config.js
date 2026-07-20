/**
 * Webpack configuration for PRC Charting Library
 *
 * Exports an ARRAY of webpack configs:
 *
 *   1. React (editor) build
 *      entry  : src/index.js
 *      output : build/editor.js  (+ build/editor.asset.php manifest)
 *      exposes window.prcChartingLibrary via output.library (classic script).
 *      babel  : caller.preactBuild = undefined  -> WP JSX pragma path.
 *
 *   2. Preact (frontend) build
 *      entry  : src/view.js
 *      output : build/view.js  (+ build/view.asset.php manifest)
 *      ES module, registered as Script Module @prc/charting-library.
 *      react / react-dom / react-dom/client / react/jsx-runtime are
 *      aliased to preact/compat; the bundle ships its own preact runtime.
 *      babel  : caller.preactBuild = true       -> automatic JSX runtime
 *                                                  with importSource 'preact'.
 *
 * @prc/charting-utilities is resolved via webpack alias (bundled into both
 * builds).
 *
 * IMPORTANT: WordPress VIP serves main bundles from _static optimized paths,
 * but chunks remain in the plugin directory. The editor build reads
 * `window.prcChartingLibraryConfig.buildUrl` (set by wp_localize_script) to
 * set __webpack_public_path__ at runtime. The Preact module build sets
 * `output.publicPath: 'auto'` so chunks resolve from import.meta.url; the
 * legacy global is still honored when present.
 * See class-prc-charting-library.php and src/publicPath.js.
 */
const path = require('path');
const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const DependencyExtractionWebpackPlugin = require('@wordpress/dependency-extraction-webpack-plugin');
const { requestToExternal, requestToExternalModule, requestToHandle } = require('../../dependency-extraction');

const chartingUtilitiesAlias = {
	'@prc/charting-utilities': path.resolve(
		__dirname,
		'../prc-scripts/includes/scripts/src/@prc/charting-utilities/index.ts'
	),
};

/**
 * Build a babel-loader rule that overrides wp-scripts' default rule so we can
 * pass a `caller` flag to babel.config.js. The flag drives the React/Preact
 * JSX runtime branch in babel.config.js.
 *
 * @param {boolean} preactBuild
 * @return {import('webpack').RuleSetRule}
 */
function babelRule(preactBuild) {
	return {
		test: /\.m?(j|t)sx?$/,
		exclude: /node_modules/,
		use: [
			{
				loader: require.resolve('babel-loader'),
				options: {
					cacheDirectory: process.env.BABEL_CACHE_DIRECTORY || true,
					caller: {
						name: 'wp-scripts',
						preactBuild,
					},
				},
			},
		],
	};
}

/**
 * Replace the babel-loader rule in a rules array (wp-scripts ships its own;
 * we keep all the other rules — css/scss/svg/asset — intact and just swap
 * the JS/TS rule).
 *
 * @param {import('webpack').RuleSetRule[]} rules
 * @param {boolean} preactBuild
 * @return {import('webpack').RuleSetRule[]}
 */
function withBabelRule(rules, preactBuild) {
	const replacement = babelRule(preactBuild);
	return rules.map((rule) => {
		if (rule && rule.test instanceof RegExp && rule.test.toString() === replacement.test.toString()) {
			return replacement;
		}
		return rule;
	});
}

const editorConfig = {
	...defaultConfig,
	name: 'editor',
	context: __dirname,
	entry: { editor: './src/index.js' },
	output: {
		...defaultConfig.output,
		path: path.resolve(__dirname, 'build'),
		library: { name: 'prcChartingLibrary', type: 'window' },
		// Disable wp-scripts' default `clean` — the two configs in this
		// array share build/ and would otherwise wipe each other's
		// artifacts. `npm run clean` handles full-clean explicitly.
		clean: false,
	},
	module: {
		...defaultConfig.module,
		rules: withBabelRule(defaultConfig.module.rules, false),
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve?.alias,
			...chartingUtilitiesAlias,
			// useChartStore imports `@wordpress/interactivity`, which the
			// editor (classic-script) bundle doesn't load. Swap the hook
			// for a no-op stub so the editor build never references the
			// interactivity module at all. The Preact view config below
			// resolves to the real implementation.
			[path.resolve(__dirname, 'src/lib/store/useChartStore')]: path.resolve(
				__dirname,
				'src/lib/store/useChartStore.editor.ts'
			),
		},
	},
};

// Preact view build: bundle vendor libraries in-tree (not window-global
// shims). The editor build externalizes these to classic-script vendors;
// the view must ship its own copies so Preact/compat is the React runtime
// and script modules are not coupled to window.* globals.
const bundleInViewBuild = new Set([
	'react',
	'react-dom',
	'react-dom/client',
	'react/jsx-runtime',
	'@wordpress/element',
	'd3-array',
	'd3-force',
	'd3-geo-projection',
	'dompurify',
	'@emotion/react',
	'@emotion/styled',
]);

function shouldBundleInViewBuild(request) {
	return bundleInViewBuild.has(request);
}

// Strip wp-scripts' default DependencyExtractionWebpackPlugin so we can supply
// our own per-build instance with the right externalization rules.
const basePluginsWithoutDep = (defaultConfig.plugins || []).filter(
	(plugin) => !(plugin instanceof DependencyExtractionWebpackPlugin)
);

editorConfig.plugins = [
	...basePluginsWithoutDep,
	new DependencyExtractionWebpackPlugin({
		requestToExternal,
		requestToExternalModule,
		requestToHandle,
	}),
];

const preactConfig = {
	...defaultConfig,
	name: 'view',
	context: __dirname,
	entry: { view: './src/view.js' },
	experiments: {
		...defaultConfig.experiments,
		outputModule: true,
	},
	output: {
		...defaultConfig.output,
		path: path.resolve(__dirname, 'build'),
		// Namespace chunk filenames so the editor (JSONP) and view (ES module)
		// builds don't write conflicting `205.js`-style chunks to the same
		// directory. webpack MultiCompiler runs configs in parallel and the
		// last writer wins — without this prefix the view runtime's ESM
		// loader would request a file containing JSONP and break dynamic
		// imports (notably the React.lazy map chunks).
		chunkFilename: 'view-[name].js?ver=[chunkhash]',
		// 'auto' lets the webpack runtime infer chunk URLs from import.meta.url.
		// publicPath.js still wins on platforms where the editor classic-script
		// localized buildUrl global is present (VIP _static rewrite case).
		publicPath: 'auto',
		module: true,
		chunkLoading: 'import',
		chunkFormat: 'module',
		environment: {
			...defaultConfig.output?.environment,
			module: true,
			dynamicImport: true,
		},
		library: { type: 'module' },
		// See editor config above — the two configs share build/.
		clean: false,
	},
	module: {
		...defaultConfig.module,
		rules: withBabelRule(defaultConfig.module.rules, true),
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve?.alias,
			...chartingUtilitiesAlias,
			// preact/compat replaces React on the frontend bundle. Order
			// matters: place the more-specific paths before 'react'/'react-dom'.
			// `react-dom/client`'s createRoot has no equivalent named export in
			// preact/compat 10.x, so we route it through our tiny shim.
			'react/jsx-runtime': 'preact/jsx-runtime',
			'react-dom/test-utils': 'preact/test-utils',
			'react-dom/client': path.resolve(__dirname, 'src/preact-create-root.js'),
			'react-dom': 'preact/compat',
			react: 'preact/compat',
		},
	},
	plugins: [
		...basePluginsWithoutDep,
		new DependencyExtractionWebpackPlugin({
			requestToExternal(request) {
				if (shouldBundleInViewBuild(request)) {
					return null;
				}
				return requestToExternal(request);
			},
			requestToExternalModule(request) {
				if (shouldBundleInViewBuild(request)) {
					return null;
				}
				return requestToExternalModule(request);
			},
			requestToHandle,
		}),
	],
};

module.exports = [editorConfig, preactConfig];

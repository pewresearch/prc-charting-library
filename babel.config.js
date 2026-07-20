/**
 * Babel config for @prc/charting-library.
 *
 * Function form: the React (editor) and Preact (view) webpack configs share
 * source under src/ but compile JSX differently. webpack passes a `caller`
 * option to babel-loader that we inspect via api.caller(); when
 * `caller.preactBuild === true` we emit a Preact-aware JSX runtime, otherwise
 * we keep the historical WordPress JSX pragma config for the editor build.
 *
 * The webpack/babel-loader caller flag is the single source of truth for the
 * React/Preact distinction — see webpack.config.js.
 */
module.exports = function (api) {
	const isPreactBuild = api.caller((caller) => Boolean(caller) && caller.preactBuild === true);

	if (isPreactBuild) {
		return {
			presets: [
				[
					'@babel/preset-react',
					{
						runtime: 'automatic',
						importSource: 'preact',
					},
				],
				'@babel/preset-env',
				'@babel/preset-typescript',
			],
			plugins: [
				'@babel/plugin-syntax-dynamic-import',
				'@babel/plugin-syntax-import-meta',
				'@babel/plugin-proposal-class-properties',
				'@babel/plugin-proposal-json-strings',
				[
					'@babel/plugin-proposal-decorators',
					{
						legacy: true,
					},
				],
				'@babel/plugin-proposal-function-sent',
				'@babel/plugin-proposal-export-namespace-from',
				'@babel/plugin-proposal-numeric-separator',
				'@babel/plugin-proposal-throw-expressions',
			],
		};
	}

	return {
		presets: ['@babel/preset-react', '@babel/preset-env', '@babel/preset-typescript'],
		plugins: [
			[
				'@wordpress/babel-plugin-import-jsx-pragma',
				{
					scopeVariable: 'createElement',
					scopeVariableFrag: 'Fragment',
					source: '@wordpress/element',
					isDefault: false,
				},
			],
			[
				'@babel/plugin-transform-react-jsx',
				{
					pragma: 'createElement',
					pragmaFrag: 'Fragment',
				},
			],
			'@babel/plugin-syntax-dynamic-import',
			'@babel/plugin-syntax-import-meta',
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-json-strings',
			[
				'@babel/plugin-proposal-decorators',
				{
					legacy: true,
				},
			],
			'@babel/plugin-proposal-function-sent',
			'@babel/plugin-proposal-export-namespace-from',
			'@babel/plugin-proposal-numeric-separator',
			'@babel/plugin-proposal-throw-expressions',
		],
	};
};

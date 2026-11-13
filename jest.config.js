/**
 * Jest configuration for charting-library plugin.
 * New unit tests live under monorepo root tests/prc-charting-library/unit/.
 * The plugin-local tests/ directory is the older suite.
 */
const path = require('path');

const pluginTests = path.resolve(__dirname, 'tests');
const unitRoot = path.resolve(__dirname, '../../tests/prc-charting-library/unit');

module.exports = {
	...require('@wordpress/scripts/config/jest-unit.config'),
	rootDir: path.resolve(__dirname, '../..'),
	roots: [pluginTests, unitRoot],
	testMatch: ['**/*.test.js'],
	moduleNameMapper: {
		'\\.(scss|css)$': path.join(pluginTests, '__mocks__/styleMock.js'),
		'^@prc/charting-utilities$':
			'<rootDir>/plugins/prc-shared/includes/scripts/src/@prc/charting-utilities/index.ts',
	},
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': require.resolve('@wordpress/scripts/config/babel-transform'),
	},
	// No trailing slash after the group: packages like `d3-force` need the
	// prefix alternative to match the rest of the directory name, not just `d3-/`.
	transformIgnorePatterns: ['/node_modules/(?!(@visx|d3-|internmap|delaunator|robust-predicates))'],
};

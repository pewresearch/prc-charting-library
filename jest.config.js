/**
 * Jest configuration for charting-library plugin
 */
module.exports = {
	...require('@wordpress/scripts/config/jest-unit.config'),
	testMatch: ['**/tests/**/*.test.js'],
	moduleNameMapper: {
		'\\.(scss|css)$': '<rootDir>/tests/__mocks__/styleMock.js',
	},
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': require.resolve('@wordpress/scripts/config/babel-transform'),
	},
	// No trailing slash after the group: packages like `d3-force` need the
	// prefix alternative to match the rest of the directory name, not just `d3-/`.
	transformIgnorePatterns: ['/node_modules/(?!(@visx|d3-|internmap|delaunator|robust-predicates))'],
};

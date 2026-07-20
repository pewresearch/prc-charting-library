module.exports = {
	extends: ['../../.eslintrc.js'],
	rules: {
		// Disable problematic WordPress design system token rules
		'@wordpress/no-setting-ds-tokens': 'off',
		'@wordpress/no-unknown-ds-tokens': 'off',
		// Disable import resolution errors
		'import/no-unresolved': 'off',
		'import/no-extraneous-dependencies': 'off',
		'max-lines-per-function': 'off',
		'max-lines': 'off',
		// Prettier's opinionated line-wrapping rules are too aggressive for
		// complex TypeScript chart components — disable the ESLint integration
		// so formatting violations don't surface as errors. Prettier can still
		// be run manually to auto-format, but it won't block editing.
		'prettier/prettier': 'off',
	},
	settings: {
		// Override import resolver to prevent typescript resolver errors
		'import/resolver': {
			node: {},
		},
	},
};

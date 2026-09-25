/**
 * Click-to-hide must call Interactivity from `useChartStore`, not from
 * ChartBuilderWrapper. Webpack aliases that module to a stub in the editor
 * classic script, which cannot depend on the `wp-interactivity` handle.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockToggleAction = jest.fn();

jest.mock('preact/compat', () => ({
	useSyncExternalStore: jest.fn(),
}));
jest.mock('preact/hooks', () => ({
	useCallback: jest.fn(),
	useRef: jest.fn(),
}));
jest.mock(
	'@wordpress/interactivity',
	() => ({
		store: jest.fn(() => ({
			actions: { toggleHiddenSeries: mockToggleAction },
		})),
		watch: jest.fn(),
	}),
	{ virtual: true }
);

describe('chart store frontend interactivity', () => {
	beforeEach(() => {
		mockToggleAction.mockClear();
	});

	it('dispatches toggleHiddenSeries through the interactivity store', () => {
		const { toggleHiddenSeries } = require('../../src/lib/store/useChartStore');
		toggleHiddenSeries('prc-chart-builder/chart', 'chart-1', 'Dems');
		expect(mockToggleAction).toHaveBeenCalledWith('chart-1', 'Dems');
	});

	it('editor stub toggleHiddenSeries is a no-op', () => {
		const { toggleHiddenSeries } = require('../../src/lib/store/useChartStore.editor');
		expect(() => toggleHiddenSeries('prc-chart-builder/chart', 'chart-1', 'Dems')).not.toThrow();
		expect(mockToggleAction).not.toHaveBeenCalled();
	});

	it('ChartBuilderWrapper does not import @wordpress/interactivity', () => {
		const source = readFileSync(join(__dirname, '../../src/lib/controller/ChartBuilderWrapper.tsx'), 'utf8');
		expect(source).not.toMatch(/from ['"]@wordpress\/interactivity['"]/);
	});
});

import { describe, expect, test } from '@jest/globals';
import {
	hasCategoryValue,
	isMissingValue,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/helpers';

describe('isMissingValue', () => {
	test('undefined, null, and empty string are missing; zero is a value', () => {
		expect([undefined, null, ''].map(isMissingValue)).toEqual([true, true, true]);
		expect([0, '0', 5, 'A', false].map(isMissingValue)).toEqual([false, false, false, false, false]);
	});
});

describe('hasCategoryValue', () => {
	test('keeps zero and drops missing cells', () => {
		expect(hasCategoryValue({ a: 0 }, 'a')).toBe(true);
		expect(hasCategoryValue({ a: '' }, 'a')).toBe(false);
		expect(hasCategoryValue({}, 'a')).toBe(false);
		expect(hasCategoryValue(undefined, 'a')).toBe(false);
	});
});

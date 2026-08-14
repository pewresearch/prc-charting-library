import { resolveShapePaint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/resolveShapePaint';

describe('resolveShapePaint', () => {
	it('falls back to defaults when no custom styles are set', () => {
		expect(
			resolveShapePaint(undefined, {
				fill: '#456A83',
				stroke: '#ffffff',
				strokeWidth: 1,
				opacity: 1,
			})
		).toEqual({
			fill: '#456A83',
			stroke: '#ffffff',
			strokeWidth: 1,
			opacity: 1,
		});
	});

	it('overrides defaults with customStyles values', () => {
		expect(
			resolveShapePaint(
				{ fill: '#f00', stroke: '#0f0', strokeWidth: 3, opacity: 0.5 },
				{ fill: '#456A83', stroke: '#fff', strokeWidth: 1, opacity: 1 }
			)
		).toEqual({
			fill: '#f00',
			stroke: '#0f0',
			strokeWidth: 3,
			opacity: 0.5,
		});
	});

	it('multiplies custom opacity by series opacity', () => {
		expect(resolveShapePaint({ opacity: 0.5 }, { fill: '#000', opacity: 0.8 })).toEqual({
			fill: '#000',
			stroke: undefined,
			strokeWidth: undefined,
			opacity: 0.4,
		});
	});
});

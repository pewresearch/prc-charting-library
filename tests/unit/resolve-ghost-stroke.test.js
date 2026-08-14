import { resolveGhostStroke } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/resolveGhostStroke';

describe('resolveGhostStroke', () => {
	it('prefers dataRender deselectedColor over smallMultiples.ghost.stroke', () => {
		expect(
			resolveGhostStroke({
				deselectedColor: '#EEECE4',
				ghostStroke: '#E6E7E8',
			})
		).toEqual({ stroke: '#EEECE4', opacity: 1 });
	});

	it('falls back to ghost.stroke then a default', () => {
		expect(resolveGhostStroke({ ghostStroke: '#abc' })).toEqual({
			stroke: '#abc',
			opacity: 1,
		});
		expect(resolveGhostStroke({})).toEqual({
			stroke: '#E6E7E8',
			opacity: 1,
		});
	});

	it('resolves opacity from deselectedOpacity with ghost fallback', () => {
		expect(
			resolveGhostStroke({
				deselectedOpacity: 0.4,
				ghostOpacity: 0.9,
			}).opacity
		).toBe(0.4);
		expect(resolveGhostStroke({ ghostOpacity: 0.9 }).opacity).toBe(0.9);
		expect(resolveGhostStroke({}).opacity).toBe(1);
	});
});

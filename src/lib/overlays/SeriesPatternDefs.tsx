import { isHatchingPattern, seriesPatternId, type CategoryStyle } from '@prc/charting-utilities';
import { PatternDef } from '../primitives/PatternDef';

export type SeriesPatternDefsProps = {
	seriesStyles?: Record<string, CategoryStyle | undefined>;
	/** Resolved mark fill for a category, so the hatch keeps the series color. */
	resolveFill?: (category: string) => string | undefined;
};

/**
 * SVG hatch defs for every series that sets a non-solid pattern.
 */
export function SeriesPatternDefs({ seriesStyles = {}, resolveFill }: SeriesPatternDefsProps) {
	const hatches = Object.entries(seriesStyles).filter(([, style]) => isHatchingPattern(style?.pattern));

	if (hatches.length === 0) {
		return null;
	}

	return (
		<>
			{hatches.map(([category, style]) => (
				<PatternDef
					key={category}
					id={seriesPatternId(category)}
					pattern={style?.pattern ?? 'striped'}
					fill={resolveFill?.(category) ?? style?.fill}
				/>
			))}
		</>
	);
}

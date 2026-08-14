import type { DeclutterOffset, OnLineSeriesDeclutterInput } from '@prc/charting-utilities';

/**
 * Categories whose on-line series labels were omitted by declutter.
 *
 * When `declutterOmitWithin` drops a series name, first/last value labels for
 * that series should disappear too — otherwise a chart can show a stray "<1%"
 * with no legend text naming the line.
 */
export function getOmittedDirectLegendCategories(
	inputs: OnLineSeriesDeclutterInput[],
	offsets: Map<string, DeclutterOffset>
): Set<string> {
	const omitted = new Set<string>();

	for (const input of inputs) {
		if (offsets.get(input.id)?.hidden) {
			omitted.add(input.category);
		}
	}

	return omitted;
}

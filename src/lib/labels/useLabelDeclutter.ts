import { useMemo } from 'react';

import { computeLabelDeclutter } from '@prc/charting-utilities';
import type { DeclutterLabelInput, DeclutterOffset, DeclutterOptions } from '@prc/charting-utilities';

export function useLabelDeclutter(
	inputs: DeclutterLabelInput[],
	options: DeclutterOptions,
	enabled: boolean
): Map<string, DeclutterOffset> {
	const signature = useMemo(
		() =>
			enabled
				? inputs
						.map(
							(input) =>
								`${input.id}:${input.x}:${input.y}:${input.text}:${input.defaultDx ?? 0}:${input.defaultDy ?? 0}:${input.locked ? 1 : 0}`
						)
						.join('|')
				: '',
		[enabled, inputs]
	);

	return useMemo(() => {
		if (!enabled || inputs.length === 0) {
			return new Map<string, DeclutterOffset>();
		}
		return computeLabelDeclutter(inputs, options);
		// signature captures input mutations without requiring a new array reference each render
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		enabled,
		signature,
		options.padding,
		options.lockX,
		options.lockY,
		options.iterations,
		options.innerWidth,
		options.innerHeight,
	]);
}

export function getDeclutterOffset(
	offsets: Map<string, DeclutterOffset>,
	id: string,
	defaultDx = 0,
	defaultDy = 0
): DeclutterOffset {
	return offsets.get(id) ?? { dx: defaultDx, dy: defaultDy };
}

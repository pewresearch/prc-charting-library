import { useLayoutEffect } from 'react';

import { useLeaderLineStore } from './LeaderLineContext';
import type { LeaderLineRegistration } from '@prc/charting-utilities';

export function useLeaderLineRegistration(id: string, entry: Omit<LeaderLineRegistration, 'id'> | null) {
	const leaderLineStore = useLeaderLineStore();

	useLayoutEffect(() => {
		if (!entry) {
			return () => leaderLineStore.unregister(id);
		}

		leaderLineStore.register({ id, ...entry });
		return () => leaderLineStore.unregister(id);
		// entry fields listed explicitly — spreading `entry` would re-fire on new object identity each render.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see above
	}, [
		id,
		entry?.anchorX,
		entry?.anchorY,
		entry?.labelCenterX,
		entry?.labelCenterY,
		entry?.text,
		entry?.fontSize,
		entry?.fontFamily,
		entry?.fontWeight,
		entry?.maxWidth,
		entry?.textAnchor,
		entry?.dominantBaseline,
		entry?.anchorRadius,
		entry?.stroke,
		entry?.strokeWidth,
		entry?.threshold,
		leaderLineStore,
	]);
}

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createLeaderLineStore, type LeaderLineStore } from '@prc/charting-utilities';

const LeaderLineContext = createContext<LeaderLineStore | null>(null);

/**
 * One leader-line registry per chart mount so multiple charts on a page do not
 * share connector geometry or collide on duplicate label ids.
 */
export function LeaderLineProvider({ children }: { children: ReactNode }) {
	const store = useMemo(() => createLeaderLineStore(), []);

	return <LeaderLineContext.Provider value={store}>{children}</LeaderLineContext.Provider>;
}

export function useLeaderLineStore(): LeaderLineStore {
	const store = useContext(LeaderLineContext);

	if (!store) {
		throw new Error('useLeaderLineStore must be used within LeaderLineProvider');
	}

	return store;
}

import { useMemo } from 'react';

import type { FlatData } from '@prc/charting-utilities';
import {
	hasExplicitAxisDomain,
	resolveLinearScaleDomain,
	resolveScaleNice,
	resolveTimeScaleDomain,
} from '@prc/charting-utilities';
import { scaleLinear, scaleTime } from '@visx/scale';
import { extent, max } from '@visx/vendor/d3-array';

type AxisConfig = {
	scale?: string;
	domain?: unknown;
	nice?: boolean;
};

type LinearDomainPair = [number, number];

export type UseLineFamilyScalesArgs<T extends FlatData = FlatData> = {
	independentAxis: AxisConfig;
	dependentAxis: AxisConfig;
	innerWidth: number;
	innerHeight: number;
	flattenedData: T[];
	getIndependentValue: (datum: T) => number | Date;
	getDependentValue: (datum: T) => number;
	/** Override dependent-axis extent (e.g. stacked category sums). */
	getDependentDomainExtent?: (data: T[]) => LinearDomainPair;
};

export function useLineFamilyScales<T extends FlatData = FlatData>({
	independentAxis,
	dependentAxis,
	innerWidth,
	innerHeight,
	flattenedData,
	getIndependentValue,
	getDependentValue,
	getDependentDomainExtent,
}: UseLineFamilyScalesArgs<T>) {
	const timeScale = useMemo(() => {
		const dataExtent = extent(flattenedData, getIndependentValue) as [Date, Date];
		return scaleTime({
			domain: resolveTimeScaleDomain(independentAxis.domain, dataExtent) ?? dataExtent,
			range: [0, innerWidth],
		});
	}, [innerWidth, flattenedData, getIndependentValue, independentAxis.domain]);

	const linearIndependentScale = useMemo(() => {
		const dataExtent: LinearDomainPair = [0, (max(flattenedData, getIndependentValue) as number) || 0];
		return scaleLinear({
			domain: resolveLinearScaleDomain(independentAxis.domain, dataExtent),
			range: [0, innerWidth],
		});
	}, [innerWidth, independentAxis.domain, flattenedData, getIndependentValue]);

	const independentScale = independentAxis.scale === 'time' ? timeScale : linearIndependentScale;

	const dependentScale = useMemo(() => {
		const dataExtent = getDependentDomainExtent
			? getDependentDomainExtent(flattenedData)
			: ([0, (max(flattenedData, getDependentValue) as number) || 0] as LinearDomainPair);
		const hasExplicitDomain = hasExplicitAxisDomain(dependentAxis.domain);
		return scaleLinear({
			domain: resolveLinearScaleDomain(dependentAxis.domain, dataExtent),
			range: [innerHeight, 0],
			nice: resolveScaleNice(dependentAxis.nice, hasExplicitDomain),
		});
	}, [
		innerHeight,
		flattenedData,
		dependentAxis.domain,
		dependentAxis.nice,
		getDependentValue,
		getDependentDomainExtent,
	]);

	return {
		timeScale,
		linearIndependentScale,
		independentScale,
		dependentScale,
		hasExplicitIndependentDomain: hasExplicitAxisDomain(independentAxis.domain),
		hasExplicitDependentDomain: hasExplicitAxisDomain(dependentAxis.domain),
	};
}

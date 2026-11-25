// External dependencies
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useCallback, type ReactNode } from 'react';

// Internal dependencies
import { retryFailedResources } from '@prc/charting-utilities';

export function ErrorFallback(props: { error: Error; fallbackImg?: string }) {
	const { error, fallbackImg } = props;
	// eslint-disable-next-line no-console
	console.log({ 'Error:': error.message });
	return (
		<>
			{fallbackImg && <img src={fallbackImg} alt="fallback" style={{ width: '100%', height: 'auto' }} />}
			{!fallbackImg && (
				<div role="alert">
					<p>This chart is currently unavailable. Please try again later</p>
				</div>
			)}
		</>
	);
}

type ChartErrorBoundaryProps = {
	/** A change in any key leaves the fallback and renders the chart again. */
	resetKeys: unknown[];
	fallbackImg?: string;
	children: ReactNode;
};

/**
 * Shows the fallback when a chart throws. When a reset key changes (new data
 * or config), it renders the chart again and lets failed map chunks and
 * topology files import again. Model:
 * tests/prc-charting-library/formal/map-loading/MapLoading.tla.
 */
export function ChartErrorBoundary({ resetKeys, fallbackImg, children }: ChartErrorBoundaryProps) {
	const renderFallback = useCallback(
		({ error }: FallbackProps) => <ErrorFallback error={error} fallbackImg={fallbackImg} />,
		[fallbackImg]
	);
	return (
		<ErrorBoundary fallbackRender={renderFallback} resetKeys={resetKeys} onReset={retryFailedResources}>
			{children}
		</ErrorBoundary>
	);
}

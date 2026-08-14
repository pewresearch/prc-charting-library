// External Imports
import {
	createElement,
	Fragment,
	useContext,
	useMemo,
	useRef,
	useState,
	useEffect,
	useCallback,
	CSSProperties,
	ReactNode,
	RefObject,
	PointerEvent as ReactPointerEvent,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent as ReactMouseEvent,
} from 'react';
import * as topojson from 'topojson-client';
import DOMPurify from 'dompurify';

// Visx Imports
import { CustomProjection, Graticule } from '@visx/geo';
import { geoOrthographic, geoDistance } from '@visx/vendor/d3-geo';
import { scaleLinear, scaleOrdinal, scaleSqrt, scaleThreshold } from '@visx/scale';
import { LegendThreshold, LegendOrdinal, LegendLinear } from '@visx/legend';
import { useTooltip } from '@visx/tooltip';
import { EventType } from '@visx/event/lib/types';
import { Group } from '@visx/group';

// STYLED COMPONENTS
import styled from '@emotion/styled';

// Local Imports
import { DataContext } from '@prc/charting-utilities';
import { BaseConfig } from '@prc/charting-utilities';
import {
	useSize,
	labelFill,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	generateElementKey,
	useWorldCountryData,
} from '@prc/charting-utilities';
import {
	getChartDimensions,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
} from '@prc/charting-utilities';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../../overlays';
import { DraggableLabel } from '../../labels';
import MapGeoPointLayer from './MapGeoPointLayer';
// Types
import type { Size } from '@prc/charting-utilities';
import type { FlatData } from '@prc/charting-utilities';
import type { FeatureShape } from '@prc/charting-utilities';
import type { TableData } from '@prc/charting-utilities';
// Internal
import { getDisplayCentroid } from './getDisplayCentroid';
import { TransitionProvider, useChartTransition, useLabelOpacity, useTransitionTiming } from '../../animation';
import { animated, useSpring } from '@react-spring/web';
import type { AnnotationsConfig } from '@prc/charting-utilities';

// Orthographic globes always use a full-world topology — regional topology
// presets (used by the Robinson `World` map) are not applicable. `locator` is a
// deliberately coarser world file with broader country coverage for small
// decorative globes; `full` keeps the richer 50m coastlines.
const TOPOLOGY_LOADERS = {
	full: createTopologyLoader(() => import('../../data/maps/world/countries-50m.json')),
	locator: createTopologyLoader(() => import('../../data/maps/world/countries-locator.json')),
};

const projection = geoOrthographic;

// Degrees of globe rotation applied per pixel of pointer drag.
const DRAG_SENSITIVITY = 0.25;

/**
 * Shortest signed delta from one longitude/rotation angle to another.
 * Keeps country→country turns from spinning the long way around the globe.
 */
function shortestAngleDelta(from: number, to: number): number {
	let delta = to - from;
	while (delta > 180) {
		delta -= 360;
	}
	while (delta < -180) {
		delta += 360;
	}
	return delta;
}

/**
 * Annotations that follow the TransitionProvider clock: freeze the previous
 * label during `exiting` so the old country name fades out, stay hidden while
 * the globe turns, then fade in the new name. Without this the overlay text
 * swaps mid-spin.
 */
function TransitioningAnnotationsLayer({
	annotations,
	...layerProps
}: {
	annotations: AnnotationsConfig;
	width: number;
	height: number;
	layout: BaseConfig['layout'];
	chartWidth: number;
}) {
	const { phase, immediate, timing } = useChartTransition();
	const opacity = useLabelOpacity({ phase, timing, immediate });
	// Freeze the last settled annotations during exit. Only refresh the
	// snapshot once we've left `exiting` — never while holding the old name.
	const snapshotRef = useRef(annotations);
	if (phase !== 'exiting' && phase !== 'animating') {
		snapshotRef.current = annotations;
	}

	const rendered = phase === 'exiting' ? snapshotRef.current : annotations;
	const layer = (
		<AnnotationsLayer
			config={rendered}
			width={layerProps.width}
			height={layerProps.height}
			layout={layerProps.layout}
			chartWidth={layerProps.chartWidth}
		/>
	);

	if (immediate) {
		return layer;
	}

	return <animated.g style={{ opacity }}>{layer}</animated.g>;
}

function getPrefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

/** Track OS reduced-motion preference; updates if the user changes the setting. */
function usePrefersReducedMotion(): boolean {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

	useEffect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return undefined;
		}
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	return prefersReducedMotion;
}

// Tags we allow through from sanitized tooltip markup. Tooltip HTML is produced
// by `getTooltipFormat` (inline-styled <span>s) or authored as a custom tooltip
// in the editor — both flow through DOMPurify before being converted to React.
const ALLOWED_TOOLTIP_TAGS = new Set(['span', 'strong', 'b', 'em', 'i', 'u', 'small', 'sup', 'sub', 'br', 'p', 'div']);

/** Convert an inline `style` attribute string into a React style object. */
function styleStringToObject(style: string): CSSProperties {
	const obj: Record<string, string> = {};
	style.split(';').forEach((decl) => {
		const idx = decl.indexOf(':');
		if (idx === -1) return;
		const prop = decl.slice(0, idx).trim();
		const value = decl.slice(idx + 1).trim();
		if (!prop) return;
		const camel = prop.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
		obj[camel] = value;
	});
	return obj as CSSProperties;
}

/** Recursively convert a sanitized DOM node into React nodes. */
function domNodeToReact(node: ChildNode, key: string): ReactNode {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return null;
	}
	const el = node as HTMLElement;
	const tag = el.tagName.toLowerCase();
	const children = Array.from(el.childNodes).map((child, i) => domNodeToReact(child, `${key}-${i}`));
	// Unknown/disallowed wrapper: keep its (already-sanitized) children, drop the tag.
	if (!ALLOWED_TOOLTIP_TAGS.has(tag)) {
		return <Fragment key={key}>{children}</Fragment>;
	}
	if (tag === 'br') {
		return <br key={key} />;
	}
	const props: { key: string; style?: CSSProperties } = { key };
	const styleAttr = el.getAttribute('style');
	if (styleAttr) {
		props.style = styleStringToObject(styleAttr);
	}
	return createElement(tag, props, children.length ? children : undefined);
}

/**
 * Render an HTML string as React nodes without `dangerouslySetInnerHTML`.
 * The string is sanitized with DOMPurify, then walked and rebuilt as elements
 * so inline-styled tooltip spans keep their formatting safely.
 */
function SafeHtml({ html }: { html: string }) {
	const nodes = useMemo(() => {
		const sanitized = DOMPurify.sanitize(html, {
			USE_PROFILES: { html: true },
		});
		const doc = new DOMParser().parseFromString(sanitized, 'text/html');
		return Array.from(doc.body.childNodes).map((n, i) => domNodeToReact(n, `t-${i}`));
	}, [html]);
	return <>{nodes}</>;
}

// remove focus outline from map features when focused
const MapFeature = styled.path`
	-webkit-tap-highlight-color: transparent;
	-webkit-touch-callout: none;
	-webkit-user-select: none;
	-khtml-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	&:focus {
		outline: none;
	}
`;

const GlobeRotationButton = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 44px;
	min-height: 44px;
	padding: 0;
	border: none;
	background: none;
	appearance: none;
	color: var(--wp--preset--color--ui-gray-light);
	cursor: pointer;

	&:hover {
		color: var(--wp--preset--color--ui-gray-dark);
	}

	&:focus {
		outline: none;
	}

	&:focus-visible {
		outline: 2px solid var(--wp--preset--color--ui-link-color, #346ead);
		outline-offset: 2px;
		color: var(--wp--preset--color--ui-gray-dark);
	}
`;

const WorldOrthographic = () => {
	const { config, data, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const { layout, colors, dataRender, labels, legend, tooltip, map, shapes, annotations, drawings } = config;

	// Suspense-compatible resource loading. Locator topology is coarser and
	// broader; default stays on the full 50m world file.
	const topologyKey = map.globe?.topology === 'locator' ? 'locator' : 'full';
	const topology = TOPOLOGY_LOADERS[topologyKey]();

	const { features: world } = useMemo(
		() =>
			topojson.feature(topology.default, topology.default.objects.countries) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[topology]
	);

	// SIZE AND LAYOUT
	const { parentClass, padding, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);
	const { chartWidth, chartHeight, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const flattenedData = useMemo(
		() =>
			data.reduce((acc: string | any[], curr: any) => {
				return acc.concat(curr);
			}, []),
		[data]
	);

	const mapCategory = dataRender.categories[0];

	// Merge FlatData rows onto country features via the shared hook.
	const { mergedData, mergedAndFilteredData } = useWorldCountryData({
		features: world,
		flattenedData,
		category: mapCategory,
	});

	// Explicit lat/lon point overlay (dataRender.mapStyle === 'geo-points').
	const isGeoPointsMode = dataRender.mapStyle === 'geo-points';
	const geoPoints = map.geoPoints;
	const sizeCategory = geoPoints?.sizeCategory || mapCategory;
	const hasFixedRadius = typeof geoPoints?.fixedRadius === 'number';

	const maxDataValue = useMemo(() => {
		if (!isGeoPointsMode || hasFixedRadius) return 0;
		return Math.max(
			0,
			...flattenedData.map((d: FlatData) => {
				const v = d[sizeCategory];
				const n = typeof v === 'number' ? v : parseFloat(v as string);
				return isNaN(n) ? 0 : Math.abs(n);
			})
		);
	}, [isGeoPointsMode, flattenedData, sizeCategory, hasFixedRadius]);

	const bubbleScaleMaxValue =
		map.bubble?.maxValue && map.bubble.maxValue > 0 ? map.bubble.maxValue : maxDataValue || 1;

	const bubbleRadiusScale = useMemo(
		() =>
			scaleSqrt({
				domain: [0, bubbleScaleMaxValue],
				range: [map.bubble?.minRadius ?? 4, map.bubble?.maxRadius ?? 24],
			}),
		[bubbleScaleMaxValue, map.bubble?.minRadius, map.bubble?.maxRadius]
	);

	// Every row gets a point, including ones whose country the topology did
	// draw. On a small globe a highlighted polygon is not a reliable signal —
	// Singapore is a couple of pixels and some island nations have no polygon
	// at all — so the marker, not the fill, is what the reader actually locates.
	const geoPointRows = isGeoPointsMode ? flattenedData : [];

	// COLOR SCALES
	const thresholdScale = scaleThreshold<number, string>({
		domain: dataRender.mapScaleDomain as number[],
		range: colors,
	});
	const ordinalScale = scaleOrdinal({
		domain: dataRender.mapScaleDomain as string[],
		range: colors,
	});
	const linearScale = scaleLinear({
		domain: dataRender.mapScaleDomain as number[],
		range: colors.map((c: string) => {
			const m = c.match(/^light-dark\(([^,]+),/);
			return m ? m[1].trim() : c;
		}),
	});

	const getFill = (id: number | string, featureData: any, category: string) => {
		if (!id) return 'transparent';
		if (!featureData?.[category]) return map.pathBackgroundFill;
		if (dataRender.mapScale === 'linear') {
			return linearScale(featureData?.[category]);
		}
		if (dataRender.mapScale === 'ordinal') {
			return ordinalScale(featureData?.[category]);
		}
		return thresholdScale(featureData?.[category]);
	};

	// ORTHOGRAPHIC PROJECTION GEOMETRY
	// Globe behaviour config (drag/auto-spin). Guard each field so blocks saved
	// before the `globe` config existed still render with sensible defaults.
	const dragToRotate = map.globe?.dragToRotate ?? true;
	const autoSpin = map.globe?.autoSpin ?? false;
	const spinSpeed = map.globe?.spinSpeed ?? 0.2;
	const showPlayPause = map.globe?.showPlayPause ?? true;
	const playPausePosition = map.globe?.playPausePosition ?? 'bottom-right';
	const sphereFill = map.globe?.sphereFill ?? 'light-dark(#eef3f6, #1b2a33)';
	const showGraticule = map.globe?.showGraticule ?? true;
	const graticuleStroke = map.globe?.graticuleStroke ?? 'light-dark(#cdd8de, #2f4250)';
	const prefersReducedMotion = usePrefersReducedMotion();
	const spinFromConfig = autoSpin && !prefersReducedMotion;

	// Initial rotation seeded from the map projection config. Center longitude /
	// latitude rotate the globe to face a region; rotate* fine-tunes the view.
	const seededRotation = useMemo<[number, number, number]>(
		() => [map.rotateLambda - map.centerLongitude, map.rotatePhi - map.centerLatitude, map.rotateGamma],
		[map.rotateLambda, map.centerLongitude, map.rotatePhi, map.centerLatitude, map.rotateGamma]
	);

	// Live rotation state — drag and auto-spin mutate this; the config seed sets
	// the starting view and (when animation.update is on) springs to a new seed
	// instead of cutting — e.g. Religious Projections country→country locator.
	const [rotation, setRotation] = useState<[number, number, number]>(seededRotation);
	const [isSpinning, setIsSpinning] = useState(spinFromConfig);
	const seedRef = useRef(seededRotation);
	const rotationRef = useRef(rotation);
	rotationRef.current = rotation;
	const draggingRef = useRef(false);
	// Bumps on every seed retarget so a superseded spring's onRest cannot snap
	// the camera back to an intermediate country (react-spring v9 fires onRest
	// for interrupted runs; `finished` alone is not always enough).
	const rotationEpochRef = useRef(0);
	// Circle-family schedule: geometryDelay waits out the label fade-out so the
	// name disappears before the globe turns, then fades back in after onRest.
	const { update: rotationTiming } = useTransitionTiming('circle');
	const [, rotationSpringApi] = useSpring(() => ({
		l: seededRotation[0],
		p: seededRotation[1],
		g: seededRotation[2],
	}));

	useEffect(() => {
		if (
			seedRef.current[0] === seededRotation[0] &&
			seedRef.current[1] === seededRotation[1] &&
			seedRef.current[2] === seededRotation[2]
		) {
			return;
		}
		seedRef.current = seededRotation;
		const epoch = ++rotationEpochRef.current;

		// Drag owns the camera; reduced-motion / disabled animation / editor
		// force a snap. Otherwise spring along the shortest longitude arc.
		if (draggingRef.current || rotationTiming.immediate) {
			rotationSpringApi.stop();
			rotationSpringApi.set({
				l: seededRotation[0],
				p: seededRotation[1],
				g: seededRotation[2],
			});
			setRotation(seededRotation);
			return;
		}

		const current = rotationRef.current;
		const targetLambda = current[0] + shortestAngleDelta(current[0], seededRotation[0]);
		const settleTo = seededRotation;
		setIsSpinning(false);
		// Hold the current view through geometryDelay (label fade-out). A bare
		// `from` + `delay` would flash the target early — same pitfall as
		// usePointGlide's path spring.
		rotationSpringApi.set({
			l: current[0],
			p: current[1],
			g: current[2],
		});
		rotationSpringApi.start({
			from: { l: current[0], p: current[1], g: current[2] },
			to: { l: targetLambda, p: settleTo[1], g: settleTo[2] },
			delay: rotationTiming.geometryDelay,
			config: {
				duration: rotationTiming.geometryDuration,
				easing: rotationTiming.easing,
			},
			onChange: ({ value }) => {
				if (epoch !== rotationEpochRef.current) {
					return;
				}
				setRotation([value.l, value.p, value.g]);
			},
			onRest: (result) => {
				// Interrupted/retargeted springs must not settle — that snaps
				// the camera to an intermediate country mid-turn.
				if (!result?.finished || epoch !== rotationEpochRef.current) {
					return;
				}
				// Settle on the canonical seed angles (not the unwrapped lambda).
				setRotation(settleTo);
				rotationSpringApi.set({
					l: settleTo[0],
					p: settleTo[1],
					g: settleTo[2],
				});
			},
		});
	}, [
		seededRotation,
		rotationTiming.immediate,
		rotationTiming.geometryDelay,
		rotationTiming.geometryDuration,
		rotationTiming.easing,
		rotationSpringApi,
	]);

	// Re-seed runtime spin when auto-spin or reduced-motion preference changes.
	useEffect(() => {
		setIsSpinning(spinFromConfig);
	}, [spinFromConfig]);

	// Auto-spin: advance longitude each animation frame, paused while dragging.
	useEffect(() => {
		if (!isSpinning) return undefined;
		let frame = 0;
		const tick = () => {
			if (!draggingRef.current) {
				setRotation(([l, p, g]) => [l + spinSpeed, p, g]);
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [isSpinning, spinSpeed]);

	// Drag-to-rotate: pointer deltas map to longitude/latitude rotation.
	const lastPointRef = useRef<{ x: number; y: number } | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!dragToRotate) return;
			event.stopPropagation();
			wpEditorFunctions?.globe?.onDragStart?.();
			setIsSpinning(false);
			draggingRef.current = true;
			// A seed-change spring would fight the pointer; hand the camera to drag.
			// Invalidate in-flight onRest so an interrupted turn cannot settle
			// after the user has taken over.
			rotationEpochRef.current += 1;
			rotationSpringApi.stop();
			setIsDragging(true);
			lastPointRef.current = { x: event.clientX, y: event.clientY };
			(event.target as Element).setPointerCapture?.(event.pointerId);
		},
		[dragToRotate, wpEditorFunctions, rotationSpringApi]
	);

	const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
		if (!draggingRef.current || !lastPointRef.current) return;
		const dx = event.clientX - lastPointRef.current.x;
		const dy = event.clientY - lastPointRef.current.y;
		lastPointRef.current = { x: event.clientX, y: event.clientY };
		setRotation(([l, p, g]) => [
			l + dx * DRAG_SENSITIVITY,
			Math.max(-90, Math.min(90, p - dy * DRAG_SENSITIVITY)),
			g,
		]);
	}, []);

	const endDrag = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!draggingRef.current) return;
			draggingRef.current = false;
			setIsDragging(false);
			lastPointRef.current = null;
			(event.target as Element).releasePointerCapture?.(event.pointerId);
			wpEditorFunctions?.globe?.onDragEnd?.();
		},
		[wpEditorFunctions]
	);

	const handleRotationToggle = useCallback(() => {
		setIsSpinning((spinning) => !spinning);
	}, []);

	const handleRotationToggleClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			handleRotationToggle();
		},
		[handleRotationToggle]
	);

	const handleRotationToggleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
		if (event.key === ' ' || event.key === 'Enter') {
			event.stopPropagation();
		}
	}, []);

	// Visible-hemisphere center in lon/lat is the inverse of the rotation, used
	// to hide labels that fall on the far side of the globe.
	const viewCenter: [number, number] = [-rotation[0], -rotation[1]];

	const radius = (Math.min(innerWidth, innerHeight) / 2) * map.customScale;
	const centerX = innerWidth / 2 + padding.left;
	const centerY = innerHeight / 2 + padding.top;

	const projectionProps = {
		projection,
		scale: radius,
		translate: [centerX, centerY] as [number, number],
		rotate: rotation,
		clipAngle: 90,
	};

	// Same projection maths as the polygon layers, for the point overlay.
	const geoPointProjection = useMemo(
		() => geoOrthographic().scale(radius).translate([centerX, centerY]).rotate(rotation).clipAngle(90),
		[radius, centerX, centerY, rotation]
	);

	// Unlike path clipping, projecting a raw point returns coordinates even
	// for the far side of the globe, so back-facing markers are dropped with
	// the same hemisphere test the label layer uses. A plain closure, not a
	// memoized callback: it derives from per-render rotation state and its
	// only consumer re-renders alongside it anyway.
	const projectGeoPoint = (coords: [number, number]): [number, number] | null => {
		if (geoDistance(coords, viewCenter) > Math.PI / 2) {
			return null;
		}
		return geoPointProjection(coords) ?? null;
	};

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, annotationsVisible, labelProps } = useMemo(
		() =>
			getSharedProps({
				chartType: 'An orthographic globe map of the world',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);

	// TOOLTIP
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();
	const tooltipTimeoutRef = useRef<number>(0);

	// Drive label choreography off the locator view (facing + name), not the
	// row array alone — country navigations always change both together.
	const viewTransitionKey = `${map.centerLongitude},${map.centerLatitude}:${annotations?.items?.[0]?.text ?? ''}`;

	return (
		<TransitionProvider data={viewTransitionKey} family="circle">
			<div
				style={{
					position: 'relative',
					overflowX: overflow as CSSProperties['overflowX'],
				}}
			>
				<svg
					width={chartWidth}
					height={chartHeight}
					ref={svgRef}
					{...ariaProps}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endDrag}
					onPointerLeave={endDrag}
					style={{
						pointerEvents: tooltip.active || dragToRotate ? 'auto' : 'none',
						cursor: dragToRotate ? (isDragging ? 'grabbing' : 'grab') : 'default',
						touchAction: dragToRotate ? 'none' : undefined,
					}}
				>
					<Group role="presentation" top={padding.top} left={padding.left}>
						{/* Ocean disc + lat/long grid — rendered beneath country polygons. */}
						<CustomProjection<FeatureShape> {...projectionProps} data={[]}>
							{({ path }) => (
								<>
									<path
										d={path({ type: 'Sphere' }) || ''}
										fill={sphereFill}
										stroke="none"
										style={{ pointerEvents: 'none' }}
									/>
									{showGraticule && (
										<Graticule
											lines={(line) => path(line) || ''}
											stroke={graticuleStroke}
											fill="none"
											strokeWidth={0.5}
											style={{ pointerEvents: 'none' }}
										/>
									)}
								</>
							)}
						</CustomProjection>
						{/* Background layer: all countries, no data binding, no tooltips. */}
						<CustomProjection<FeatureShape> {...projectionProps} data={mergedData}>
							{({ features }) =>
								features.map(({ feature, path }, i) => (
									<MapFeature
										key={`globe-bg-${feature.id ?? i}`}
										d={path || ''}
										fill={map.pathBackgroundFill}
										stroke={map.pathStroke}
										strokeWidth={map.pathStrokeWidth}
										style={{ pointerEvents: 'none' }}
									/>
								))
							}
						</CustomProjection>
						{/* Data layer: countries with values only — choropleth, tooltips, labels. */}
						<CustomProjection<FeatureShape> {...projectionProps} data={mergedAndFilteredData}>
							{({ features }) => {
								const featureMeta = features.map(({ feature, path, projection: proj }, i) => {
									const { id, properties } = feature;
									const fill = getFill(id, properties, mapCategory);
									const shapeIdentifier = properties.x || properties.name;
									const shapeKey = generateElementKey(shapeIdentifier, mapCategory, null);
									const customShapeStyles = shapes?.customStyles?.[shapeKey] || {};
									const shapeFill = customShapeStyles.fill || fill;
									// Only the visible hemisphere should carry labels.
									const centroid = getDisplayCentroid(feature);
									const isFrontFacing = geoDistance(centroid, viewCenter) <= Math.PI / 2;
									const coords: [number, number] | null = proj(centroid);
									return {
										feature,
										path,
										coords,
										id,
										properties,
										fill,
										shapeFill,
										customShapeStyles,
										isFrontFacing,
										i,
									};
								});

								// ── Polygon layer ──────────────────────────────────
								const polygonLayer = featureMeta.map((meta) => {
									if (!meta) return null;
									const { feature, path, id, properties, fill, shapeFill, customShapeStyles, i } =
										meta;

									const onPolyMouseMove = (event: EventType) => {
										// Suppress hover tooltips while the user is dragging the globe.
										if (draggingRef.current) return;
										if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
										if (!svgRef.current) return;
										const c = getLocalPoint(svgRef.current, event) || {
											x: 0,
											y: 0,
										};
										const { body: _tip, header: _hdr } = getCustomTooltip(
											feature.properties,
											mapCategory
										);
										showTooltip({
											tooltipData: {
												x: feature.properties.name,
												id: feature.id,
												y: feature.properties[mapCategory],
												category: mapCategory,
												fill,
												customTooltip: _tip,
												customHeader: _hdr,
											},
											tooltipTop: c.y,
											tooltipLeft: c.x,
										});
									};
									const onPolyMouseLeave = () => {
										tooltipTimeoutRef.current = window.setTimeout(() => hideTooltip(), 300);
									};

									const { opacity, stroke, strokeWidth } = getTooltipMapDeemphasisProps(
										tooltip,
										map,
										id,
										tooltipData as FlatData
									);
									const dataPoint = {
										...properties,
										x: properties.x || properties.name,
									};
									return (
										<MapFeature
											key={`globe-feature-${i}`}
											d={path || ''}
											fill={shapeFill}
											stroke={customShapeStyles.stroke || stroke}
											opacity={customShapeStyles.opacity ?? opacity}
											strokeWidth={customShapeStyles.strokeWidth ?? strokeWidth}
											tabIndex={0}
											style={{
												cursor: wpEditorFunctions?.shapes ? 'pointer' : 'default',
												pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
											}}
											onClick={(event: React.MouseEvent) => {
												if (wpEditorFunctions?.shapes?.onClick) {
													wpEditorFunctions.shapes.onClick(
														dataPoint,
														mapCategory,
														fill,
														event.currentTarget,
														null
													);
												}
											}}
											onBlur={onPolyMouseLeave}
											onFocus={onPolyMouseMove}
											onMouseLeave={onPolyMouseLeave}
											onMouseMove={onPolyMouseMove}
										/>
									);
								});

								// ── Label layer ────────────────────────────────────
								const labelLayer = labels.active
									? featureMeta.map((meta) => {
											if (!meta) return null;
											const { coords, id, properties, fill, isFrontFacing } = meta;
											if (!isFrontFacing || !coords) return null;
											const customLabelText = getCustomLabelText(properties, mapCategory);
											const customLabel =
												customLabelText || getCustomLabel(properties, mapCategory);
											const defaultLabel = properties.name || '';
											const labelText = customLabel || defaultLabel;
											if (!labelText) return null;
											const dataPoint = {
												...properties,
												x: properties.x || properties.name,
											};
											const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
											const bareHex =
												(isDark
													? fill.match(/light-dark\([^,]+,\s*([^)]+)\)/)?.[1]
													: fill.match(/^light-dark\(\s*([^,]+?)\s*,/)?.[1]
												)?.trim() ?? fill;
											return (
												<DraggableLabel
													key={`globe-label-${id}`}
													x={coords[0]}
													y={coords[1]}
													dataPoint={dataPoint}
													category={mapCategory}
													defaultDx={labels.labelPositionDX}
													defaultDy={labels.labelPositionDY}
													chartInnerWidth={innerWidth}
													chartInnerHeight={innerHeight}
													defaultLabel={defaultLabel}
													fill={(() => {
														if (labels.color && labels.color !== 'contrast')
															return labels.color;
														return labelFill(bareHex);
													})()}
													{...labelProps}
												>
													{labelText}
												</DraggableLabel>
											);
										})
									: null;

								return (
									<Fragment>
										{polygonLayer}
										{labelLayer}
									</Fragment>
								);
							}}
						</CustomProjection>
						{isGeoPointsMode && geoPointRows.length > 0 && (
							<MapGeoPointLayer
								data={geoPointRows}
								project={projectGeoPoint}
								sizeCategory={sizeCategory}
								labelColumn={geoPoints?.labelColumn}
								latitudeColumn={geoPoints?.latitudeColumn}
								longitudeColumn={geoPoints?.longitudeColumn}
								bubbleRadiusScale={bubbleRadiusScale}
								fill={geoPoints?.fill || colors[0]}
								bubbleConfig={map.bubble}
								svgRef={svgRef}
								showTooltip={showTooltip}
								hideTooltip={hideTooltip}
								tooltipTimeoutRef={tooltipTimeoutRef}
								fixedRadius={geoPoints?.fixedRadius}
							/>
						)}
					</Group>
					{annotationsVisible && annotations && (
						<TransitioningAnnotationsLayer
							annotations={annotations}
							width={chartWidth}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth}
						/>
					)}
					{drawings?.active && !wpEditorFunctions && (
						<DrawingsLayer
							config={drawings}
							width={chartWidth}
							height={chartHeight}
							layout={layout}
							chartWidth={chartWidth}
						/>
					)}
				</svg>
				{showPlayPause && (
					<div
						className="globe-rotation-controls"
						style={{
							position: 'absolute',
							bottom: '10px',
							...(playPausePosition === 'bottom-left' ? { left: '10px' } : { right: '10px' }),
							zIndex: 1000,
							pointerEvents: 'auto',
						}}
					>
						<GlobeRotationButton
							type="button"
							aria-pressed={isSpinning}
							aria-label={isSpinning ? 'Pause globe rotation' : 'Play globe rotation'}
							title={isSpinning ? 'Pause globe rotation' : 'Play globe rotation'}
							onClick={handleRotationToggleClick}
							onKeyDown={handleRotationToggleKeyDown}
						>
							{isSpinning ? (
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
									<rect x="2" y="1" width="3" height="12" fill="currentColor" />
									<rect x="9" y="1" width="3" height="12" fill="currentColor" />
								</svg>
							) : (
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
									<polygon points="3,1 13,7 3,13" fill="currentColor" />
								</svg>
							)}
						</GlobeRotationButton>
					</div>
				)}
				{legend.active && (
					<StyledLegend
						legend={legend}
						layoutWidth={width}
						layoutHeight={height}
						chartWidth={chartWidth}
						chartHeight={chartHeight}
					>
						{dataRender.mapScale === 'threshold' && (
							<LegendThreshold
								{...legendProps}
								scale={thresholdScale}
								labelLower={legend.labelLower}
								labelUpper={legend.labelUpper}
								labelDelimiter={legend.labelDelimiter}
							>
								{(legendLabels: any) => (
									<ClickableLegend
										labels={legendLabels}
										shape={legend.markerStyle}
										fill={(label) => label.value}
										shapeStyle={legendProps.shapeStyle}
										direction={legend.orientation}
										legendLabelProps={legendProps.legendLabelProps}
									/>
								)}
							</LegendThreshold>
						)}
						{dataRender.mapScale === 'ordinal' && (
							<LegendOrdinal
								{...legendProps}
								scale={ordinalScale}
								domain={legend.categories.length > 0 ? legend.categories : ordinalScale.domain()}
							>
								{(legendLabels: any) => (
									<ClickableLegend
										labels={legendLabels}
										shape={legend.markerStyle}
										fill={(label) => ordinalScale(label.datum)}
										shapeStyle={legendProps.shapeStyle}
										direction={legend.orientation}
										legendLabelProps={legendProps.legendLabelProps}
									/>
								)}
							</LegendOrdinal>
						)}
						{dataRender.mapScale === 'linear' && (
							<LegendLinear {...legendProps} scale={linearScale}>
								{(legendLabels: any) => (
									<ClickableLegend
										labels={legendLabels}
										shape={legend.markerStyle}
										fill={(label) => label.value}
										shapeStyle={legendProps.shapeStyle}
										direction={legend.orientation}
										legendLabelProps={legendProps.legendLabelProps}
									/>
								)}
							</LegendLinear>
						)}
					</StyledLegend>
				)}
				{tooltipOpen && tooltipData && tooltipVisible && (
					<StyledTooltip
						top={tooltipTop}
						left={tooltipLeft}
						tooltip={tooltip}
						containerRef={svgRef}
						isMobile={isMobileTooltip}
					>
						<>
							{tooltip.headerActive && (
								<div style={{ marginBottom: '10px' }}>
									<strong>
										{tooltipData.customHeader
											? tooltipData.customHeader
											: getTooltipHeaderFormat(
													{
														x: tooltipData.x,
														category: tooltipData.category,
													},
													tooltip
												)}
									</strong>
								</div>
							)}
						</>
						<div>
							<SafeHtml
								html={
									tooltipData.customTooltip
										? (tooltipData.customTooltip as string)
										: (getTooltipFormat({
													x: tooltipData.x,
													y: tooltipData.y,
													category: tooltipData.category,
													color: tooltipData.fill,
										data: tooltipData,},
												tooltip,
												dataRender
											) as string)
								}
							/>
						</div>
					</StyledTooltip>
				)}
			</div>
		</TransitionProvider>
	);
};

export default WorldOrthographic;

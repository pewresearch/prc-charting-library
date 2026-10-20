// External Imports
import { useState, Fragment, useContext, useMemo, useRef, CSSProperties, RefObject } from 'react';
import { geoRobinson } from 'd3-geo-projection';
import * as topojson from 'topojson-client';

//Visx Imports
import { CustomProjection } from '@visx/geo';
import { scaleSqrt } from '@visx/scale';
import { getDisplayCentroid } from './getDisplayCentroid';
import {
	ClickableLegend,
	StyledTooltip,
	StyledLegend,
	AnnotationsLayer,
	DrawingsLayer,
	SeriesPatternDefs,
} from '../../overlays';
import { useTooltip } from '@visx/tooltip';
import { EventType } from '@visx/event/lib/types';
import { Zoom } from '@visx/zoom';
// Local Imports
import {
	DataContext,
	BaseConfig,
	useSize,
	labelFill,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	generateElementKey,
	useWorldCountryData,
	getChartDimensions,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
	createValueColorScale,
} from '@prc/charting-utilities';
import { DraggableLabel } from '../../labels';
import type { Size, FlatData, FeatureShape, TableData } from '@prc/charting-utilities';
import { Group } from '@visx/group';

// STYLED COMPONENTS
import styled from '@emotion/styled';
import MapBubbleLayer, { getBubbleGroup, getBubbleGroups } from './MapBubbleLayer';
import MapGeoPointLayer from './MapGeoPointLayer';
import MapBubbleLegend from './MapBubbleLegend';

const projection = geoRobinson;

// Topology loaders for Pew 2019 regional groupings (Broadest / Broad / Sub)
const TOPOLOGY_LOADERS = {
	default: createTopologyLoader(() => import('../../data/maps/world/countries-50m.json')),
	custom: createTopologyLoader(() => import('../../data/maps/world/countries-50m.json')),
	americas: createTopologyLoader(() => import('../../data/maps/world/americas-50m.json')),
	asia: createTopologyLoader(() => import('../../data/maps/world/asia-50m.json')),
	europe: createTopologyLoader(() => import('../../data/maps/world/europe-50m.json')),
	'middle-east-north-africa': createTopologyLoader(
		() => import('../../data/maps/world/middle-east-north-africa-50m.json')
	),
	'sub-saharan-africa': createTopologyLoader(() => import('../../data/maps/world/sub-saharan-africa-50m.json')),
	africa: createTopologyLoader(() => import('../../data/maps/world/africa-50m.json')),
	'asia-pacific': createTopologyLoader(() => import('../../data/maps/world/asia-pacific-50m.json')),
	'latin-america-and-the-caribbean': createTopologyLoader(
		() => import('../../data/maps/world/latin-america-and-the-caribbean-50m.json')
	),
	'middle-east': createTopologyLoader(() => import('../../data/maps/world/middle-east-50m.json')),
	'north-america': createTopologyLoader(() => import('../../data/maps/world/north-america-50m.json')),
	caribbean: createTopologyLoader(() => import('../../data/maps/world/caribbean-50m.json')),
	'central-america': createTopologyLoader(() => import('../../data/maps/world/central-america-50m.json')),
	'central-asia': createTopologyLoader(() => import('../../data/maps/world/central-asia-50m.json')),
	'east-asia': createTopologyLoader(() => import('../../data/maps/world/east-asia-50m.json')),
	'eastern-europe': createTopologyLoader(() => import('../../data/maps/world/eastern-europe-50m.json')),
	'north-africa': createTopologyLoader(() => import('../../data/maps/world/north-africa-50m.json')),
	oceania: createTopologyLoader(() => import('../../data/maps/world/oceania-50m.json')),
	'south-america': createTopologyLoader(() => import('../../data/maps/world/south-america-50m.json')),
	'south-asia': createTopologyLoader(() => import('../../data/maps/world/south-asia-50m.json')),
	'western-europe': createTopologyLoader(() => import('../../data/maps/world/western-europe-50m.json')),
	// Continent (true-geographic)
	'continent-africa': createTopologyLoader(() => import('../../data/maps/world/continent-africa-50m.json')),
	'continent-asia': createTopologyLoader(() => import('../../data/maps/world/continent-asia-50m.json')),
	'continent-europe': createTopologyLoader(() => import('../../data/maps/world/continent-europe-50m.json')),
	'continent-north-america': createTopologyLoader(
		() => import('../../data/maps/world/continent-north-america-50m.json')
	),
	'continent-south-america': createTopologyLoader(
		() => import('../../data/maps/world/continent-south-america-50m.json')
	),
	'continent-oceania': createTopologyLoader(() => import('../../data/maps/world/continent-oceania-50m.json')),
};

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
const World = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	// Select the appropriate topology loader based on topology region setting
	// This is separate from projectionPreset so users can adjust projection without loading full world map
	const topologyLoader = TOPOLOGY_LOADERS[config.map.topologyRegion] || TOPOLOGY_LOADERS.default;

	// Suspense-compatible resource loading
	const topology = topologyLoader();

	// Process topology data
	const { features: world } = useMemo(
		() =>
			topojson.feature(topology.default, topology.default.objects.countries) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[topology]
	);

	const geojson = useMemo(
		() => topojson.feature(topology.default as any, topology.default.objects.countries as any),
		[topology]
	);

	const [isUnZoomed, setIsUnZoomed] = useState(true);
	const { layout, colors, dataRender, labels, legend, tooltip, map, shapes, annotations, drawings, seriesStyles } =
		config;
	// SIZE AND LAYOUT
	const { height, width, parentClass, padding } = layout;
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
	// Countries to exclude from rendering (included in topology for border arcs but not displayed)
	// Russia is included in East Asia topology for Mongolia/China borders but causes antimeridian artifacts
	const EXCLUDED_COUNTRIES: Record<string, string[]> = {
		'east-asia': ['643'], // Russia
	};

	// Merge FlatData rows onto country features via the shared hook (ISO numeric /
	// name / alpha-3 matching). Shared with the orthographic globe component.
	const { mergedData, mergedAndFilteredData } = useWorldCountryData({
		features: world,
		flattenedData,
		category: dataRender.categories[0],
		excludeIds: EXCLUDED_COUNTRIES[config.map.topologyRegion as string] || [],
	});

	const valueScale = createValueColorScale({
		mode: dataRender.mapScale,
		domain: dataRender.mapScaleDomain,
		colors,
		emptyFill: map.pathBackgroundFill,
		seriesStyles,
		legend,
		legendOrder: legend.categories,
	});

	// Calculate centers accounting for padding to ensure proper centering during resize
	const centerX = innerWidth / 2 + padding.left;
	const centerY = innerHeight / 2 + padding.top;
	const scaleX = geoRobinson().fitWidth(innerWidth, geojson);
	const scaleY = geoRobinson().fitHeight(innerHeight, geojson);
	const initialScale = (innerWidth / innerHeight) * 50;

	// Check if custom projection settings are active
	const hasCustomProjection =
		map.centerLongitude !== 0 ||
		map.centerLatitude !== 0 ||
		map.rotateLambda !== 0 ||
		map.rotatePhi !== 0 ||
		map.rotateGamma !== 0 ||
		map.customScale !== 1;

	// For custom projections, calculate a responsive base scale that adjusts with container size
	// This ensures the map stays proportional when the container resizes
	const responsiveScale = useMemo(() => {
		if (!hasCustomProjection) return initialScale;
		// Use the smaller of scaleX/scaleY to ensure map fits in container
		const baseScale = Math.min(scaleX.scale(), scaleY.scale());
		return baseScale;
	}, [hasCustomProjection, scaleX, scaleY, initialScale]);

	const isBubbleMode = dataRender.mapStyle === 'bubble';
	const isGeoPointsMode = dataRender.mapStyle === 'geo-points';
	const isPointOverlayMode = isBubbleMode || isGeoPointsMode;
	const mapCategory = dataRender.categories[0];
	const geoPoints = map.geoPoints;
	const sizeCategory = geoPoints?.sizeCategory || mapCategory;

	const maxDataValue = useMemo(() => {
		if (!isPointOverlayMode || (geoPoints?.fixedRadius !== null && geoPoints?.fixedRadius !== undefined)) return 0;
		return Math.max(
			0,
			...flattenedData.map((d: FlatData) => {
				const v = d[sizeCategory];
				const n = typeof v === 'number' ? v : parseFloat(v as string);
				return isNaN(n) ? 0 : Math.abs(n);
			})
		);
	}, [isPointOverlayMode, flattenedData, sizeCategory, geoPoints?.fixedRadius]);

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

	const bubbleGroups = useMemo(
		() =>
			getBubbleGroups({
				groupBy: isBubbleMode ? dataRender.groupBreaksCategory : undefined,
				category: mapCategory,
				groupOrder: dataRender.groupBreaksCategoryValues,
				data: flattenedData,
				colors,
			}),
		[
			isBubbleMode,
			dataRender.groupBreaksCategory,
			mapCategory,
			dataRender.groupBreaksCategoryValues,
			flattenedData,
			colors,
		]
	);

	// GET SHARED LAYOUT PROPS
	const { legendProps, tooltipVisible, annotationsVisible, labelProps } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the world',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);

	// TOOLTIP AND HANDLERS
	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();
	const tooltipTimeoutRef = useRef<number>(0);

	return (
		<Zoom<SVGSVGElement>
			width={chartWidth}
			height={chartHeight}
			scaleXMin={100}
			scaleXMax={1000}
			scaleYMin={100}
			scaleYMax={1000}
			initialTransformMatrix={{
				scaleX: initialScale,
				scaleY: initialScale + 100,
				translateX: centerX,
				translateY: centerY,
				skewX: 0,
				skewY: 0,
			}}
		>
			{(zoom) => (
				<div
					style={{
						position: 'relative',
						// overflow: 'hidden',
						overflowX: overflow as CSSProperties['overflowX'],
					}}
				>
					<svg
						width={chartWidth}
						height={chartHeight}
						ref={map.zoomActive ? zoom.containerRef : svgRef}
						className={zoom.isDragging ? 'dragging' : undefined}
						style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
					>
						<SeriesPatternDefs
							seriesStyles={seriesStyles}
							resolveFill={(name) =>
								seriesStyles?.[name]?.fill ??
								(isBubbleMode ? bubbleGroups.groupFill(name) : valueScale.keyFill(name))
							}
						/>
						<Group role="presentation" top={padding.top} left={padding.left}>
							<CustomProjection<FeatureShape>
								projection={projection}
								data={mergedData}
								scale={
									hasCustomProjection
										? responsiveScale * map.customScale
										: zoom.transformMatrix.scaleX * map.customScale
								}
								fitSize={
									isUnZoomed && !hasCustomProjection
										? [[innerWidth, innerHeight + 100], geojson]
										: undefined
								}
								center={hasCustomProjection ? [map.centerLongitude, map.centerLatitude] : undefined}
								rotate={
									hasCustomProjection ? [map.rotateLambda, map.rotatePhi, map.rotateGamma] : undefined
								}
								translate={
									map.zoomActive
										? [zoom.transformMatrix.translateX, zoom.transformMatrix.translateY]
										: [centerX, centerY]
								}
							>
								{({ features }) =>
									features.map(({ path }, i) => (
										<Fragment key={`map-feature-${i}`}>
											<MapFeature
												key={`map-feature-${i}`}
												d={path || ''}
												fill={map.pathBackgroundFill}
												stroke={map.pathStroke}
												strokeWidth={0.5}
											/>
										</Fragment>
									))
								}
							</CustomProjection>
							<CustomProjection<FeatureShape>
								projection={projection}
								data={isGeoPointsMode ? mergedData : mergedAndFilteredData}
								scale={
									hasCustomProjection
										? responsiveScale * map.customScale
										: zoom.transformMatrix.scaleX * map.customScale
								}
								fitSize={
									isUnZoomed && !hasCustomProjection
										? [[innerWidth, innerHeight + 100], geojson]
										: undefined
								}
								center={hasCustomProjection ? [map.centerLongitude, map.centerLatitude] : undefined}
								rotate={
									hasCustomProjection ? [map.rotateLambda, map.rotatePhi, map.rotateGamma] : undefined
								}
								translate={
									map.zoomActive
										? [zoom.transformMatrix.translateX, zoom.transformMatrix.translateY]
										: [centerX, centerY]
								}
							>
								{({ features }) => {
									// Shared per-feature calculations reused by both polygon and label layers.
									const featureMeta = features.map(({ feature, path, projection: proj }, i) => {
										const coords: [number, number] | null = proj(getDisplayCentroid(feature));
										const { id } = feature;
										if (!coords || !id) return null;
										const { properties } = feature;
										const fill = isPointOverlayMode
											? map.pathBackgroundFill
											: valueScale.getFill(properties[mapCategory]);
										const shapeIdentifier = properties.x || properties.name;
										const shapeKey = generateElementKey(shapeIdentifier, mapCategory, null);
										const customShapeStyles = isPointOverlayMode
											? {}
											: shapes?.customStyles?.[shapeKey] || {};
										const shapeFill = customShapeStyles.fill || fill;
										return {
											feature,
											path,
											coords,
											id,
											properties,
											fill,
											shapeFill,
											customShapeStyles,
											i,
										};
									});

									// ── Polygon layer ─────────────────────────────────────────────────────
									// In bubble mode polygons are decorative only (no events, background fill).
									const polygonLayer = featureMeta.map((meta) => {
										if (!meta) return null;
										const { feature, path, id, properties, fill, shapeFill, customShapeStyles, i } =
											meta;
										const onPolyMouseMove = isPointOverlayMode
											? undefined
											: (event: EventType) => {
													if (tooltipTimeoutRef.current)
														clearTimeout(tooltipTimeoutRef.current);
													if (!svgRef.current) return;
													const c = getLocalPoint(svgRef.current, event) || { x: 0, y: 0 };
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
										const onPolyMouseLeave = isPointOverlayMode
											? undefined
											: () => {
													tooltipTimeoutRef.current = window.setTimeout(
														() => hideTooltip(),
														300
													);
												};
										const { opacity, stroke, strokeWidth } = isPointOverlayMode
											? { opacity: 1, stroke: map.pathStroke, strokeWidth: map.pathStrokeWidth }
											: getTooltipMapDeemphasisProps(tooltip, map, id, tooltipData as FlatData);
										const binPaint = isPointOverlayMode
											? { fill: shapeFill, stroke, strokeWidth, opacity }
											: valueScale.getPaint(properties[mapCategory], {
													stroke,
													strokeWidth,
													opacity,
												});
										const dataPoint = { ...properties, x: properties.x || properties.name };
										return (
											<MapFeature
												key={`map-feature-${i}`}
												d={path || ''}
												fill={customShapeStyles.fill || binPaint.fill}
												stroke={customShapeStyles.stroke || binPaint.stroke}
												opacity={customShapeStyles.opacity ?? binPaint.opacity}
												strokeWidth={customShapeStyles.strokeWidth ?? binPaint.strokeWidth}
												strokeOpacity={
													customShapeStyles.strokeOpacity ?? binPaint.strokeOpacity
												}
												tabIndex={isPointOverlayMode ? -1 : 0}
												style={{
													pointerEvents: isPointOverlayMode
														? 'none'
														: wpEditorFunctions?.shapes && 'all',
												}}
												onClick={(event: React.MouseEvent) => {
													if (!isPointOverlayMode && wpEditorFunctions?.shapes?.onClick) {
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
												onTouchStart={() => {
													if (!map.zoomActive) return;
													setIsUnZoomed(false);
												}}
												onTouchMove={() => {
													if (!map.zoomActive) return;
													setIsUnZoomed(false);
												}}
												onTouchEnd={() => {
													if (!map.zoomActive) return;
													setIsUnZoomed(false);
												}}
												onMouseDown={() => {
													if (!map.zoomActive) return;
													setIsUnZoomed(false);
												}}
												onMouseUp={() => {
													if (!map.zoomActive) return;
													setIsUnZoomed(false);
												}}
											/>
										);
									});

									// ── Label layer ───────────────────────────────────────────────────────
									// Rendered after polygons and bubbles so labels always sit on top.
									const labelLayer = labels.active
										? featureMeta.map((meta) => {
												if (!meta) return null;
												const { coords, id, properties, fill } = meta;
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
												const isDark =
													window.matchMedia?.('(prefers-color-scheme: dark)').matches;
												const bubbleGroup = getBubbleGroup(bubbleGroups, properties);
												const contrastSrc = isBubbleMode
													? bubbleGroups.groupFill(bubbleGroup ?? '')
													: fill;
												const labelSeriesKey = isBubbleMode
													? (bubbleGroup ?? '')
													: String(valueScale.styleKey(properties[mapCategory]) ?? '');
												const bareHex =
													(isDark
														? contrastSrc.match(/light-dark\([^,]+,\s*([^)]+)\)/)?.[1]
														: contrastSrc.match(/^light-dark\(\s*([^,]+?)\s*,/)?.[1]
													)?.trim() ?? contrastSrc;
												return (
													<DraggableLabel
														key={`world-map-label-${id}`}
														x={coords[0]}
														y={coords[1]}
														dataPoint={dataPoint}
														category={mapCategory}
														seriesKey={labelSeriesKey}
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
										<>
											{polygonLayer}
											{isBubbleMode && (
												<MapBubbleLayer
													features={features}
													category={mapCategory}
													bubbleRadiusScale={bubbleRadiusScale}
													fill={colors[0]}
													groups={bubbleGroups}
													seriesStyles={seriesStyles}
													bubbleConfig={map.bubble}
													svgRef={svgRef}
													showTooltip={showTooltip}
													hideTooltip={hideTooltip}
													tooltipTimeoutRef={tooltipTimeoutRef}
													getName={(feature) => feature.properties?.name}
												/>
											)}
											{isGeoPointsMode && features[0]?.projection && (
												<MapGeoPointLayer
													data={flattenedData}
													project={(coords) => features[0].projection(coords)}
													sizeCategory={sizeCategory}
													labelColumn={geoPoints?.labelColumn}
													latitudeColumn={geoPoints?.latitudeColumn}
													longitudeColumn={geoPoints?.longitudeColumn}
													bubbleRadiusScale={bubbleRadiusScale}
													fill={colors[0]}
													bubbleConfig={map.bubble}
													svgRef={svgRef}
													showTooltip={showTooltip}
													hideTooltip={hideTooltip}
													tooltipTimeoutRef={tooltipTimeoutRef}
													fixedRadius={geoPoints?.fixedRadius}
												/>
											)}
											{labelLayer}
										</>
									);
								}}
							</CustomProjection>
						</Group>
						{annotationsVisible && (
							<AnnotationsLayer
								config={annotations}
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
						{/* <rect
              x={0}
              y={0}
              width={chartWidth}
              height={chartHeight}
              fill='transparent'
              onTouchStart={zoom.dragStart}
              onTouchMove={zoom.dragMove}
              onTouchEnd={zoom.dragEnd}
              onMouseDown={zoom.dragStart}
              // onMouseMove={zoom.dragMove}
              onMouseUp={zoom.dragEnd}
              // onMouseLeave={() => {
              //   if (zoom.isDragging) zoom.dragEnd()
              // }}
            /> */}
					</svg>
					{map.zoomActive && (
						<>
							<div
								className="controls"
								style={{
									position: 'absolute',
									bottom: '10px',
									right: '10px',
									zIndex: 1000,
								}}
							>
								<button
									className="button"
									onClick={() => {
										setIsUnZoomed(false);
										zoom.scale({ scaleX: 1.2, scaleY: 1.2 });
									}}
								>
									+
								</button>
								<button
									className="button"
									onClick={() => {
										setIsUnZoomed(false);
										zoom.scale({ scaleX: 0.8, scaleY: 0.8 });
									}}
								>
									-
								</button>
								<button
									className="button"
									onClick={() => {
										setIsUnZoomed(true);
										zoom.reset();
									}}
								>
									Reset
								</button>
							</div>
						</>
					)}
					{legend.active && !isPointOverlayMode && (
						<StyledLegend
							legend={legend}
							layoutWidth={width}
							layoutHeight={height}
							chartWidth={chartWidth}
							chartHeight={chartHeight}
						>
							<ClickableLegend
								labels={valueScale.legendItems}
								shape={legend.markerStyle}
								fill={(label) => label.value}
								shapeStyle={legendProps.shapeStyle}
								direction={legend.orientation}
								legendLabelProps={legendProps.legendLabelProps}
							/>
						</StyledLegend>
					)}
					{legend.active && isPointOverlayMode && (
						<StyledLegend
							legend={legend}
							layoutWidth={width}
							layoutHeight={height}
							chartWidth={chartWidth}
							chartHeight={chartHeight}
						>
							<MapBubbleLegend
								bubbleRadiusScale={bubbleRadiusScale}
								maxDataValue={bubbleScaleMaxValue}
								fill={colors[0]}
								stroke={map.bubble?.stroke}
								strokeWidth={map.bubble?.strokeWidth}
								opacity={map.bubble?.opacity}
								refValues={legend.bubbleLegend?.refValues}
								fillMode={legend.bubbleLegend?.fill}
								layout={legend.bubbleLegend?.layout}
								fontSize={legend.fontSize}
							/>
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
									<div
										style={{
											marginBottom: '10px',
										}}
									>
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
							<div
								dangerouslySetInnerHTML={{
									__html: tooltipData.customTooltip
										? tooltipData.customTooltip
										: getTooltipFormat(
												{
													x: tooltipData.x,
													y: tooltipData.y,
													category: tooltipData.key,
													color: tooltipData.fill,
													data: tooltipData,
												},
												tooltip,
												dataRender
											),
								}}
							/>
						</StyledTooltip>
					)}
				</div>
			)}
		</Zoom>
	);
};

export default World;

import { useContext, useMemo, useRef, CSSProperties, RefObject } from 'react';

import * as topojson from 'topojson-client';

// TYPES & UTILITIES
import {
	DataContext,
	useSize,
	generateElementKey,
	Size,
	getChartDimensions,
	getTooltipHeaderFormat,
	getTooltipFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
	FeatureShape,
	BaseConfig,
	TableData,
	FlatData,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getLabelFill,
} from '@prc/charting-utilities';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../../overlays';
import { DraggableLabel } from '../../labels';

// Visx
import { AlbersUsa } from '@visx/geo';
import { geoCentroid } from '@visx/vendor/d3-geo';
import { scaleLinear, scaleOrdinal, scaleSqrt, scaleThreshold } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { EventType } from '@visx/event/lib/types';
import { Group } from '@visx/group';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';

// STYLED COMPONENTS
import styled from '@emotion/styled';
import MapBubbleLayer from './MapBubbleLayer';
import MapBubbleLegend from './MapBubbleLegend';

// Create topology loader for US counties
const loadTopology = createTopologyLoader(() => import('../../data/maps/usa-counties/topology.json'));

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
const AlbersUSACounties = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	// Suspense-compatible resource loading
	const topology = loadTopology();

	// Process topology data
	const { features: usCounties } = useMemo(
		() =>
			topojson.feature(topology.default, topology.default.objects.counties) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[topology]
	);

	const { features: usStates } = useMemo(
		() =>
			topojson.feature(topology.default, topology.default.objects.states) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[topology]
	);

	const geojson = useMemo(
		() => topojson.feature(topology.default as any, topology.default.objects.states as any),
		[topology]
	);

	const { layout, colors, dataRender, map, labels, legend, tooltip, shapes, annotations, drawings } = config;
	const { padding, parentClass, width, height } = layout;
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

	const isBubbleMode = dataRender.mapStyle === 'bubble';
	const category = dataRender.categories[0];

	const mergedData = useMemo(() => {
		return usCounties.map((county) => {
			const countyFIPS = county.id;
			const countyData = flattenedData.find((d: any) => d.x === countyFIPS || d.FIPS === countyFIPS);
			return {
				...county,
				properties: {
					...county.properties,
					...countyData,
				},
			};
		});
	}, [usCounties, flattenedData]);

	const mergedAndFilteredData = useMemo(() => {
		return mergedData.filter((county) => county.properties?.[category]);
	}, [mergedData, category]);

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

	// eslint-disable-next-line @typescript-eslint/no-shadow
	const getFill = (id: number | string, data: any, cat: string) => {
		if (!id) return 'transparent';
		if (!data?.[cat]) return map.pathBackgroundFill;
		if (dataRender.mapScale === 'linear') {
			return linearScale(data?.[cat]);
		}
		if (dataRender.mapScale === 'ordinal') {
			return ordinalScale(data?.[cat]);
		}
		return thresholdScale(data?.[cat]);
	};

	const centerX = innerWidth / 2 + padding.left;
	const centerY = innerHeight / 2 + padding.top;

	// Bubble radius scale — scaleSqrt so perceived area is proportional to value.
	const maxDataValue = useMemo(() => {
		if (!isBubbleMode) return 0;
		return Math.max(
			0,
			...flattenedData.map((d: FlatData) => {
				const v = d[category];
				const n = typeof v === 'number' ? v : parseFloat(v as string);
				return isNaN(n) ? 0 : Math.abs(n);
			})
		);
	}, [isBubbleMode, flattenedData, category]);

	const bubbleRadiusScale = useMemo(
		() =>
			scaleSqrt({
				domain: [0, maxDataValue],
				range: [map.bubble?.minRadius ?? 4, map.bubble?.maxRadius ?? 24],
			}),
		[maxDataValue, map.bubble?.minRadius, map.bubble?.maxRadius]
	);

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, labelProps, annotationsVisible } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the United State’s counties',
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
				style={{ pointerEvents: tooltip.active ? 'auto' : 'none' }}
			>
				<Group role="presentation" top={padding.top} left={padding.left}>
					{map.showStateBoundaries && (
						<AlbersUsa<FeatureShape>
							data={usStates}
							fitSize={[[innerWidth, innerHeight], geojson]}
							translate={[centerX, centerY]}
						>
							{({ features }) =>
								features.map(({ feature, path }, i) => {
									if (!feature.id) return null;
									return (
										<path
											key={`state-boundary-${i}`}
											d={path || ''}
											fill={map.pathBackgroundFill}
											stroke={map.pathStroke}
											strokeWidth={1}
										/>
									);
								})
							}
						</AlbersUsa>
					)}
					{map.showCountyBoundaries && (
						<AlbersUsa<FeatureShape>
							data={usCounties}
							fitSize={[[innerWidth, innerHeight], geojson]}
							translate={[centerX, centerY]}
						>
							{({ features }) =>
								features.map(({ feature, path }, i) => {
									if (!feature.id) return null;
									return (
										<path
											key={`county-boundary-${i}`}
											d={path || ''}
											fill={map.pathBackgroundFill}
											stroke={map.pathStroke}
											strokeWidth={0.5}
										/>
									);
								})
							}
						</AlbersUsa>
					)}
					<AlbersUsa<FeatureShape>
						data={mergedAndFilteredData}
						fitSize={[[innerWidth, innerHeight], geojson]}
						translate={[centerX, centerY]}
					>
						{({ features }) => {
							// Shared per-feature calculations reused by polygon + label layers.
							const featureMeta = features.map(({ feature, path, projection }, i) => {
								const coords: [number, number] | null = projection(geoCentroid(feature));
								const { id, properties } = feature;
								if (!coords || !id) return null;
								const fill = isBubbleMode ? map.pathBackgroundFill : getFill(id, properties, category);
								const shapeIdentifier = properties.x || properties.name;
								const shapeKey = generateElementKey(shapeIdentifier, category, null);
								const customShapeStyles = isBubbleMode ? {} : shapes?.customStyles?.[shapeKey] || {};
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

							// ── Polygon layer ────────────────────────────────────────────────
							// In bubble mode polygons are decorative (no events, background fill).
							const polygonLayer = featureMeta.map((meta) => {
								if (!meta) return null;
								const { feature, path, id, properties, fill, shapeFill, customShapeStyles, i } = meta;

								const onPolyMouseMove = isBubbleMode
									? undefined
									: (event: EventType) => {
											if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
											if (!svgRef.current) return;
											const eventSvgCoords = getLocalPoint(svgRef.current, event) || {
												x: 0,
												y: 0,
											};
											const { body: _tip, header: _hdr } = getCustomTooltip(
												feature.properties,
												category
											);
											showTooltip({
												tooltipData: {
													x: feature.properties.name,
													id: feature.id,
													y: feature.properties[category],
													fill,
													category,
													customTooltip: _tip,
													customHeader: _hdr,
												},
												tooltipTop: eventSvgCoords.y,
												tooltipLeft: eventSvgCoords.x,
											});
										};
								const onPolyMouseLeave = isBubbleMode
									? undefined
									: () => {
											tooltipTimeoutRef.current = window.setTimeout(() => hideTooltip(), 300);
										};

								const { opacity, stroke, strokeWidth } = isBubbleMode
									? { opacity: 1, stroke: map.pathStroke, strokeWidth: map.pathStrokeWidth }
									: getTooltipMapDeemphasisProps(tooltip, map, id, tooltipData as FlatData);

								let polyPointerEvents: CSSProperties['pointerEvents'];
								if (isBubbleMode) {
									polyPointerEvents = 'none';
								} else if (wpEditorFunctions?.shapes) {
									polyPointerEvents = 'all';
								}

								return (
									<MapFeature
										key={`map-feature-${i}`}
										className="map-feature"
										d={path || ''}
										fill={shapeFill}
										stroke={customShapeStyles.stroke || stroke}
										opacity={customShapeStyles.opacity ?? opacity}
										strokeWidth={customShapeStyles.strokeWidth ?? strokeWidth}
										tabIndex={isBubbleMode ? -1 : 0}
										style={{
											cursor: !isBubbleMode && wpEditorFunctions?.shapes ? 'pointer' : undefined,
											pointerEvents: polyPointerEvents,
										}}
										onClick={(event: React.MouseEvent) => {
											if (!isBubbleMode && wpEditorFunctions?.shapes?.onClick) {
												wpEditorFunctions.shapes.onClick(
													{ ...properties, x: properties.x || properties.name },
													category,
													fill,
													event.currentTarget,
													null
												);
											}
										}}
										onMouseMove={onPolyMouseMove}
										onMouseLeave={onPolyMouseLeave}
										onFocus={onPolyMouseMove}
										onBlur={onPolyMouseLeave}
									/>
								);
							});

							// ── Label layer ──────────────────────────────────────────────────
							// Rendered after polygons and bubbles so labels always sit on top.
							const labelLayer = labels.active
								? featureMeta.map((meta) => {
										if (!meta) return null;
										const { coords, properties, shapeFill, id } = meta;
										const customLabelText = getCustomLabelText(properties, category);
										const customLabel = customLabelText || getCustomLabel(properties, category);
										const defaultLabel = properties.name || '';
										const labelText = customLabel || defaultLabel;
										if (!labelText) return null;
										const dataPoint = {
											...properties,
											x: properties.x || properties.name,
										};
										const contrastSrc = isBubbleMode ? colors[0] : shapeFill;
										return (
											<DraggableLabel
												key={`county-label-${id}`}
												x={coords[0]}
												y={coords[1]}
												dataPoint={dataPoint}
												category={category}
												defaultDx={labels.labelPositionDX}
												defaultDy={labels.labelPositionDY}
												chartInnerWidth={innerWidth}
												chartInnerHeight={innerHeight}
												defaultLabel={defaultLabel}
												fill={getLabelFill({
													labelColor: labels.color as
														| 'contrast'
														| 'black'
														| 'white'
														| 'inherit',
													seriesColor: contrastSrc,
													backgroundHex: contrastSrc,
												})}
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
											category={category}
											bubbleRadiusScale={bubbleRadiusScale}
											fill={colors[0]}
											bubbleConfig={map.bubble}
											svgRef={svgRef}
											showTooltip={showTooltip}
											hideTooltip={hideTooltip}
											tooltipTimeoutRef={tooltipTimeoutRef}
											getName={(feature) => feature.properties?.name}
										/>
									)}
									{labelLayer}
								</>
							);
						}}
					</AlbersUsa>
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
			</svg>
			{legend.active && !isBubbleMode && (
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

			{legend.active && isBubbleMode && (
				<StyledLegend
					legend={legend}
					layoutWidth={width}
					layoutHeight={height}
					chartWidth={chartWidth}
					chartHeight={chartHeight}
				>
					<MapBubbleLegend
						bubbleRadiusScale={bubbleRadiusScale}
						maxDataValue={maxDataValue}
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
											category: tooltipData.category,
											color: tooltipData.fill,
										},
										tooltip,
										dataRender
									),
						}}
					/>
				</StyledTooltip>
			)}
		</div>
	);
};

export default AlbersUSACounties;

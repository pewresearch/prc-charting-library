// REACT
import { CSSProperties, Fragment, RefObject, useContext, useMemo, useRef } from 'react';

// VISX
import { EventType } from '@visx/event/lib/types';
import { AlbersUsa } from '@visx/geo';
import { Group } from '@visx/group';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';
import { scaleLinear, scaleOrdinal, scaleSqrt, scaleThreshold } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { geoCentroid } from '@visx/vendor/d3-geo';
import { AnnotationsLayer, ClickableLegend, DrawingsLayer, StyledLegend, StyledTooltip } from '../../overlays';
import { DraggableLabel } from '../../labels';

// TYPES & UTILITIES
import {
	BaseConfig,
	createTopologyLoader,
	DataContext,
	FeatureShape,
	FlatData,
	generateElementKey,
	getChartDimensions,
	getCustomLabel,
	getCustomLabelText,
	getCustomTooltip,
	getLocalPoint,
	getSharedProps,
	getTooltipFormat,
	getTooltipHeaderFormat,
	getTooltipMapDeemphasisProps,
	getLabelFill,
	Size,
	TableData,
	useSize,
	useStateData,
	fipsToStateAbbr,
} from '@prc/charting-utilities';

import * as topojson from 'topojson-client';
// INTERNAL
import MapBubbleLayer from './MapBubbleLayer';
import MapBubbleLegend from './MapBubbleLegend';

// STYLED COMPONENTS
import styled from '@emotion/styled';

// Create topology loader for US states
const loadTopology = createTopologyLoader(() => import('../../data/maps/usa/topology.json'));

// X and Y adjustments to individual states
const coordOffsets: Record<string, number[]> = {
	FL: [11, 3],
	AK: [0, -4],
	CA: [-7, 0],
	NY: [5, 0],
	MI: [13, 20],
	LA: [-10, -3],
	HI: [-10, 10],
	ID: [0, 10],
	WV: [-2, 4],
	KY: [10, 0],
	TN: [0, 4],
};

/**
 * These states are too small to have text labels
 * inside of them and are usually displayed with pointers.
 * TODO: add a pointer for these states in the future
 */
const ignoredStates: string[] = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD'];

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

const AlbersUSA = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	// Suspense-compatible resource loading (throws Promise on first render)
	const topology = loadTopology();

	// Process topology data
	const { features: unitedStates } = useMemo(
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
	const { layout, colors, dataRender, labels, legend, tooltip, map, shapes, annotations, drawings } = config;
	// SIZE AND LAYOUT
	const {parentClass, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, innerWidth, innerHeight, overflow, chartHeight } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;
	const flattenedData = useMemo(
		() =>
			data.reduce((acc: string | any[], curr: any) => {
				return acc.concat(curr);
			}, []),
		[data]
	);
	// DATA ACCESSORS
	// const getIndependentValue = (d: FlatData) => d[dataRender.x].toString();
	// const getDependentValue = (d: FlatData) =>
	// 	d[dataRender.y] as number | string;

	// Merge FlatData rows onto state features via the shared hook.
	const { mergedData } = useStateData({
		features: unitedStates,
		flattenedData,
		category: dataRender.categories[0],
	});

	const isBubbleMode = dataRender.mapStyle === 'bubble';
	const category = dataRender.categories[0];

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

	// Bubble radius scale — scaleSqrt so perceived area is proportional to value
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

	// Calculate centers for proper centering during resize
	const centerX = chartWidth / 2;
	const centerY = chartHeight / 2;

	// GET SHARED LAYOUT PROPS
	const { ariaProps, legendProps, tooltipVisible, annotationsVisible, labelProps } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the United States',
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
				style={{
					width: '100%',
					height: '100%',
					pointerEvents: tooltip.active ? 'auto' : 'none',
				}}
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				preserveAspectRatio="xMidYMid meet"
			>
				<Group role="presentation">
					<AlbersUsa<FeatureShape>
						data={mergedData}
						fitSize={[[chartWidth, chartHeight], geojson]}
						translate={[centerX, centerY]}
					>
						{({ features }) => {
							// Shared per-feature calculations reused by both polygon and label layers.
							const featureMeta = features.map(({ feature, path, projection }, i) => {
								const coords: [number, number] | null = projection(geoCentroid(feature));
								const { id, properties } = feature;
								if (!coords || !id) return null;
								const abbr = fipsToStateAbbr[feature.id?.toString() ?? ''];
								if (coordOffsets[abbr] && coords) {
									coords[0] += coordOffsets[abbr][0];
									coords[1] += coordOffsets[abbr][1];
								}
								const fill = isBubbleMode ? map.pathBackgroundFill : getFill(id, properties, category);
								const shapeIdentifier = properties.x || abbr;
								const shapeKey = generateElementKey(shapeIdentifier, category, null);
								const customShapeStyles = isBubbleMode ? {} : shapes?.customStyles?.[shapeKey] || {};
								const shapeFill = customShapeStyles.fill || fill;
								return {
									feature,
									path,
									coords,
									id,
									properties,
									abbr,
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
								const { feature, path, id, properties, abbr, fill, shapeFill, customShapeStyles, i } =
									meta;

								const onPolyMouseMove = isBubbleMode
									? undefined
									: (event: EventType) => {
											if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
											if (!svgRef.current) return;
											const eventSvgCoords = getLocalPoint(svgRef.current, event) || {
												x: 0,
												y: 0,
											};
											const { body: _mapTip, header: _mapHdr } = getCustomTooltip(
												feature.properties,
												category
											);
											showTooltip({
												tooltipData: {
													x: feature.properties.name,
													id: feature.id,
													y: feature.properties[category],
													category,
													fill,
													customTooltip: _mapTip,
													customHeader: _mapHdr,
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
								const shapeStroke = customShapeStyles.stroke || stroke;
								const shapeStrokeWidth = customShapeStyles.strokeWidth ?? strokeWidth;
								const shapeOpacity = customShapeStyles.opacity ?? opacity;

								return (
									<MapFeature
										key={`map-feature-${i}`}
										className="map-feature"
										d={path || ''}
										fill={shapeFill}
										stroke={shapeStroke}
										opacity={shapeOpacity}
										strokeWidth={shapeStrokeWidth}
										tabIndex={isBubbleMode ? -1 : 0}
										style={{
											cursor: !isBubbleMode && wpEditorFunctions?.shapes ? 'pointer' : undefined,
											pointerEvents: isBubbleMode
												? 'none'
												: wpEditorFunctions?.shapes
													? 'all'
													: undefined,
										}}
										onClick={(event: React.MouseEvent) => {
											if (!isBubbleMode && wpEditorFunctions?.shapes?.onClick) {
												const dataPoint = { ...properties, x: properties.x || abbr };
												wpEditorFunctions.shapes.onClick(
													dataPoint,
													category,
													fill,
													event.currentTarget,
													null
												);
											}
										}}
										onMouseLeave={onPolyMouseLeave}
										onMouseMove={onPolyMouseMove}
										onFocus={onPolyMouseMove}
										onBlur={onPolyMouseLeave}
									/>
								);
							});

							// ── Label layer ───────────────────────────────────────────────────────
							// Rendered after polygons and bubbles so labels always sit on top.
							const labelLayer = labels.active
								? featureMeta.map((meta) => {
										if (!meta) return null;
										const { coords, properties, abbr, shapeFill } = meta;
										if (map.ignoreSmallStateLabels && ignoredStates.includes(abbr)) return null;
										const customLabelText = getCustomLabelText(properties, category);
										const customLabel = customLabelText || getCustomLabel(properties, category);
										const defaultLabel = map.abbreviateLabels ? abbr : properties.name;
										const labelText = customLabel || defaultLabel;
										const dataPoint = { ...properties, x: properties.x || abbr };
										const contrastSrc = isBubbleMode ? colors[0] : shapeFill;
										return (
											<DraggableLabel
												key={`map-label-${abbr}`}
												x={coords[0]}
												y={coords[1]}
												dataPoint={dataPoint}
												category={category}
												defaultDx={labels.labelPositionDX}
												defaultDy={labels.labelPositionDY}
												chartInnerWidth={innerWidth}
												chartInnerHeight={innerHeight}
												defaultLabel={defaultLabel}
												fill={
													abbr === 'HI'
														? 'light-dark(#000000, #ffffff)'
														: getLabelFill({
																labelColor: labels.color as
																	| 'contrast'
																	| 'black'
																	| 'white'
																	| 'inherit',
																seriesColor: contrastSrc,
																backgroundHex: contrastSrc,
															})
												}
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
											coordOffsets={coordOffsets}
											getOffsetKey={(feature) => fipsToStateAbbr[feature.id?.toString() ?? '']}
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
											category: tooltipData.key,
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

export default AlbersUSA;

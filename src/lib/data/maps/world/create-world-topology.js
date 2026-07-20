#!/usr/bin/env node
/* eslint-disable no-console, jsdoc/require-param */
/**
 * Build countries-50m.json from World_map_for_CB.geojson + Pew country-regions.csv.
 *
 * - Relabels countries to Pew "List Name" values
 * - Assigns ISO numeric ids (with synthetic codes for Kosovo, etc.)
 * - Folds Northern Cyprus into Cyprus via mergeArcs
 * - Drops Antarctica and French Southern & Antarctic Lands
 *
 * Run: node create-world-topology.js
 */

const fs = require('fs');
const path = require('path');
const { topology } = require('topojson-server');
const { mergeArcs } = require('topojson-client');

const DIR = __dirname;
const GEOJSON_PATH = path.join(DIR, 'World_map_for_CB.geojson');
const CSV_PATH = path.join(DIR, 'country-regions.csv');
const OUTPUT_PATH = path.join(DIR, 'countries-50m.json');
const CONTINENTS_PATH = path.join(DIR, 'country-continents.json');

/** ISO numeric ids to exclude entirely from the world map. */
const DROP_IDS = new Set(['010', '260']); // Antarctica, French Southern & Antarctic Lands

/** Synthetic / user-assigned ISO numeric codes not in standard ISO 3166-1. */
const SYNTHETIC_ALPHA3_TO_ID = {
	XKX: '383', // Kosovo
};

/** GeoJSON feature names that fold into another country (no separate polygon). */
const FOLD_INTO = {
	'N. Cyprus': { id: '196', name: 'Cyprus' },
};

/**
 * Parse country-regions.csv into alpha-3 -> { name, id } lookup.
 */
function parseCountryCsv() {
	const raw = fs.readFileSync(CSV_PATH, 'utf8');
	const rows = raw.split(/\r?\n/).map((line) => {
		// Simple CSV split — guide has no embedded commas in data cells we need
		const cells = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				inQuotes = !inQuotes;
				continue;
			}
			if (ch === ',' && !inQuotes) {
				cells.push(current);
				current = '';
				continue;
			}
			current += ch;
		}
		cells.push(current);
		return cells;
	});

	const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('List Name')));
	if (headerIdx < 0) {
		throw new Error('Could not find header row in country-regions.csv');
	}

	const header = rows[headerIdx];
	const nameCol = header.findIndex((c) => c.includes('List Name'));
	const alpha3Col = header.findIndex((c) => c === 'Alpha3');

	const byAlpha3 = {};
	for (let i = headerIdx + 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row[nameCol]?.trim()) continue;
		const listName = row[nameCol].trim();
		let alpha3 = (row[alpha3Col] || '').trim().toUpperCase();
		// Strip "(See note)" suffix from alpha-3 cells like "XKX (See note)"
		alpha3 = alpha3.replace(/\s*\(SEE NOTE\)/i, '').trim();
		if (!alpha3 || alpha3.length !== 3) continue;
		byAlpha3[alpha3] = { name: listName };
	}

	return byAlpha3;
}

/**
 * Pick the best ISO alpha-3 code from Natural Earth properties.
 */
function pickAlpha3(props) {
	// Kosovo: Natural Earth sets ISO_N3 = "XKX" but ADM0_A3 = "KOS" (not in Pew guide)
	if (props.ISO_N3 === 'XKX' || props.NAME === 'Kosovo') {
		return 'XKX';
	}
	for (const key of ['ISO_A3', 'ISO_A3_EH']) {
		const v = props[key];
		if (v && v !== '-99' && v.length === 3) return v.toUpperCase();
	}
	return null;
}

/**
 * Pick ISO numeric id from Natural Earth properties.
 */
function pickNumericId(props, alpha3) {
	if (SYNTHETIC_ALPHA3_TO_ID[alpha3]) {
		return SYNTHETIC_ALPHA3_TO_ID[alpha3];
	}
	for (const key of ['ISO_N3', 'ISO_N3_EH', 'UN_A3']) {
		const v = props[key];
		if (v && v !== '-99' && /^\d+$/.test(String(v))) {
			return String(v).padStart(3, '0');
		}
	}
	return null;
}

function buildFeatures(geojson, csvByAlpha3) {
	const features = [];
	const idToContinent = {};

	for (const feature of geojson.features) {
		const props = feature.properties || {};
		const neName = props.NAME || props.ADMIN;

		// Fold Northern Cyprus into Cyprus
		if (FOLD_INTO[neName]) {
			const fold = FOLD_INTO[neName];
			features.push({
				type: 'Feature',
				id: fold.id,
				properties: { name: fold.name },
				geometry: feature.geometry,
			});
			continue;
		}

		const alpha3 = pickAlpha3(props);
		const numericId = pickNumericId(props, alpha3);

		if (!numericId) {
			console.warn(`Skipping feature with no numeric id: ${neName} (alpha3=${alpha3})`);
			continue;
		}

		if (DROP_IDS.has(numericId)) {
			console.log(`Dropping: ${neName} (${numericId})`);
			continue;
		}

		// Also drop by alpha-3 for Antarctic territories
		if (alpha3 === 'ATA' || alpha3 === 'ATF') {
			console.log(`Dropping: ${neName} (${alpha3})`);
			continue;
		}

		const csvEntry = alpha3 ? csvByAlpha3[alpha3] : null;
		const listName = csvEntry?.name || neName;

		// Capture Natural Earth CONTINENT for true-geographic continent slices.
		// "Seven seas (open ocean)" and Antarctica are not real continents we map.
		if (props.CONTINENT && props.CONTINENT !== 'Seven seas (open ocean)') {
			idToContinent[numericId] = props.CONTINENT;
		}

		features.push({
			type: 'Feature',
			id: numericId,
			properties: { name: listName },
			geometry: feature.geometry,
		});
	}

	return { features, idToContinent };
}

function main() {
	console.log('Reading source GeoJSON and CSV...');
	const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
	const csvByAlpha3 = parseCountryCsv();

	const { features, idToContinent } = buildFeatures(geojson, csvByAlpha3);
	console.log(`Prepared ${features.length} features`);

	// Build topology with 1e5 quantization (matches prior countries-50m.json)
	const collection = { type: 'FeatureCollection', features };
	let topo = topology({ countries: collection }, 1e5);

	// Dissolve Cyprus + Northern Cyprus into a single geometry
	const geoms = topo.objects.countries.geometries;
	const cyprusGeoms = geoms.filter((g) => g.id === '196');
	if (cyprusGeoms.length > 1) {
		console.log(`Merging ${cyprusGeoms.length} Cyprus geometries via mergeArcs...`);
		const merged = mergeArcs(topo, cyprusGeoms);
		const otherGeoms = geoms.filter((g) => g.id !== '196');
		topo = {
			...topo,
			objects: {
				countries: {
					...topo.objects.countries,
					geometries: [
						...otherGeoms,
						{
							...merged,
							id: '196',
							properties: { name: 'Cyprus' },
						},
					],
				},
			},
		};
	}

	fs.writeFileSync(OUTPUT_PATH, JSON.stringify(topo));
	fs.writeFileSync(CONTINENTS_PATH, JSON.stringify(idToContinent, null, 2));
	console.log(`✓ Wrote ${CONTINENTS_PATH} (${Object.keys(idToContinent).length} countries)`);

	const sizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
	const geomCount = topo.objects.countries.geometries.length;
	console.log(`✓ Wrote ${OUTPUT_PATH}`);
	console.log(`  Size: ${sizeKb}KB, geometries: ${geomCount}, arcs: ${topo.arcs.length}`);
}

main();

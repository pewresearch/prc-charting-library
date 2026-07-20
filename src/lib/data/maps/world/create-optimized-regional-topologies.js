#!/usr/bin/env node
/* eslint-disable no-console, jsdoc/require-param, no-unused-vars, no-bitwise */
/**
 * Create optimized regional topology files from countries-50m.json + country-regions.csv.
 * Regions are derived from Pew Broadest2019, Broad2019, and Sub2019 columns.
 *
 * Run: node create-optimized-regional-topologies.js
 * Prerequisite: node create-world-topology.js
 */

const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');

const DIR = __dirname;
const WORLD_PATH = path.join(DIR, 'countries-50m.json');
const CSV_PATH = path.join(DIR, 'country-regions.csv');
const CONTINENTS_PATH = path.join(DIR, 'country-continents.json');

// Canonical, hand-tuned projection presets live here (not generated). We never
// write to this file — we only read it to report which region slugs still need
// a preset entry. See reportMissingPresets().
const MAP_REGION_PRESETS_PATH = path.resolve(
	DIR,
	'../../../../../../../plugins/prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/mapRegionPresets.ts'
);

/** Countries that span multiple continents or cross the antimeridian — exclude from buffer zones. */
const PROBLEMATIC_NEIGHBORS = ['643', '840']; // Russia, USA

/** Synthetic alpha-3 -> numeric id (must match create-world-topology.js). */
const SYNTHETIC_ALPHA3_TO_ID = { XKX: '383' };

/** Region label + scheme for README. */
const REGION_META = {
	// Broadest2019
	americas: { name: 'Americas', scheme: 'Broadest2019' },
	asia: { name: 'Asia', scheme: 'Broadest2019' },
	europe: { name: 'Europe', scheme: 'Broadest2019' },
	'middle-east-north-africa': { name: 'Middle East-North Africa', scheme: 'Broadest2019' },
	'sub-saharan-africa': { name: 'Sub-Saharan Africa', scheme: 'Broadest2019' },
	// Broad2019
	africa: { name: 'Africa', scheme: 'Broad2019' },
	'asia-pacific': { name: 'Asia-Pacific', scheme: 'Broad2019' },
	'latin-america-and-the-caribbean': { name: 'Latin America and the Caribbean', scheme: 'Broad2019' },
	'middle-east': { name: 'Middle East', scheme: 'Broad2019' },
	'north-america': { name: 'North America', scheme: 'Broad2019' },
	// Sub2019
	caribbean: { name: 'Caribbean', scheme: 'Sub2019' },
	'central-america': { name: 'Central America', scheme: 'Sub2019' },
	'central-asia': { name: 'Central Asia', scheme: 'Sub2019' },
	'east-asia': { name: 'East Asia', scheme: 'Sub2019' },
	'eastern-europe': { name: 'Eastern Europe', scheme: 'Sub2019' },
	'north-africa': { name: 'North Africa', scheme: 'Sub2019' },
	oceania: { name: 'Oceania', scheme: 'Sub2019' },
	'south-america': { name: 'South America', scheme: 'Sub2019' },
	'south-asia': { name: 'South Asia', scheme: 'Sub2019' },
	'western-europe': { name: 'Western Europe', scheme: 'Sub2019' },
	// Continent (Natural Earth CONTINENT) — true-geographic, e.g. Africa includes Egypt
	'continent-africa': { name: 'Africa (Continent)', scheme: 'Continent', continent: 'Africa' },
	'continent-asia': { name: 'Asia (Continent)', scheme: 'Continent', continent: 'Asia' },
	'continent-europe': { name: 'Europe (Continent)', scheme: 'Continent', continent: 'Europe' },
	'continent-north-america': { name: 'North America (Continent)', scheme: 'Continent', continent: 'North America' },
	'continent-south-america': { name: 'South America (Continent)', scheme: 'Continent', continent: 'South America' },
	'continent-oceania': { name: 'Oceania (Continent)', scheme: 'Continent', continent: 'Oceania' },
};

/** Maps a Natural Earth CONTINENT value to its continent-slice slug. */
const CONTINENT_TO_SLUG = Object.fromEntries(
	Object.entries(REGION_META)
		.filter(([, meta]) => meta.continent)
		.map(([slug, meta]) => [meta.continent, slug])
);

/** Regions where Russia is included for border arcs but filtered at render time. */
const EXCLUDED_AT_RENDER = {
	'east-asia': ['643'],
};

/**
 * Convert a Pew region label to a URL-safe slug.
 */
function regionToSlug(label) {
	return label
		.replace(/\s*\(See note\)/gi, '')
		.trim()
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Parse CSV rows into country records with region assignments.
 */
function parseCountryCsv() {
	const raw = fs.readFileSync(CSV_PATH, 'utf8');
	const rows = raw.split(/\r?\n/).map((line) => {
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
	const header = rows[headerIdx];
	const cols = {
		name: header.findIndex((c) => c.includes('List Name')),
		broadest: header.findIndex((c) => c === 'Broadest2019'),
		broad: header.findIndex((c) => c === 'Broad2019'),
		sub: header.findIndex((c) => c === 'Sub2019'),
		alpha3: header.findIndex((c) => c === 'Alpha3'),
	};

	const countries = [];
	for (let i = headerIdx + 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row[cols.name]?.trim()) continue;
		let alpha3 = (row[cols.alpha3] || '').trim().toUpperCase();
		alpha3 = alpha3.replace(/\s*\(SEE NOTE\)/i, '').trim();
		if (!alpha3 || alpha3.length !== 3) continue;

		countries.push({
			name: row[cols.name].trim(),
			alpha3,
			broadest: row[cols.broadest]?.trim() || '',
			broad: row[cols.broad]?.trim() || '',
			sub: row[cols.sub]?.trim() || '',
		});
	}
	return countries;
}

/**
 * Build alpha-3 -> numeric id from the world topology.
 */
function buildAlpha3ToId(worldTopology) {
	const map = { ...SYNTHETIC_ALPHA3_TO_ID };
	// Also build name -> id for countries in topology
	const nameToId = {};
	for (const g of worldTopology.objects.countries.geometries) {
		if (g.properties?.name) {
			nameToId[g.properties.name] = g.id;
		}
	}
	return {
		alpha3ToId: map,
		nameToId,
		worldIds: new Set(worldTopology.objects.countries.geometries.map((g) => g.id)),
	};
}

/**
 * Resolve numeric id for a CSV country row.
 */
function resolveCountryId(row, alpha3ToNumericFromIso, nameToId, worldIds) {
	// Try iso-alpha3.json-style lookup from CSV alpha3
	// We'll read numeric ids from iso-alpha3.json if present, else from topology by name
	if (SYNTHETIC_ALPHA3_TO_ID[row.alpha3]) {
		return SYNTHETIC_ALPHA3_TO_ID[row.alpha3];
	}
	const byName = nameToId[row.name];
	if (byName && worldIds.has(byName)) return byName;
	return alpha3ToNumericFromIso[row.alpha3] || null;
}

/**
 * Build region slug -> { ids: Set, label } from CSV.
 */
function buildRegionGroups(countries, alpha3ToNumeric, nameToId, worldIds) {
	const groups = {};

	for (const country of countries) {
		const id = resolveCountryId(country, alpha3ToNumeric, nameToId, worldIds);
		if (!id) {
			console.warn(`  No topology id for ${country.name} (${country.alpha3}) — skipping region assignment`);
			continue;
		}

		const assignments = [
			{ col: 'broadest', value: country.broadest },
			{ col: 'broad', value: country.broad },
			{ col: 'sub', value: country.sub },
		];

		for (const { value } of assignments) {
			if (!value) continue;
			const slug = regionToSlug(value);
			if (!REGION_META[slug]) {
				console.warn(`  Unknown region slug "${slug}" from "${value}" — add to REGION_META`);
				continue;
			}
			if (!groups[slug]) {
				groups[slug] = {
					...REGION_META[slug],
					countries: new Set(),
				};
			}
			groups[slug].countries.add(id);
		}
	}

	// Continent slices from Natural Earth CONTINENT (id -> continent), independent of CSV groupings
	const idToContinent = JSON.parse(fs.readFileSync(CONTINENTS_PATH, 'utf8'));
	for (const [id, continent] of Object.entries(idToContinent)) {
		const slug = CONTINENT_TO_SLUG[continent];
		if (!slug) continue;
		if (!groups[slug]) {
			groups[slug] = { ...REGION_META[slug], countries: new Set() };
		}
		groups[slug].countries.add(id);
	}

	// Convert Sets to sorted arrays
	for (const slug of Object.keys(groups)) {
		groups[slug].countries = Array.from(groups[slug].countries).sort();
	}

	return groups;
}

/**
 * Resolve a TopoJSON arc reference to its forward arc index.
 * Reversed arcs are encoded with one's complement (~i), NOT negation (-i),
 * so arc reference -1 means arc 0 traversed backwards.
 */
function arcId(arcRef) {
	return arcRef < 0 ? ~arcRef : arcRef;
}

function findNeighboringCountries(countryIds, allGeometries) {
	const neighbors = new Set();
	const targetGeometries = allGeometries.filter((g) => countryIds.includes(g.id));
	const targetArcs = new Set();

	function collectArcsFromGeometry(geom) {
		if (!geom) return;
		if (geom.type === 'Polygon') {
			geom.arcs.forEach((ring) => ring.forEach((arcIndex) => targetArcs.add(arcId(arcIndex))));
		} else if (geom.type === 'MultiPolygon') {
			geom.arcs.forEach((polygon) =>
				polygon.forEach((ring) => ring.forEach((arcIndex) => targetArcs.add(arcId(arcIndex))))
			);
		}
	}

	targetGeometries.forEach((g) => {
		if (g.type === 'GeometryCollection') {
			g.geometries.forEach(collectArcsFromGeometry);
		} else {
			collectArcsFromGeometry(g);
		}
	});

	allGeometries.forEach((country) => {
		if (countryIds.includes(country.id)) return;

		let sharesArc = false;
		function checkGeometry(geom) {
			if (!geom || sharesArc) return;
			if (geom.type === 'Polygon') {
				geom.arcs.forEach((ring) => {
					ring.forEach((arcIndex) => {
						if (targetArcs.has(arcId(arcIndex))) sharesArc = true;
					});
				});
			} else if (geom.type === 'MultiPolygon') {
				geom.arcs.forEach((polygon) => {
					polygon.forEach((ring) => {
						ring.forEach((arcIndex) => {
							if (targetArcs.has(arcId(arcIndex))) sharesArc = true;
						});
					});
				});
			}
		}

		if (country.type === 'GeometryCollection') {
			country.geometries.forEach(checkGeometry);
		} else {
			checkGeometry(country);
		}

		if (sharesArc && !PROBLEMATIC_NEIGHBORS.includes(country.id)) {
			neighbors.add(country.id);
		}
	});

	return Array.from(neighbors);
}

function collectUsedArcs(geometries) {
	const usedArcs = new Set();

	function processGeometry(geom) {
		if (!geom) return;
		if (geom.type === 'Polygon') {
			geom.arcs.forEach((ring) => {
				ring.forEach((arcIndex) => usedArcs.add(arcId(arcIndex)));
			});
		} else if (geom.type === 'MultiPolygon') {
			geom.arcs.forEach((polygon) => {
				polygon.forEach((ring) => {
					ring.forEach((arcIndex) => usedArcs.add(arcId(arcIndex)));
				});
			});
		}
	}

	geometries.forEach((geometry) => {
		if (geometry.type === 'GeometryCollection') {
			geometry.geometries.forEach(processGeometry);
		} else {
			processGeometry(geometry);
		}
	});

	return usedArcs;
}

function remapArcRef(arcIndex, arcIndexMap) {
	const newIndex = arcIndexMap.get(arcId(arcIndex));
	// Re-encode reversed arcs with one's complement so arc 0 reversed stays distinct.
	return arcIndex < 0 ? ~newIndex : newIndex;
}

function remapGeometry(geom, arcIndexMap) {
	if (!geom) return geom;

	if (geom.type === 'Polygon') {
		return {
			...geom,
			arcs: geom.arcs.map((ring) => ring.map((arcIndex) => remapArcRef(arcIndex, arcIndexMap))),
		};
	}
	if (geom.type === 'MultiPolygon') {
		return {
			...geom,
			arcs: geom.arcs.map((polygon) =>
				polygon.map((ring) => ring.map((arcIndex) => remapArcRef(arcIndex, arcIndexMap)))
			),
		};
	}
	return geom;
}

function createOptimizedRegionalTopology(regionKey, regionData, worldTopology, originalSizeKb) {
	const { name, countries } = regionData;
	const allGeometries = worldTopology.objects.countries.geometries;

	const neighboringCountries = findNeighboringCountries(countries, allGeometries);
	console.log(`  Found ${neighboringCountries.length} neighboring countries for buffer zone`);

	const countriesWithBuffer = [...countries, ...neighboringCountries];
	const geometriesForArcs = allGeometries.filter((g) => countriesWithBuffer.includes(g.id));
	const filteredGeometries = allGeometries.filter((g) => countries.includes(g.id));
	const usedArcs = collectUsedArcs(geometriesForArcs);

	const arcIndexMap = new Map();
	const sortedUsedArcs = Array.from(usedArcs).sort((a, b) => a - b);
	sortedUsedArcs.forEach((oldIndex, newIndex) => arcIndexMap.set(oldIndex, newIndex));

	const newArcs = sortedUsedArcs.map((index) => worldTopology.arcs[index]);
	const remappedGeometries = filteredGeometries.map((geometry) => {
		if (geometry.type === 'GeometryCollection') {
			return {
				...geometry,
				geometries: geometry.geometries.map((g) => remapGeometry(g, arcIndexMap)),
			};
		}
		return { ...geometry, ...remapGeometry(geometry, arcIndexMap) };
	});

	const regionalTopology = {
		...worldTopology,
		arcs: newArcs,
		objects: {
			countries: {
				...worldTopology.objects.countries,
				geometries: remappedGeometries,
			},
		},
	};

	const filename = `${regionKey}-50m.json`;
	const filepath = path.join(DIR, filename);
	fs.writeFileSync(filepath, JSON.stringify(regionalTopology));

	const fileSize = (fs.statSync(filepath).size / 1024).toFixed(1);
	const reduction = (((originalSizeKb - fileSize) / originalSizeKb) * 100).toFixed(1);

	console.log(`✓ Created ${filename}`);
	console.log(`  Size: ${fileSize}KB (${reduction}% reduction)`);
	console.log(`  Countries: ${filteredGeometries.length}`);
	console.log(
		`  Arcs: ${newArcs.length} of ${worldTopology.arcs.length} (${((newArcs.length / worldTopology.arcs.length) * 100).toFixed(1)}% kept)`
	);

	return {
		regionKey,
		name,
		scheme: regionData.scheme,
		filename,
		fileSize: `${fileSize}KB`,
		reduction: `${reduction}%`,
		countryCount: filteredGeometries.length,
		arcCount: newArcs.length,
		originalArcCount: worldTopology.arcs.length,
		countries: filteredGeometries.map((g) => g.properties.name).sort(),
		topology: regionalTopology,
		excludedAtRender: EXCLUDED_AT_RENDER[regionKey] || [],
	};
}

function writeReadme(manifest, worldSizeKb) {
	const readmeContent = `# World Map Regional Topologies

This directory contains optimized regional topology files extracted from the full world topology (\`countries-50m.json\`, ${worldSizeKb}KB).

Regional groupings follow the Pew Research Center **Countries and Regions Guide (May 2026)** using Broadest2019, Broad2019, and Sub2019 columns.

These regional files include **only the arcs (borders) needed** for the countries in each region, resulting in significant file size reductions.

## Files

- **countries-50m.json** (${worldSizeKb}KB) - Full world map with all countries

${Object.entries(manifest)
	.sort(([a], [b]) => a.localeCompare(b))
	.map(
		([, data]) => `### ${data.filename} (${data.fileSize}, ${data.reduction} reduction)
**Region:** ${data.name} (${data.scheme})
**Countries:** ${data.countryCount}
**Arcs:** ${data.arcCount} of ${data.originalArcCount}

<details>
<summary>View country list</summary>

${data.countries.map((c) => `- ${c}`).join('\n')}

</details>
`
	)
	.join('\n')}

## Regenerating Files

\`\`\`bash
node create-world-topology.js
node create-optimized-regional-topologies.js
\`\`\`

## Non-standard ISO Codes

| Territory | ID | Alpha-3 | Notes |
| --------- | -- | ------- | ----- |
| Kosovo | 383 | XKX | User-assigned code (widely used) |
| Western Sahara | 732 | ESH | Contested territory per Pew guide |

## Technical Details

TopoJSON stores geographic boundaries as shared "arcs". The optimization process identifies which arcs are needed for the selected countries and removes all others.
`;

	fs.writeFileSync(path.join(DIR, 'README.md'), readmeContent);
	console.log('✓ Created README.md');
}

/**
 * Compute a rough bbox-based projection suggestion for a region. This is only a
 * STARTING POINT for hand-tuning — bbox-center math is wrong for antimeridian
 * crossers (Oceania, East Asia) and scattered island territories, which is why
 * the real values are hand-maintained in mapRegionPresets.ts.
 */
function suggestProjection(regionalTopology) {
	const fc = feature(regionalTopology, regionalTopology.objects.countries);
	let minLon = Infinity;
	let maxLon = -Infinity;
	let minLat = Infinity;
	let maxLat = -Infinity;

	function walk(c) {
		if (typeof c[0] === 'number') {
			const [lon, lat] = c;
			if (lon >= -180 && lon <= 180) {
				minLon = Math.min(minLon, lon);
				maxLon = Math.max(maxLon, lon);
				minLat = Math.min(minLat, lat);
				maxLat = Math.max(maxLat, lat);
			}
			return;
		}
		c.forEach(walk);
	}
	for (const f of fc.features) {
		if (f.geometry?.coordinates) walk(f.geometry.coordinates);
	}

	const span = Math.max(maxLon - minLon, maxLat - minLat);
	let customScale = 2;
	if (span < 30) customScale = 4;
	else if (span < 60) customScale = 3;
	else if (span < 120) customScale = 2.5;

	return {
		centerLongitude: Math.round(((minLon + maxLon) / 2) * 10) / 10,
		centerLatitude: Math.round(((minLat + maxLat) / 2) * 10) / 10,
		customScale,
	};
}

/** Read the top-level region slugs already defined in mapRegionPresets.ts. */
function readExistingPresetSlugs() {
	let text;
	try {
		text = fs.readFileSync(MAP_REGION_PRESETS_PATH, 'utf8');
	} catch (err) {
		console.log(
			`\n⚠️  Could not read mapRegionPresets.ts to check preset coverage (${err.code}). Skipping report.`
		);
		return null;
	}
	const slugs = new Set();
	// Match top-level object keys: `slug: {` or `'kebab-slug': {`.
	const keyRegex = /(?:^|\n)\t\t'?([a-z][a-z0-9-]*)'?\s*:\s*\{/g;
	for (const match of text.matchAll(keyRegex)) {
		slugs.add(match[1]);
	}
	return slugs;
}

/**
 * Non-destructively report any region slugs that lack a preset entry in
 * mapRegionPresets.ts, with copy-paste-ready suggested values. Never writes.
 */
function reportMissingPresets(suggestions) {
	const existing = readExistingPresetSlugs();
	if (!existing) return;

	const missing = Object.keys(suggestions).filter((slug) => !existing.has(slug));
	if (missing.length === 0) {
		console.log('\n✓ All regions have a projection preset in mapRegionPresets.ts');
		return;
	}

	console.log(
		`\n⚠️  ${missing.length} region(s) missing from mapRegionPresets.ts.\n` +
			'   Paste these into MAP_REGION_PRESETS and hand-tune the framing:\n'
	);
	for (const slug of missing) {
		const { label, scheme, projection: p } = suggestions[slug];
		console.log(
			`\t'${slug}': {\n` +
				`\t\tlabel: '[${scheme}] ${label}',\n` +
				`\t\tcenterLongitude: ${p.centerLongitude},\n` +
				`\t\tcenterLatitude: ${p.centerLatitude},\n` +
				'\t\trotateLambda: 0,\n\t\trotatePhi: 0,\n\t\trotateGamma: 0,\n' +
				`\t\tcustomScale: ${p.customScale}, // TODO: verify framing\n` +
				'\t},'
		);
	}
}

function main() {
	console.log('Loading world topology and country regions CSV...\n');
	const worldTopology = JSON.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
	const isoAlpha3 = JSON.parse(fs.readFileSync(path.join(DIR, 'iso-alpha3.json'), 'utf8'));

	// Flip iso-alpha3 to alpha3 -> numeric (file is alpha3 -> id)
	const alpha3ToNumeric = isoAlpha3;
	const { nameToId, worldIds } = buildAlpha3ToId(worldTopology);

	const csvCountries = parseCountryCsv();
	const regionGroups = buildRegionGroups(csvCountries, alpha3ToNumeric, nameToId, worldIds);

	const originalSizeKb = fs.statSync(WORLD_PATH).size / 1024;
	const manifest = {};

	// Sort regions: Broadest2019 first, then Broad2019, then Sub2019
	const schemeOrder = { Continent: 0, Broadest2019: 1, Broad2019: 2, Sub2019: 3 };
	const sortedSlugs = Object.keys(regionGroups).sort((a, b) => {
		const sa = schemeOrder[regionGroups[a].scheme] ?? 9;
		const sb = schemeOrder[regionGroups[b].scheme] ?? 9;
		if (sa !== sb) return sa - sb;
		return a.localeCompare(b);
	});

	console.log(`Creating ${sortedSlugs.length} optimized regional topology files...\n`);

	const suggestions = {};
	for (const slug of sortedSlugs) {
		console.log(`Processing ${slug}...`);
		manifest[slug] = createOptimizedRegionalTopology(slug, regionGroups[slug], worldTopology, originalSizeKb);
		suggestions[slug] = {
			label: regionGroups[slug].name,
			scheme: regionGroups[slug].scheme,
			projection: suggestProjection(manifest[slug].topology),
		};
		delete manifest[slug].topology; // don't persist topology in manifest
		console.log('');
	}

	writeReadme(manifest, originalSizeKb.toFixed(1));
	console.log(`\n✅ Successfully created ${sortedSlugs.length} optimized regional topology files`);

	reportMissingPresets(suggestions);
}

main();

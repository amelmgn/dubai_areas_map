import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

export function assignSector(feature, sectorFeatures) {
  const c = turf.centroid(feature);
  for (const s of sectorFeatures) {
    if (turf.booleanPointInPolygon(c, s)) return s.properties.slug;
  }
  // fallback: сектор с наибольшей площадью пересечения
  let best = null, bestArea = 0;
  for (const s of sectorFeatures) {
    try {
      // @turf/turf v7: intersect принимает FeatureCollection из двух полигонов
      const inter = turf.intersect(turf.featureCollection([feature, s]));
      if (inter) {
        const a = turf.area(inter);
        if (a > bestArea) { bestArea = a; best = s.properties.slug; }
      }
    } catch { /* кривая геометрия — пропускаем */ }
  }
  return best;
}

export function labelPoint(feature) {
  const p = feature.properties || {};
  if (typeof p.lon === 'number' && typeof p.lat === 'number') return [p.lon, p.lat];
  const c = turf.centroid(feature);
  if (turf.booleanPointInPolygon(c, feature)) return c.geometry.coordinates;
  return turf.pointOnFeature(feature).geometry.coordinates;
}

export function featureBbox(feature) {
  return turf.bbox(feature); // [minLng,minLat,maxLng,maxLat]
}

export function enrichCollection(collection, sectorFeatures, { isSectorLayer = false } = {}) {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((f, i) => {
      const sector = isSectorLayer ? f.properties.slug : assignSector(f, sectorFeatures);
      const [labelLng, labelLat] = labelPoint(f);
      return {
        ...f,
        id: i,
        properties: { ...f.properties, sector, labelLng, labelLat, bbox: featureBbox(f) },
      };
    }),
  };
}

// --- CLI ---
function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = join(__dirname, '..');
  const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

  const sectorsRaw = read('geojson/dubai_sectors.geojson');
  const districtsRaw = read('geojson/dubai_districts.geojson');
  const communitiesRaw = read('geojson/dubai_locations.geojson');
  const sectorFeatures = sectorsRaw.features;

  const out = {
    'sectors.geojson': enrichCollection(sectorsRaw, sectorFeatures, { isSectorLayer: true }),
    'districts.geojson': enrichCollection(districtsRaw, sectorFeatures, { isSectorLayer: false }),
    'communities.geojson': enrichCollection(communitiesRaw, sectorFeatures, { isSectorLayer: false }),
  };

  for (const [name, fc] of Object.entries(out)) {
    const dest = join(root, 'public/data', name);
    writeFileSync(dest, JSON.stringify(fc));
    const noSector = fc.features.filter((f) => !f.properties.sector).length;
    console.log(`${name}: ${fc.features.length} features, ${noSector} без сектора`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSector, labelPoint, featureBbox, enrichCollection } from '../scripts/enrich.mjs';

// Два сектора-квадрата рядом по оси X
const sectors = [
  poly('sector-1', [[0,0],[10,0],[10,10],[0,10],[0,0]]),
  poly('sector-2', [[10,0],[20,0],[20,10],[10,10],[10,0]]),
];
function poly(slug, ring, extraProps = {}) {
  return {
    type: 'Feature',
    properties: { slug, name: slug, ...extraProps },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

test('assignSector: точка-центроид внутри первого сектора', () => {
  const community = poly('A', [[1,1],[3,1],[3,3],[1,3],[1,1]]);
  assert.equal(assignSector(community, sectors), 'sector-1');
});

test('assignSector: объект во втором секторе', () => {
  const community = poly('B', [[11,1],[13,1],[13,3],[11,3],[11,1]]);
  assert.equal(assignSector(community, sectors), 'sector-2');
});

test('assignSector: вне всех секторов → null', () => {
  const community = poly('C', [[100,100],[101,100],[101,101],[100,101],[100,100]]);
  assert.equal(assignSector(community, sectors), null);
});

test('labelPoint: использует lon/lat если есть', () => {
  const sector = poly('sector-1', [[0,0],[10,0],[10,10],[0,10],[0,0]], { lon: 5.5, lat: 4.4 });
  assert.deepEqual(labelPoint(sector), [5.5, 4.4]);
});

test('labelPoint: центроид для полигона без lon/lat', () => {
  const community = poly('A', [[0,0],[4,0],[4,4],[0,4],[0,0]]);
  const [lng, lat] = labelPoint(community);
  assert.ok(Math.abs(lng - 2) < 0.001 && Math.abs(lat - 2) < 0.001);
});

test('featureBbox: возвращает [minLng,minLat,maxLng,maxLat]', () => {
  const community = poly('A', [[1,2],[5,2],[5,8],[1,8],[1,2]]);
  assert.deepEqual(featureBbox(community), [1, 2, 5, 8]);
});

test('enrichCollection: добавляет id, sector, labelLng/Lat, bbox', () => {
  const fc = { type: 'FeatureCollection', features: [
    poly('A', [[1,1],[3,1],[3,3],[1,3],[1,1]]),
  ]};
  const out = enrichCollection(fc, sectors, { isSectorLayer: false });
  const f = out.features[0];
  assert.equal(f.id, 0);
  assert.equal(f.properties.sector, 'sector-1');
  assert.ok(Array.isArray(f.properties.bbox) && f.properties.bbox.length === 4);
  assert.equal(typeof f.properties.labelLng, 'number');
  assert.equal(typeof f.properties.labelLat, 'number');
});

test('enrichCollection: для слоя секторов sector = собственный slug', () => {
  const fc = { type: 'FeatureCollection', features: sectors };
  const out = enrichCollection(fc, sectors, { isSectorLayer: true });
  assert.equal(out.features[0].properties.sector, 'sector-1');
});

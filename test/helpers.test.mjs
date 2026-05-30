import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectorColor, SECTOR_PALETTE, NULL_SECTOR_COLOR, buildSearchIndex, searchFilter } from '../public/helpers.js';

test('SECTOR_PALETTE: ровно 9 секторов', () => {
  assert.equal(Object.keys(SECTOR_PALETTE).length, 9);
});

test('sectorColor: известный slug → его цвет', () => {
  assert.equal(sectorColor('sector-1'), SECTOR_PALETTE['sector-1']);
});

test('sectorColor: неизвестный/null → нейтральный цвет', () => {
  assert.equal(sectorColor(null), NULL_SECTOR_COLOR);
  assert.equal(sectorColor('xxx'), NULL_SECTOR_COLOR);
});

const data = {
  sectors: fc([feat('Sector 1', [0, 0, 1, 1], 0)]),
  districts: fc([feat('Al Awir', [0, 0, 2, 2], 0)]),
  communities: fc([feat('Al Barsha', [1, 1, 2, 2], 0), feat('Barsha Heights', [3, 3, 4, 4], 1)]),
};
function fc(features) { return { type: 'FeatureCollection', features }; }
function feat(name, bbox, id) { return { type: 'Feature', id, properties: { name, bbox }, geometry: null }; }

test('buildSearchIndex: собирает все уровни с level, source, id и bbox', () => {
  const idx = buildSearchIndex(data);
  assert.equal(idx.length, 4);
  const barsha = idx.find((e) => e.name === 'Al Barsha');
  assert.equal(barsha.level, 'community');
  assert.equal(barsha.source, 'communities');
  assert.equal(barsha.id, 0);
  assert.deepEqual(barsha.bbox, [1, 1, 2, 2]);
});

test('searchFilter: регистронезависимый поиск по подстроке', () => {
  const idx = buildSearchIndex(data);
  const res = searchFilter(idx, 'barsha');
  assert.equal(res.length, 2);
  assert.ok(res.every((r) => /barsha/i.test(r.name)));
});

test('searchFilter: совпадения с начала идут первыми', () => {
  const idx = buildSearchIndex(data);
  const res = searchFilter(idx, 'barsha');
  // "Barsha Heights" начинается с запроса → должен быть первым
  assert.equal(res[0].name, 'Barsha Heights');
});

test('searchFilter: пустой запрос → пустой результат', () => {
  const idx = buildSearchIndex(data);
  assert.deepEqual(searchFilter(idx, '   '), []);
});

test('searchFilter: уважает limit', () => {
  const idx = buildSearchIndex(data);
  assert.equal(searchFilter(idx, 'a', 1).length, 1);
});

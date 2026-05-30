# Карта районов Дубая — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статический сайт с интерактивной картой Дубая (MapLibre): секторы → районы → коммьюнити сменяются по зуму, при наведении подсветка + название, поиск, тёмная/светлая тема, деплой на Netlify.

**Architecture:** Чистая статика в `public/`. Скрипт `scripts/enrich.mjs` (Turf) один раз на этапе сборки обогащает три исходных GeoJSON: проставляет родительский сектор (для цвета), точку подписи, bbox (для зума по клику/поиску) и числовой `id` (для `feature-state`). В браузере MapLibre грузит обогащённые данные, рисует по слою fill/line/label на каждый уровень с порогами зума; вся логика тем/слоёв/событий — в `public/app.js`, чистые функции — в `public/helpers.js`.

**Tech Stack:** MapLibre GL JS 4 (CDN), `@turf/turf` (только в build-скрипте), Node встроенный test runner (`node --test`), Carto raster basemap, Netlify.

---

## Структура файлов

```
dubai_areas_map/
├── geojson/                       # исходники, read-only
├── scripts/
│   └── enrich.mjs                 # чистые функции + CLI-обёртка (Turf)
├── test/
│   ├── enrich.test.mjs            # тесты enrich.mjs
│   └── helpers.test.mjs           # тесты helpers.js
├── public/
│   ├── index.html                 # разметка: карта, поиск, легенда, кнопка темы
│   ├── style.css
│   ├── helpers.js                 # чистые ф-ции: палитра, поиск (ESM, без зависимостей)
│   ├── app.js                     # MapLibre: стиль, слои, события (ESM)
│   └── data/                      # вывод enrich.mjs (в .gitignore)
├── package.json
├── netlify.toml
├── .gitignore
└── README.md
```

**Контракт `helpers.js` (используется и в браузере, и в тестах):**
- `SECTOR_PALETTE: Record<string,string>` — slug сектора → цвет (9 шт.)
- `NULL_SECTOR_COLOR: string`
- `sectorColor(slug): string`
- `buildSearchIndex(data): {name,level,source,id,bbox}[]` — `data = {sectors,districts,communities}` (FeatureCollection). `level` — для отображения (`sector`/`district`/`community`), `source` — имя источника MapLibre (`sectors`/`districts`/`communities`), `id` — для подсветки через `setFeatureState`
- `searchFilter(index, query, limit=8): {name,level,source,id,bbox}[]`

**Контракт `enrich.mjs`:**
- `assignSector(feature, sectorFeatures): string|null`
- `labelPoint(feature): [lng,lat]`
- `featureBbox(feature): [minLng,minLat,maxLng,maxLat]`
- `enrichCollection(collection, sectorFeatures, {isSectorLayer}): FeatureCollection` — добавляет в каждый feature: `id` (индекс), `properties.sector`, `properties.labelLng/labelLat`, `properties.bbox`

---

## Task 1: Скелет проекта

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `public/data/.gitkeep`

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "dubai-areas-map",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/enrich.mjs",
    "test": "node --test",
    "serve": "python3 -m http.server 8080 --directory public"
  },
  "devDependencies": {
    "@turf/turf": "^7.1.0"
  }
}
```

- [ ] **Step 2: Создать `.gitignore`**

```
node_modules/
public/data/*
!public/data/.gitkeep
.superpowers/
.DS_Store
```

- [ ] **Step 3: Создать `public/data/.gitkeep`** (пустой файл, чтобы папка существовала)

```
```

- [ ] **Step 4: Установить зависимости**

Run: `npm install`
Expected: создаётся `node_modules/`, `@turf/turf` установлен, без ошибок.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore public/data/.gitkeep
git commit -m "chore: project scaffolding"
```

---

## Task 2: Скрипт обогащения данных (`enrich.mjs`) — TDD

**Files:**
- Create: `scripts/enrich.mjs`
- Test: `test/enrich.test.mjs`

- [ ] **Step 1: Написать падающий тест**

`test/enrich.test.mjs`:

```js
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/enrich.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/enrich.mjs'` / экспортов нет.

- [ ] **Step 3: Реализовать `scripts/enrich.mjs`**

```js
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
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `node --test test/enrich.test.mjs`
Expected: PASS — все 8 тестов зелёные.

- [ ] **Step 5: Прогнать CLI на реальных данных**

Run: `npm run build`
Expected: вывод вида `sectors.geojson: 9 features, 0 без сектора`, `districts.geojson: 14 features, ...`, `communities.geojson: 227 features, ...`; в `public/data/` появились три файла. Если у части коммьюнити «без сектора» > 0 — это допустимо (покрасятся серым), но загляни в число; если большое — пороги/геометрию проверим вручную позже.

- [ ] **Step 6: Commit**

```bash
git add scripts/enrich.mjs test/enrich.test.mjs
git commit -m "feat: data enrichment script with sector assignment, label points, bbox"
```

---

## Task 3: Чистые функции `helpers.js` — TDD

**Files:**
- Create: `public/helpers.js`
- Test: `test/helpers.test.mjs`

- [ ] **Step 1: Написать падающий тест**

`test/helpers.test.mjs`:

```js
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
  assert.equal(res[0].name, 'Al Barsha'.startsWith('Barsha') ? 'Al Barsha' : 'Barsha Heights');
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test test/helpers.test.mjs`
Expected: FAIL — модуль/экспорты не найдены.

- [ ] **Step 3: Реализовать `public/helpers.js`**

```js
export const SECTOR_PALETTE = {
  'sector-1': '#2563eb',
  'sector-2': '#16a34a',
  'sector-3': '#ea580c',
  'sector-4': '#9333ea',
  'sector-5': '#0891b2',
  'sector-6': '#dc2626',
  'sector-7': '#ca8a04',
  'sector-8': '#db2777',
  'sector-9': '#4f46e5',
};

export const NULL_SECTOR_COLOR = '#9ca3af';

export function sectorColor(slug) {
  return SECTOR_PALETTE[slug] || NULL_SECTOR_COLOR;
}

export function buildSearchIndex(data) {
  const idx = [];
  const add = (collection, source, level) => {
    for (const f of collection.features) {
      idx.push({ name: f.properties.name, level, source, id: f.id, bbox: f.properties.bbox });
    }
  };
  add(data.sectors, 'sectors', 'sector');
  add(data.districts, 'districts', 'district');
  add(data.communities, 'communities', 'community');
  return idx;
}

export function searchFilter(index, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = index.filter((e) => e.name.toLowerCase().includes(q));
  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `node --test test/helpers.test.mjs`
Expected: PASS — все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add public/helpers.js test/helpers.test.mjs
git commit -m "feat: pure helpers — sector palette and search index/filter"
```

---

## Task 4: HTML-каркас и стили

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`

- [ ] **Step 1: Создать `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dubai Areas Map</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="map"></div>

  <div id="search-box">
    <input id="search-input" type="text" placeholder="Поиск района или коммьюнити…" autocomplete="off">
    <ul id="search-results" hidden></ul>
  </div>

  <button id="theme-toggle" title="Сменить тему">🌙</button>

  <div id="legend">
    <div class="legend-title">Секторы</div>
    <ul id="legend-list"></ul>
  </div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Создать `public/style.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
#map { position: absolute; inset: 0; }

#search-box {
  position: absolute; top: 12px; left: 12px; z-index: 2; width: 280px;
}
#search-input {
  width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
  font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.12); background: #fff;
}
#search-results {
  list-style: none; margin: 4px 0 0; padding: 4px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.14);
  max-height: 320px; overflow-y: auto;
}
#search-results li {
  padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px;
  display: flex; justify-content: space-between; gap: 8px;
}
#search-results li:hover { background: #f1f5f9; }
#search-results .lvl { color: #94a3b8; font-size: 12px; text-transform: capitalize; }

#theme-toggle {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 40px; height: 40px; border: none; border-radius: 8px; cursor: pointer;
  font-size: 18px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12);
}

#legend {
  position: absolute; bottom: 24px; right: 12px; z-index: 2;
  background: rgba(255,255,255,.94); border-radius: 8px; padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.12); font-size: 12px; max-width: 180px;
}
.legend-title { font-weight: 600; margin-bottom: 6px; }
#legend-list { list-style: none; margin: 0; padding: 0; }
#legend-list li { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
#legend-list .swatch { width: 14px; height: 14px; border-radius: 3px; flex: none; }

body.dark #search-input { background: #1e293b; color: #e2e8f0; border-color: #334155; }
body.dark #search-results { background: #1e293b; border-color: #334155; color: #e2e8f0; }
body.dark #search-results li:hover { background: #334155; }
body.dark #theme-toggle { background: #1e293b; color: #e2e8f0; }
body.dark #legend { background: rgba(15,23,42,.92); color: #e2e8f0; }
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: HTML shell and UI styles"
```

---

## Task 5: Инициализация карты, базовый стиль и тема (`app.js`)

**Files:**
- Create: `public/app.js`

В этой задаче карта показывает только подложку и реагирует на переключатель темы. Слои данных добавим в Task 6.

- [ ] **Step 1: Создать `public/app.js` с конфигом, загрузкой данных и стилем подложки**

```js
import { SECTOR_PALETTE, NULL_SECTOR_COLOR, buildSearchIndex, searchFilter } from './helpers.js';

const DUBAI_CENTER = [55.27, 25.20];
const DUBAI_ZOOM = 9.5;

const LEVELS = [
  { id: 'sectors',     source: 'sectors',     minzoom: 0,  maxzoom: 11 },
  { id: 'districts',   source: 'districts',   minzoom: 11, maxzoom: 13 },
  { id: 'communities', source: 'communities', minzoom: 13, maxzoom: 24 },
];

const THEMES = {
  light: {
    raster: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    line: '#64748b', lineHover: '#1d4ed8', text: '#1e293b', halo: '#ffffff',
  },
  dark: {
    raster: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    line: '#475569', lineHover: '#7dd3fc', text: '#e2e8f0', halo: '#0f172a',
  },
};

let currentTheme = 'light';
let data = null;       // {sectors, districts, communities}
let searchIndex = [];
let eventsWired = false; // обработчики hover/click вешаем один раз (addDataLayers зовётся на каждый style.load)

function fillColorExpr() {
  const expr = ['match', ['get', 'sector']];
  for (const [slug, color] of Object.entries(SECTOR_PALETTE)) expr.push(slug, color);
  expr.push(NULL_SECTOR_COLOR);
  return expr;
}

function buildStyle(theme) {
  const t = THEMES[theme];
  return {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      basemap: { type: 'raster', tiles: [t.raster], tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO' },
      sectors:     { type: 'geojson', data: data.sectors },
      districts:   { type: 'geojson', data: data.districts },
      communities: { type: 'geojson', data: data.communities },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  };
}

async function loadData() {
  const [sectors, districts, communities] = await Promise.all([
    fetch('data/sectors.geojson').then((r) => r.json()),
    fetch('data/districts.geojson').then((r) => r.json()),
    fetch('data/communities.geojson').then((r) => r.json()),
  ]);
  return { sectors, districts, communities };
}

const map = new maplibregl.Map({
  container: 'map',
  center: DUBAI_CENTER,
  zoom: DUBAI_ZOOM,
  style: { version: 8, sources: {}, layers: [] }, // плейсхолдер до загрузки данных
});
map.addControl(new maplibregl.NavigationControl(), 'bottom-left');

async function init() {
  data = await loadData();
  searchIndex = buildSearchIndex(data);
  map.setStyle(buildStyle(currentTheme));
  map.once('style.load', onStyleReady);
}

function onStyleReady() {
  // Слои данных и события добавляются здесь (Task 6+).
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.classList.toggle('dark', currentTheme === 'dark');
  document.getElementById('theme-toggle').textContent = currentTheme === 'light' ? '🌙' : '☀️';
  map.setStyle(buildStyle(currentTheme));
  map.once('style.load', onStyleReady);
});

init();
```

- [ ] **Step 2: Сгенерировать данные и запустить локальный сервер**

Run: `npm run build && npm run serve`
Expected: сервер на `http://localhost:8080`. Открой в браузере.

- [ ] **Step 3: Ручная проверка**

Открой `http://localhost:8080`. Ожидается: светлая карта Дубая (Carto Positron), элементы управления зумом снизу слева, поле поиска, кнопка темы, пустая легенда. Клик по кнопке темы переключает подложку на тёмную и обратно, иконка меняется (🌙/☀️). Консоль без ошибок (кроме, возможно, отсутствия данных-слоёв — их ещё нет). Останови сервер: Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: map init, basemap style and theme toggle"
```

---

## Task 6: Слои данных — заливка, контур, подписи, пороги зума

**Files:**
- Modify: `public/app.js` (заменить тело `onStyleReady`, добавить функции построения слоёв)

- [ ] **Step 1: Добавить функции построения слоёв** — вставить в `app.js` перед `function buildStyle`

```js
function fillLayer(lvl) {
  return {
    id: `${lvl.id}-fill`, type: 'fill', source: lvl.source,
    minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,
    paint: {
      'fill-color': fillColorExpr(),
      'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 0.18],
    },
  };
}

function lineLayer(lvl, t) {
  return {
    id: `${lvl.id}-line`, type: 'line', source: lvl.source,
    minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,
    paint: {
      'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], t.lineHover, t.line],
      'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0.8],
    },
  };
}

function labelLayer(lvl, t) {
  return {
    id: `${lvl.id}-label`, type: 'symbol', source: lvl.source,
    minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': 12,
      'text-anchor': 'center',
      // подпись ставим в заранее посчитанную точку
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': t.text,
      'text-halo-color': t.halo,
      'text-halo-width': 1.2,
      'text-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.25],
    },
  };
}

function addDataLayers() {
  const t = THEMES[currentTheme];
  for (const lvl of LEVELS) {
    map.addLayer(fillLayer(lvl));
    map.addLayer(lineLayer(lvl, t));
    map.addLayer(labelLayer(lvl, t));
  }
}
```

> Примечание: подписи берут координаты из геометрии feature, а не из `labelLng/labelLat`. Чтобы symbol-слой ставил метку в нашу точку, источники подписей строятся отдельно — см. Step 2.

- [ ] **Step 2: Добавить точечные источники для подписей** — обновить `buildStyle`, добавив три geojson-источника из точек подписи

Заменить блок `sources` в `buildStyle` на:

```js
    sources: {
      basemap: { type: 'raster', tiles: [t.raster], tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO' },
      sectors:     { type: 'geojson', data: data.sectors },
      districts:   { type: 'geojson', data: data.districts },
      communities: { type: 'geojson', data: data.communities },
      'sectors-pts':     { type: 'geojson', data: labelPoints(data.sectors) },
      'districts-pts':   { type: 'geojson', data: labelPoints(data.districts) },
      'communities-pts': { type: 'geojson', data: labelPoints(data.communities) },
    },
```

И добавить функцию (перед `buildStyle`):

```js
function labelPoints(collection) {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((f) => ({
      type: 'Feature',
      id: f.id,
      properties: { name: f.properties.name },
      geometry: { type: 'Point', coordinates: [f.properties.labelLng, f.properties.labelLat] },
    })),
  };
}
```

Затем в `labelLayer` поменять источник на точечный: `source: `${lvl.id}-pts``.

```js
function labelLayer(lvl, t) {
  return {
    id: `${lvl.id}-label`, type: 'symbol', source: `${lvl.id}-pts`,
    minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': 12,
    },
    paint: {
      'text-color': t.text,
      'text-halo-color': t.halo,
      'text-halo-width': 1.2,
      'text-opacity': 0.25,
    },
  };
}
```

> Подписи по умолчанию имеют непрозрачность 0.25. Подсветку наведённой подписи добавим в Task 7 (через отдельный слой подписи наведения, т.к. hover-состояние полигона и точки — разные источники).

- [ ] **Step 3: Вызвать `addDataLayers` в `onStyleReady`**

```js
function onStyleReady() {
  addDataLayers();
}
```

- [ ] **Step 4: Пересобрать и проверить**

Run: `npm run serve` (данные уже собраны; если нет — `npm run build` сначала)
Открой `http://localhost:8080`.
Expected:
- На старте (zoom ~9.5) видны полигоны **секторов**, окрашенные разными цветами, с бледными подписями.
- Приближение до zoom ~11–12 — секторы исчезают, появляются **районы**.
- Дальше (zoom ≥ 13) — появляются **коммьюнити**.
- Переключение темы сохраняет слои и перекрашивает контуры/подписи.
- Консоль без ошибок. Если подписи не видны вовсе — проверь, что glyphs-URL доступен (сетевой запрос к fonts.openmaptiles.org).

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: data layers with per-sector fill, outlines, faint labels and zoom thresholds"
```

---

## Task 7: Подсветка при наведении

**Files:**
- Modify: `public/app.js`

Реализуем hover через `feature-state` на полигонах + синхронную подсветку подписи. Для подписи наведения добавим дублирующий symbol-слой, показывающий только наведённую метку на полную непрозрачность.

- [ ] **Step 1: Добавить hover-слой подписи** — в `addDataLayers`, после `labelLayer`, добавить ещё один слой на тот же точечный источник, отфильтрованный по hover id

Обновить `addDataLayers`:

```js
function addDataLayers() {
  const t = THEMES[currentTheme];
  for (const lvl of LEVELS) {
    map.addLayer(fillLayer(lvl));
    map.addLayer(lineLayer(lvl, t));
    map.addLayer(labelLayer(lvl, t));
    map.addLayer(hoverLabelLayer(lvl, t));
  }
  if (!eventsWired) { wireHover(); eventsWired = true; }
}

function hoverLabelLayer(lvl, t) {
  return {
    id: `${lvl.id}-label-hover`, type: 'symbol', source: `${lvl.id}-pts`,
    minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,
    filter: ['==', ['id'], -1], // ничего, пока не наведено
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': 13,
    },
    paint: {
      'text-color': t.text,
      'text-halo-color': t.halo,
      'text-halo-width': 1.6,
      'text-opacity': 1.0,
    },
  };
}
```

- [ ] **Step 2: Добавить логику hover** — функция `wireHover` (вставить в `app.js`)

```js
let hovered = null; // {source, id}

function setHover(source, id) {
  clearHover();
  hovered = { source, id };
  map.setFeatureState({ source, id }, { hover: true });
  map.setFilter(`${source}-label-hover`, ['==', ['id'], id]);
  map.getCanvas().style.cursor = 'pointer';
}

function clearHover() {
  if (!hovered) return;
  map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
  map.setFilter(`${hovered.source}-label-hover`, ['==', ['id'], -1]);
  map.getCanvas().style.cursor = '';
  hovered = null;
}

function wireHover() {
  for (const lvl of LEVELS) {
    const fillId = `${lvl.id}-fill`;
    map.on('mousemove', fillId, (e) => {
      if (!e.features.length) return;
      const id = e.features[0].id;
      if (hovered && hovered.source === lvl.source && hovered.id === id) return;
      setHover(lvl.source, id); // lvl.id === lvl.source
    });
    map.on('mouseleave', fillId, () => clearHover());
  }
}
```

> `setHover` принимает **имя источника** (`sectors`/`districts`/`communities`); оно же в id слоя подписи (`${source}-label-hover`). Та же функция переиспользуется в поиске (Task 9) для подсветки выбранного.

- [ ] **Step 3: Проверить**

Run: `npm run serve`, открой `http://localhost:8080`.
Expected: при наведении курсора на полигон (на любом уровне) — заливка насыщается, контур становится толще/ярче, бледная подпись сменяется яркой. Уведя курсор — всё возвращается. Курсор меняется на «руку» над полигоном.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: hover highlight — fill, outline and bright label via feature-state"
```

---

## Task 8: Зум к полигону по клику

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Добавить обработчик клика** — в `wireHover` (или отдельной `wireClick`, вызываемой из `addDataLayers`) добавить клик на каждый fill-слой

Добавить функцию и вызвать её в `addDataLayers` после `wireHover()`:

```js
function wireClick() {
  for (const lvl of LEVELS) {
    map.on('click', `${lvl.id}-fill`, (e) => {
      if (!e.features.length) return;
      const bbox = e.features[0].properties.bbox;
      const parsed = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;
      flyToBbox(parsed);
    });
  }
}

function flyToBbox(bbox) {
  map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
}
```

> `bbox` в свойствах может прийти строкой (MapLibre сериализует вложенные объекты свойств) — поэтому `JSON.parse` при необходимости.

Обновить guard-блок в конце `addDataLayers`, чтобы события вешались один раз (иначе при каждом переключении темы обработчики накапливаются — баг):

```js
  if (!eventsWired) { wireHover(); wireClick(); eventsWired = true; }
```

- [ ] **Step 2: Проверить**

Run: `npm run serve`, открой `http://localhost:8080`.
Expected: клик по сектору плавно приближает карту к его границам (и переключает уровень на районы). Клик по району — приближает к нему (появляются коммьюнити). Клик по коммьюнити — приближает к нему.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: click-to-zoom (fitBounds) into polygon"
```

---

## Task 9: Поиск с автодополнением

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Добавить логику поиска** — вставить в `app.js` и вызвать `wireSearch()` из `init` (после `searchIndex = buildSearchIndex(data)`)

```js
function wireSearch() {
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  function render(results) {
    if (!results.length) { list.hidden = true; list.innerHTML = ''; return; }
    list.innerHTML = results
      .map((r, i) => `<li data-i="${i}"><span>${r.name}</span><span class="lvl">${r.level}</span></li>`)
      .join('');
    list.hidden = false;
    Array.from(list.children).forEach((li, i) => {
      li.addEventListener('click', () => {
        const r = results[i];
        const bbox = r.bbox;
        flyToBbox(typeof bbox === 'string' ? JSON.parse(bbox) : bbox);
        setHover(r.source, r.id); // временная подсветка выбранного (та же механика, что и hover)
        input.value = r.name;
        list.hidden = true;
      });
    });
  }

  input.addEventListener('input', () => render(searchFilter(searchIndex, input.value)));
  input.addEventListener('focus', () => { if (input.value) render(searchFilter(searchIndex, input.value)); });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('search-box').contains(e.target)) list.hidden = true;
  });
}
```

Обновить `init`:

```js
async function init() {
  data = await loadData();
  searchIndex = buildSearchIndex(data);
  wireSearch();
  map.setStyle(buildStyle(currentTheme));
  map.once('style.load', onStyleReady);
}
```

- [ ] **Step 2: Проверить**

Run: `npm run serve`, открой `http://localhost:8080`.
Expected: ввод «barsha» показывает выпадающий список совпадений (с пометкой уровня). Клик по пункту приближает карту к объекту **и подсвечивает его** (заливка + контур + яркая подпись, как при наведении). Клик вне поля закрывает список.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: search with autocomplete and fly-to"
```

---

## Task 10: Легенда секторов

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Добавить построение легенды** — функция `buildLegend()`, вызвать из `init` после `searchIndex = ...`

```js
function buildLegend() {
  const list = document.getElementById('legend-list');
  // slug → name из секторов
  const names = {};
  for (const f of data.sectors.features) names[f.properties.slug] = f.properties.name;
  list.innerHTML = Object.entries(SECTOR_PALETTE)
    .map(([slug, color]) =>
      `<li><span class="swatch" style="background:${color}"></span>${names[slug] || slug}</li>`)
    .join('');
}
```

Обновить `init` (добавить вызов):

```js
  searchIndex = buildSearchIndex(data);
  buildLegend();
  wireSearch();
```

- [ ] **Step 2: Проверить**

Run: `npm run serve`, открой `http://localhost:8080`.
Expected: справа снизу — легенда со списком 9 секторов и их цветами; названия совпадают с цветами на карте. На тёмной теме легенда читается (тёмный фон, светлый текст).

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: sector color legend"
```

---

## Task 11: Конфиг Netlify, README и инициализация git

**Files:**
- Create: `netlify.toml`
- Create: `README.md`

- [ ] **Step 1: Создать `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "public"

[build.environment]
  NODE_VERSION = "20"
```

- [ ] **Step 2: Создать `README.md`**

```markdown
# Dubai Areas Map

Интерактивная карта Дубая: секторы → районы → коммьюнити сменяются по зуму,
наведение подсвечивает полигон и название, есть поиск и тёмная/светлая тема.

## Стек
- MapLibre GL JS (подложка Carto), без токенов и бэкенда
- `scripts/enrich.mjs` (Turf) обогащает GeoJSON: сектор, точка подписи, bbox, id

## Локальный запуск
```bash
npm install
npm run build      # генерирует public/data/*.geojson из geojson/
npm run serve      # http://localhost:8080
npm test           # unit-тесты (enrich + helpers)
```

## Деплой (Netlify)
Подключить репозиторий — Netlify выполнит `npm run build` и опубликует `public/`.
Конфиг в `netlify.toml`.

## Данные
Исходники в `geojson/` (read-only). Чтобы обновить — заменить файлы и пересобрать.
```

- [ ] **Step 3: Прогнать полный набор тестов и финальную ручную проверку**

Run: `npm test`
Expected: все тесты (enrich + helpers) зелёные.

Run: `npm run build && npm run serve`
Expected: полностью рабочая карта — уровни по зуму, hover, клик-зум, поиск, легенда, тема. Консоль без ошибок.

- [ ] **Step 4: Инициализировать git (если ещё не сделано) и закоммитить**

```bash
git init
git add .
git commit -m "feat: Netlify config and README"
```

> Если git уже инициализирован в Task 1, опусти `git init`.

- [ ] **Step 5 (опционально): Подключить к Netlify**

Создать репозиторий на GitHub, запушить, затем в Netlify «Add new site → Import from Git». Либо `npx netlify-cli deploy --build --prod` после `npx netlify-cli login`.

---

## Self-review заметки (для исполнителя)

- **Пороги зума (11/13) и непрозрачность подписей (0.25)** — стартовые; подкрути в `LEVELS` и в paint `text-opacity`, посмотрев на реальную плотность.
- **Если у многих коммьюнити `sector = null`** (видно в выводе `npm run build`) — проверь корректность геометрии секторов/координатных систем; fallback по площади пересечения должен покрывать большинство.
- **glyphs (fonts.openmaptiles.org) — средний риск, подписи это core-фича.** Перед тем как полагаться на CDN, проверь, что fontstack реально отдаётся: `curl -sI "https://fonts.openmaptiles.org/Open%20Sans%20Regular/0-255.pbf"` → должен быть 200. Если 404/CORS — подписи молча не отрисуются. Надёжнее self-host: положить PBF в `public/glyphs/{fontstack}/{range}.pbf` и указать `glyphs: 'glyphs/{fontstack}/{range}.pbf'` (ноль внешних зависимостей). Альтернативный CDN: `https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`.
- **Плавное затухание на границах зума** (из спеки) в плане упрощено до жёстких `minzoom`/`maxzoom` — уровни переключаются чётко. Если нужен мягкий переход, заменить константу в `fill-opacity` на `interpolate` по `['zoom']` у краёв диапазона (с сохранением hover-`case`). Это улучшение, не блокер.
- **Тач-устройства:** в плане тап вызывает зум (как клик). Спека предлагала тап = показ названия без зума. Если важно — добавить ветку по `e.originalEvent.pointerType === 'touch'`: первый тап подсвечивает (setHover), второй — зумит. Опционально.
- **Палитра на тёмной теме:** план использует одну палитру `SECTOR_PALETTE` для обеих тем (легенда и карта всегда совпадают — требование синхронизации из спеки выполнено). Спека упоминала «более яркие цвета на тёмной» как пожелание — это НЕ реализовано (одна палитра). Если нужно — завести `SECTOR_PALETTE_DARK` и выбирать по `currentTheme` в `fillColorExpr()` и `buildLegend()`. Косметика, не блокер.
```

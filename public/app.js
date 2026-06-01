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
let data = null;          // {sectors, districts, communities}
let searchIndex = [];
let eventsWired = false;  // hover/click вешаем один раз (addDataLayers зовётся на каждый style.load)

function fillColorExpr() {
  const expr = ['match', ['get', 'sector']];
  for (const [slug, color] of Object.entries(SECTOR_PALETTE)) expr.push(slug, color);
  expr.push(NULL_SECTOR_COLOR);
  return expr;
}

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
      'text-opacity': 0.25, // подписи по умолчанию едва видны; яркая подпись наведения — в Task 7
    },
  };
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

function addDataLayers() {
  const t = THEMES[currentTheme];
  for (const lvl of LEVELS) {
    map.addLayer(fillLayer(lvl));
    map.addLayer(lineLayer(lvl, t));
    map.addLayer(labelLayer(lvl, t));
    map.addLayer(hoverLabelLayer(lvl, t));
  }
  // события вешаем один раз: addDataLayers вызывается на каждый style.load (в т.ч. при смене темы)
  if (!eventsWired) { wireHover(); wireClick(); eventsWired = true; }
}

function flyToBbox(bbox) {
  map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
}

function wireClick() {
  for (const lvl of LEVELS) {
    map.on('click', `${lvl.id}-fill`, (e) => {
      if (!e.features.length) return;
      const bbox = e.features[0].properties.bbox;
      // в событиях MapLibre вложенные свойства могут приходить строкой — подстрахуемся
      const parsed = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;
      flyToBbox(parsed);
    });
  }
}

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
      'sectors-pts':     { type: 'geojson', data: labelPoints(data.sectors) },
      'districts-pts':   { type: 'geojson', data: labelPoints(data.districts) },
      'communities-pts': { type: 'geojson', data: labelPoints(data.communities) },
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

// Индикатор зума (для отладки порогов уровней)
function updateZoomIndicator() {
  const z = map.getZoom();
  const lvl = LEVELS.find((l) => z >= l.minzoom && z < l.maxzoom);
  document.getElementById('zoom-indicator').textContent =
    `z ${z.toFixed(2)} · ${lvl ? lvl.id : '—'}`;
}
map.on('zoom', updateZoomIndicator);
map.on('load', updateZoomIndicator);

function wireSearch() {
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  function render(results) {
    if (!results.length) { list.hidden = true; list.innerHTML = ''; return; }
    list.innerHTML = results
      .map((r) => `<li><span>${r.name}</span><span class="lvl">${r.level}</span></li>`)
      .join('');
    list.hidden = false;
    Array.from(list.children).forEach((li, i) => {
      li.addEventListener('click', () => {
        const r = results[i];
        const bbox = typeof r.bbox === 'string' ? JSON.parse(r.bbox) : r.bbox;
        flyToBbox(bbox);
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

async function init() {
  data = await loadData();
  searchIndex = buildSearchIndex(data);
  buildLegend();
  wireSearch();
  // diff:false форсирует полную перезагрузку стиля, иначе style.load не сработает
  // повторно после setStyle на уже загруженной карте (MapLibre диффит стиль).
  map.setStyle(buildStyle(currentTheme), { diff: false });
  map.once('style.load', onStyleReady);
}

function onStyleReady() {
  addDataLayers();
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.classList.toggle('dark', currentTheme === 'dark');
  document.getElementById('theme-toggle').textContent = currentTheme === 'light' ? '🌙' : '☀️';
  // diff:false форсирует полную перезагрузку стиля, иначе style.load не сработает
  // повторно после setStyle на уже загруженной карте (MapLibre диффит стиль).
  map.setStyle(buildStyle(currentTheme), { diff: false });
  map.once('style.load', onStyleReady);
});

init();

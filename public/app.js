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

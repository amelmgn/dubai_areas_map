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

export const LEVEL_LABELS = {
  sectors: 'Секторы',
  districts: 'Дистрикты',
  communities: 'Локации',
};

export function levelLabel(id) {
  return LEVEL_LABELS[id] || id;
}

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

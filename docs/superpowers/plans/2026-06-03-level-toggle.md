# Level Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace zoom-banded level switching with a manual 3-mode toggle (Секторы / Дистрикты / Локации) that shows the chosen entity at all zoom levels.

**Architecture:** Add a pure helper (`LEVEL_LABELS` + `levelLabel`) in `public/helpers.js` for id→label mapping (unit-tested, following the existing helpers test pattern). In `public/app.js`, drop `minzoom`/`maxzoom` banding, add an `activeLevel` state plus `setActiveLevel()` that toggles each level's four layers via `layout.visibility`, and wire a segmented control built in `public/index.html` / `public/style.css`. Search-result selection auto-switches the active level. The MapLibre/DOM wiring is verified manually in the browser (no DOM test harness exists).

**Tech Stack:** Vanilla ES modules, MapLibre GL (CDN), Node `node:test` for the pure helper.

---

## File Structure

- `public/helpers.js` — add `LEVEL_LABELS` map and `levelLabel(id)` pure helper (the only unit-testable new logic).
- `test/helpers.test.mjs` — add tests for `levelLabel`.
- `public/index.html` — add the segmented control markup; update zoom-indicator (no markup change needed there).
- `public/style.css` — styles for the segmented control (light + dark).
- `public/app.js` — remove zoom banding, add `activeLevel` + `setActiveLevel()`, wire control + search auto-switch, rewrite `updateZoomIndicator`.
- `CHANGELOG.md` — user-facing entry.

---

### Task 1: Pure helper `levelLabel` in helpers.js

**Files:**
- Modify: `public/helpers.js`
- Test: `test/helpers.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to the end of `test/helpers.test.mjs`:

```js
import { LEVEL_LABELS, levelLabel } from '../public/helpers.js';

test('LEVEL_LABELS: три уровня с русскими подписями', () => {
  assert.deepEqual(LEVEL_LABELS, {
    sectors: 'Секторы',
    districts: 'Дистрикты',
    communities: 'Локации',
  });
});

test('levelLabel: известный id → подпись', () => {
  assert.equal(levelLabel('communities'), 'Локации');
});

test('levelLabel: неизвестный id → сам id', () => {
  assert.equal(levelLabel('xxx'), 'xxx');
});
```

Note: the existing import line at the top of the file imports from `../public/helpers.js`; adding a second `import` statement for the new symbols is fine in ESM. Alternatively extend the existing top-of-file import — either works.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/helpers.test.mjs`
Expected: FAIL — `LEVEL_LABELS`/`levelLabel` are not exported (`undefined`).

- [ ] **Step 3: Implement the helper**

Add to `public/helpers.js` (after `NULL_SECTOR_COLOR`):

```js
export const LEVEL_LABELS = {
  sectors: 'Секторы',
  districts: 'Дистрикты',
  communities: 'Локации',
};

export function levelLabel(id) {
  return LEVEL_LABELS[id] || id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/helpers.test.mjs`
Expected: PASS (all tests, new and old).

- [ ] **Step 5: Commit**

```bash
git add public/helpers.js test/helpers.test.mjs
git commit -m "feat: add levelLabel helper for level toggle labels"
```

---

### Task 2: Segmented control markup + styles

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`

- [ ] **Step 1: Add the control markup**

In `public/index.html`, after the `<div id="map"></div>` line and before `#search-box`, add:

```html
  <div id="level-toggle" role="group" aria-label="Уровень детализации">
    <button type="button" data-level="sectors">Секторы</button>
    <button type="button" data-level="districts">Дистрикты</button>
    <button type="button" data-level="communities" class="active">Локации</button>
  </div>
```

(`communities` starts with `class="active"` to match the default mode; `app.js` will also enforce it.)

- [ ] **Step 2: Add styles**

Append to `public/style.css`:

```css
#level-toggle {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2;
  display: flex; background: #fff; border-radius: 8px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
}
#level-toggle button {
  border: none; background: transparent; cursor: pointer;
  padding: 10px 16px; font-size: 14px; color: #1e293b;
  border-left: 1px solid #e2e8f0;
}
#level-toggle button:first-child { border-left: none; }
#level-toggle button:hover { background: #f1f5f9; }
#level-toggle button.active { background: #2563eb; color: #fff; }

body.dark #level-toggle { background: #1e293b; }
body.dark #level-toggle button { color: #e2e8f0; border-left-color: #334155; }
body.dark #level-toggle button:hover { background: #334155; }
body.dark #level-toggle button.active { background: #2563eb; color: #fff; }
```

- [ ] **Step 3: Verify markup loads (no JS wiring yet)**

Run: `npm run build && npm run serve`
Open `http://localhost:8080`. Expected: a segmented control appears top-center with "Локации" highlighted. Buttons do nothing yet (wired in Task 3). Theme toggle still restyles it.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: add level toggle segmented control markup and styles"
```

---

### Task 3: Remove zoom banding, add activeLevel + setActiveLevel

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Drop zoom banding from LEVELS**

Replace `LEVELS` (`public/app.js:6-10`) with:

```js
const LEVELS = [
  { id: 'sectors',     source: 'sectors' },
  { id: 'districts',   source: 'districts' },
  { id: 'communities', source: 'communities' },
];

const DEFAULT_LEVEL = 'communities';
```

- [ ] **Step 2: Remove minzoom/maxzoom from the four layer factories**

In `fillLayer`, `lineLayer`, `labelLayer`, `hoverLabelLayer` (`public/app.js:48-105`), delete the `minzoom: lvl.minzoom, maxzoom: lvl.maxzoom,` line from each (4 deletions). Leave everything else unchanged. Layers then default to the full zoom range.

- [ ] **Step 3: Add activeLevel state and import levelLabel**

Update the import at `public/app.js:1` to include `levelLabel`:

```js
import { SECTOR_PALETTE, NULL_SECTOR_COLOR, buildSearchIndex, searchFilter, levelLabel } from './helpers.js';
```

Add near the other state vars (after `let eventsWired = ...`, ~`public/app.js:27`):

```js
let activeLevel = DEFAULT_LEVEL; // какой уровень показываем (переключатель, не зум)
```

- [ ] **Step 4: Add setActiveLevel**

Add this function (place it just after `addDataLayers`, ~`public/app.js:117`):

```js
function setActiveLevel(id) {
  activeLevel = id;
  for (const lvl of LEVELS) {
    const vis = lvl.id === id ? 'visible' : 'none';
    for (const suffix of ['fill', 'line', 'label', 'label-hover']) {
      map.setLayoutProperty(`${lvl.id}-${suffix}`, 'visibility', vis);
    }
  }
  clearHover(); // подсветка не должна «зависать» на скрытом слое
  for (const btn of document.querySelectorAll('#level-toggle button')) {
    btn.classList.toggle('active', btn.dataset.level === id);
  }
  updateZoomIndicator();
}
```

- [ ] **Step 5: Apply activeLevel after layers are (re)added**

In `addDataLayers` (`public/app.js:107-117`), add `setActiveLevel(activeLevel);` as the last line of the function (after the events-wired block), so visibility is reasserted on every `style.load` (incl. theme switch, which recreates layers with default `visible`).

- [ ] **Step 6: Wire the toggle buttons (once)**

Add a wiring function:

```js
function wireLevelToggle() {
  for (const btn of document.querySelectorAll('#level-toggle button')) {
    btn.addEventListener('click', () => setActiveLevel(btn.dataset.level));
  }
}
```

Call it in `init()` alongside `wireSearch()` (`public/app.js:255`):

```js
  buildLegend();
  wireSearch();
  wireLevelToggle();
```

- [ ] **Step 7: Rewrite the zoom indicator**

Replace `updateZoomIndicator` (`public/app.js:202-207`) with:

```js
function updateZoomIndicator() {
  const z = map.getZoom();
  document.getElementById('zoom-indicator').textContent =
    `z ${z.toFixed(2)} · ${levelLabel(activeLevel)}`;
}
```

- [ ] **Step 8: Verify in the browser**

Run: `npm run build && npm run serve`
Open `http://localhost:8080`. Expected:
- On load: only Локации visible, at any zoom (zoom in/out — stays communities); indicator shows `z … · Локации`.
- Click Секторы / Дистрикты: visible level and highlighted button change; indicator updates.
- Hover works on the active level; no stale highlight after switching.

- [ ] **Step 9: Verify unit tests still pass**

Run: `npm test`
Expected: PASS (helpers/enrich unchanged in behavior).

- [ ] **Step 10: Commit**

```bash
git add public/app.js
git commit -m "feat: manual level toggle replaces zoom banding"
```

---

### Task 4: Search auto-switches active level

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add setActiveLevel to search-result click**

In `wireSearch`'s result click handler (`public/app.js:222-229`), add a `setActiveLevel(r.source)` call before `setHover`, so the selected result's level becomes visible:

```js
      li.addEventListener('click', () => {
        const r = results[i];
        const bbox = typeof r.bbox === 'string' ? JSON.parse(r.bbox) : r.bbox;
        setActiveLevel(r.source); // переключаем уровень на уровень результата
        flyToBbox(bbox);
        setHover(r.source, r.id); // временная подсветка выбранного (та же механика, что и hover)
        input.value = r.name;
        list.hidden = true;
      });
```

`r.source` is already one of `sectors` / `districts` / `communities` (see `buildSearchIndex`), so it maps directly to a level id.

- [ ] **Step 2: Verify in the browser**

Run: `npm run serve` (build still current from Task 3)
Open `http://localhost:8080`. With Секторы active, search a community (e.g. "Barsha") and click it. Expected: mode switches to Локации, map flies to it, and the object is highlighted (visible, not hidden).

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: search result selection switches active level"
```

---

### Task 5: Changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry**

Open `CHANGELOG.md` and add an entry under an `Unreleased` (or the current working) section, Keep a Changelog format, e.g.:

```markdown
### Changed
- Переключение уровней (секторы/дистрикты/локации) теперь ручное через переключатель
  сверху по центру вместо автоматической смены по зуму; выбранный уровень виден на
  всех зумах. По умолчанию — локации. Выбор результата поиска переключает уровень.
```

Match the existing section/version style in the file (read it first to follow the established format).

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for manual level toggle"
```

---

## Self-Review Notes

- **Spec coverage:** behavior/full-replacement → Task 3 (steps 1-2, 5); state/`activeLevel` → Task 3 (step 3); `setActiveLevel` (visibility + clearHover + active button) → Task 3 (step 4); UI segmented control top-center → Task 2; default = Локации → Task 2 markup + `DEFAULT_LEVEL`; style.load integration → Task 3 (step 5); search auto-switch (variant а) → Task 4; zoom indicator rewrite → Task 3 (step 7); legend/helpers untouched → respected; testing → Task 1 (pure helper) + manual browser steps; changelog → Task 5. All covered.
- **Placeholders:** none — all code shown.
- **Type consistency:** layer ids `${lvl.id}-fill|line|label|label-hover` match the factory ids in app.js; `setActiveLevel`, `levelLabel`, `activeLevel`, `DEFAULT_LEVEL` used consistently across tasks.
```

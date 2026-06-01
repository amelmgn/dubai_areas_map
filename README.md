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

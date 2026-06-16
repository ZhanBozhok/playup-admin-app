# playup-admin-app

Админка PlayUp + общий backend/API (Next.js App Router + Prisma + PostgreSQL).
Backend живёт здесь же (`src/app/api`) и обслуживает и админку, и клиентскую mini app.

Спецификация — в репозитории `playup-docs`. Эта кодовая база реализует **Итерацию 0
(Фундамент)** из `26_build_roadmap.md`.

## Что готово в Итерации 0

- Схема БД по `14_database_schema_mvp.md` (17 таблиц, индексы, партиальный unique
  для активных bookings, CHECK-констрейнты) — `prisma/schema.prisma` + `prisma/sql/extra_constraints.sql`.
- Seed по `14`/`23` (админы, кассы, категории, площадки, хосты, 2 события).
- Авторизация админа email/password → JWT (`18`): `POST /api/admin/auth/login`.
- Telegram auth + find-or-create User (`13`, `17` Flow 1): `POST /api/client/auth/telegram`.
- Каркас админки: логин + меню по `15`; дизайн-токены из `25`.
- `GET /api/health` — проверка БД.

## Требования

- Node 20+, PostgreSQL 14+ (или Docker).

## Запуск

```bash
cp .env.example .env          # при необходимости поправь DATABASE_URL

# Вариант A: локальный Postgres (по умолчанию в .env — localhost:5432)
createdb playup_dev           # если базы ещё нет

# Вариант B: Postgres в Docker (порт 5433) — тогда в .env укажи localhost:5433
# docker compose up -d

npm install
npm run db:setup              # prisma db push + extra_constraints.sql + seed
npm run dev                   # http://localhost:3001
```

Логин админа после seed: `owner@playup.club` / `admin@playup.club`, пароль `playup12345`.

## Скрипты

- `npm run dev` — dev-сервер (порт 3001)
- `npm run db:setup` — схема + констрейнты + seed
- `npm run db:push` / `db:constraints` / `db:seed` — по отдельности
- `npm run typecheck` — проверка типов

## Заметки

- Все записи идут через Prisma, который проставляет `id`/`created_at`/`updated_at`.
  `id` имеет DB-дефолт `gen_random_uuid()`; `updated_at` обновляется на стороне
  приложения (raw SQL insert требует явных значений).
- `TELEGRAM_AUTH_DEV=true` (только dev) позволяет авторизоваться без реального бота;
  в проде нужен `TELEGRAM_BOT_TOKEN` и строгая проверка подписи init data.

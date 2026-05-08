# ai-text-connect (backend)

Fastify + TypeScript бэкенд для STT-транскрибации и постпроцесса (пунктуация/абзацы/списки/удаление филлеров).

## Документация

- `docs/backend-contract.md` — API контракт для фронтенда

## Требования

- Node.js **20+**
- Docker (рекомендуется) — для Postgres + Redis локально

## Локальный запуск

1) Поднять зависимости (Postgres + Redis):

```bash
docker compose up -d
```

2) Настроить env:

```bash
cp .env.example .env
```

3) Установить зависимости и применить миграции:

```bash
npm i
npm run prisma:generate
npm run prisma:migrate
```

4) Запустить API:

```bash
npm run dev
```

## Переменные окружения

Базовые (см. `.env.example`):

- `HOST`, `PORT` — где слушает API
- `DATABASE_URL` — Postgres для Prisma
- `REDIS_URL` — Redis для очередей/фоновых задач

Провайдеры:

- **STT (Yandex SpeechKit)**: `YANDEX_FOLDER_ID` + один из `YANDEX_IAM_TOKEN` / `YANDEX_API_KEY`
  - если креды не заданы, используется `mock`-провайдер (полезно для локальной разработки UI)
- **LLM post-process**:
  - `LLM_PROVIDER=mock` — по умолчанию (без внешних запросов)
  - для YandexGPT: `YANDEX_GPT_ENDPOINT`, `YANDEX_GPT_MODEL_URI` + соответствующие секреты

## Полезные урлы

- `GET /healthz`
- `GET /docs` (Swagger UI)

## Скрипты

- `npm run dev` — dev-сервер (watch)
- `npm run build` / `npm run start` — сборка и запуск из `dist/`
- `npm run prisma:migrate` — Prisma migrate dev
- `npm run db:push` — Prisma db push (быстро для прототипов, без миграций)


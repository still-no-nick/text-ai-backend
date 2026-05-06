# ai-text-connect (backend)

Fastify + TypeScript бэкенд для STT-транскрибации и постпроцесса (пунктуация/абзацы/списки/удаление филлеров).

## Документация

- `docs/backend-contract.md` — API контракт для фронтенда

## Локальный запуск

1) Поднять зависимости:

```bash
docker compose up -d
```

2) Настроить env:

```bash
cp .env.example .env
```

3) Установить зависимости и применить схему БД:

```bash
npm i
npm run prisma:generate
npm run prisma:migrate
```

4) Запустить API:

```bash
npm run dev
```

## Полезные урлы

- `GET /healthz`
- `GET /docs` (Swagger UI)


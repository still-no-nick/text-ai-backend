# Backend API Contract

Этот документ — контракт между фронтом и бэкендом для STT + постпроцесса (пунктуация/абзацы/списки/удаление филлеров).

Источник: `text-ai/docs/backend-contract.md` (скопировано без изменений по сути, чтобы контракт жил рядом с кодом бэкенда).

## Цель

Обеспечить серверную транскрибацию аудио и LLM-постпроцесс текста для качества «как у Wispr Flow»:

- Запятые, точки, абзацы
- Списки (нумерованные и маркированные)
- Удаление филлеров («э», «мэ», «ну», паузы)
- Автоматическое форматирование по контексту

Фронтенд использует Web Speech API как MVP-заглушку; настоящая транскрибация и обработка — на бэкенде.

---

## Эндпоинты

### 0. `POST /api/stt/transcriptions`

Загрузить записанное приложением аудио и запустить распознавание в Yandex SpeechKit.

Текущая реализация поддерживает два режима:

- `mode=sync|auto` — распознавание выполняется синхронно и ответ сразу содержит текст
- `mode=async` — ответ возвращается сразу со статусом `processing`, а распознавание продолжается в фоне; результат доступен через `GET /api/stt/transcriptions/:id`

**Request (multipart/form-data):**

- `file` (required) — аудио-файл (MVP: рекомендуются `audio/wav` или `audio/ogg`)
- `language` (optional, default: `"ru-RU"`) — BCP-47 (`ru-RU`, `en-US`, ...)
- `mode` (optional, default: `"auto"`) — `"auto" | "sync" | "async"`
- `postProcess` (optional, default: `true`) — прогонять ли результат через `/api/post-process`
- `style` (optional, default: `"chat"`) — `"chat" | "doc"` (передаётся в `/api/post-process`)
- `kind` (optional, default: `"beautify"`) — `"beautify" | "expand" | "compress"` (передаётся в `/api/post-process`)

**Response (sync, когда удалось распознать сразу):**

```json
{
  "id": "uuid-v4",
  "status": "done",
  "language": "ru-RU",
  "textRaw": "сырой текст",
  "text": "Сырой текст.",
  "provider": "yandex_speechkit",
  "providerMeta": {
    "format": "lpcm",
    "httpStatus": 200
  }
}
```

`text` — опционален и присутствует только если включён `postProcess=true`. Если постпроцесс выключен, используйте `textRaw` (или `text ?? textRaw`).

**Response (async, если распознавание запущено задачей):**

```json
{
  "id": "uuid-v4",
  "status": "processing",
  "language": "ru-RU",
  "provider": "yandex_speechkit"
}
```

Примечания:

- `provider` сейчас может быть `"yandex_speechkit"` (если настроены креды) или `"mock_stt"` (если не настроены).
- `providerMeta` — произвольный объект. Для `"yandex_speechkit"` сейчас возвращается минимум `{ "format": "lpcm" | "oggopus", "httpStatus": number }`.

**Status codes:**

- `201 Created` — запрос принят (sync или async)
- `400 Bad Request` — невалидные параметры / отсутствует `file`
- `401 Unauthorized` — нет токена пользователя (если у вас есть пользовательская авторизация)
- `413 Payload Too Large` — файл слишком большой для текущего sync-пути распознавания (лимит ~25MB у провайдера)
- `415 Unsupported Media Type` — неподдерживаемый `Content-Type` (например `audio/webm`) или невалидный WAV/не-PCM WAV
- `429 Too Many Requests` — лимиты превышены
- `502 Bad Gateway` — ошибка провайдера STT

**Поддерживаемые форматы (MVP):**

- `audio/wav` / `audio/x-wav` — WAV контейнер с PCM внутри
- `audio/ogg` — OGG/Opus

`audio/webm` (WebM/Opus) пока **не поддержан** без транскодинга и будет возвращать `415`.

---

### 0.1 `GET /api/stt/transcriptions/:id`

Получить статус и результат распознавания.

**Response (processing):**

```json
{
  "id": "uuid-v4",
  "status": "processing"
}
```

**Response (done):**

```json
{
  "id": "uuid-v4",
  "status": "done",
  "language": "ru-RU",
  "textRaw": "сырой текст",
  "text": "Сырой текст.",
  "provider": "yandex_speechkit",
  "providerMeta": {
    "requestId": "string"
  }
}
```

**Response (failed):**

```json
{
  "id": "uuid-v4",
  "status": "failed",
  "error": {
    "code": "PROVIDER_STT_FAILED",
    "message": "SpeechKit error: ...",
    "retryable": true
  }
}
```

**Status codes:**

- `200 OK`
- `404 Not Found` — неизвестный `id`

---

### 1. `POST /api/sessions`

Создать сессию записи (WebSocket-транскрибации).

**Request:**

```json
{
  "language": "ru-RU"
}
```

**Response:**

```json
{
  "sessionId": "string",
  "wsUrl": "ws://<host>:<port>/api/transcribe?sessionId=...&language=ru-RU"
}
```

`sessionId` — строка (сейчас генерируется как `nanoid`, не UUID).

**Status codes:**

- `201 Created` — сессия создана
- `401 Unauthorized` — нет токена или истёк
- `429 Too Many Requests` — лимит сессий превышен

---

### 2. `WS /api/transcribe?sessionId=<string>&language=<bcp47>`

Стрим транскрибации в реальном времени.

**Статус реализации:** сейчас endpoint существует как заглушка и всегда отправляет
`{ "type": "error", "code": "NOT_IMPLEMENTED", ... }`, после чего закрывает соединение.

**Client → Server (audio chunk):**

```json
{
  "type": "audio",
  "chunk": "<base64-encoded PCM/Opus>",
  "format": "opus",
  "sampleRate": 48000
}
```

**Server → Client (partial result):**

```json
{
  "type": "partial",
  "text": "это промежуточный результат",
  "ts": 1234567890
}
```

**Server → Client (final result):**

```json
{
  "type": "final",
  "text": "Это финальный результат.",
  "ts": 1234567891
}
```

**Server → Client (error):**

```json
{
  "type": "error",
  "code": "TRANSCRIPTION_FAILED",
  "message": "Provider timeout"
}
```

**Notes:**

- Формат аудио: PCM 16 kHz / Opus 48 kHz, mono
- Чанки ~100–200 мс рекомендуется
- Partial results отдаются каждые ~0.5–1s для real-time ощущения
- Final results — после паузы или явной границы фразы
- WS закрывается клиентом, сервер удаляет буферы через 30s inactivity

---

### 3. `POST /api/post-process`

LLM-постпроцесс сырого текста (пунктуация, абзацы, списки, удаление филлеров).

**Request:**

```json
{
  "text": "сырой текст без пунктуации э ну типа",
  "language": "ru",
  "style": "chat",
  "kind": "beautify"
}
```

**Response:**

```json
{
  "text": "Сырой текст без пунктуации, типа."
}
```

**Parameters:**

- `text` (string, required) — сырой транскрибированный текст
- `language` (string, optional, default: `"ru"`) — ISO код языка
- `style` (`"chat" | "doc"`, optional, default: `"chat"`) — стиль оформления:
  - `"chat"` — короткие предложения, разговорный стиль
  - `"doc"` — абзацы, списки, заголовки при наличии структуры
- `kind` (`"beautify" | "expand" | "compress"`, optional, default: `"beautify"`) — режим преобразования:
  - `"beautify"` — орфография/пунктуация без изменения смысла
  - `"expand"` — расширение по смыслу с перефразированием (не добавлять факты)
  - `"compress"` — сжатие, чтобы оставить суть (не терять ключевые мысли)

**Status codes:**

- `200 OK` — текст обработан
- `400 Bad Request` — пустой `text` или невалидные параметры
- `401 Unauthorized`
- `500 Internal Server Error` — LLM timeout/failure


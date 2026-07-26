# TeleGallery API Reference

Base URL: `http://localhost:4000` (dev) — all endpoints except `/auth/login` and
`/auth/verify` require the `telegallery_session` cookie set by a successful login.

## Auth

### `POST /auth/login`
Send an OTP to a phone number and start a login flow.
```json
// Request
{ "phone": "+15551234567" }
// Response
{ "loginToken": "uuid" }
```

### `POST /auth/verify`
Verify the OTP, and if needed, the 2FA cloud password.
```json
// Request (code step)
{ "loginToken": "uuid", "code": "12345" }
// Response if 2FA is enabled
{ "requires2FA": true, "loginToken": "uuid" }
// Request (password step)
{ "loginToken": "uuid", "password": "..." }
// Response on success
{ "success": true, "user": { "id": "...", "phone": "+15551234567" } }
```

### `GET /auth/me`
Returns the currently authenticated user.

### `POST /auth/logout`
Clears the session cookie.

## Files

| Method | Path | Description |
|---|---|---|
| POST | `/files/upload` | multipart `file` field; uploads to Telegram + records metadata |
| GET | `/files` | list/search — query params: `page`, `pageSize`, `kind`, `favorite`, `trashed`, `q`, `minSize`, `maxSize`, `from`, `to` |
| GET | `/files/:id/download` | proxies original bytes from Telegram |
| GET | `/files/:id/thumbnail` | proxies the compressed thumbnail |
| PATCH | `/files/:id/favorite` | toggles favorite |
| DELETE | `/files/:id` | moves to trash (soft delete) |
| POST | `/files/:id/restore` | restores from trash |
| DELETE | `/files/:id/permanent?purgeTelegram=true\|false` | permanently deletes the DB record, optionally also deleting the Telegram messages |

## Albums

| Method | Path | Description |
|---|---|---|
| GET | `/albums` | list albums with file counts |
| POST | `/albums` | `{ "name": "..." }` |
| GET | `/albums/:id` | album detail with files |
| POST | `/albums/:id/files` | `{ "fileIds": ["..."] }` — virtual link, no Telegram duplication |
| DELETE | `/albums/:id/files/:fileId` | unlink a file from the album |
| DELETE | `/albums/:id` | delete the album (files are untouched) |

## Stats

`GET /stats` — total files, storage used, counts by kind, uploads this month, largest files, recent uploads.

## Settings

- `GET /settings`
- `PATCH /settings` — any of `theme`, `accentColor`, `uploadQuality`, `autoCompress`, `thumbnailMaxWidth`

## Error format

All errors return `{ "error": "message" }` with an appropriate HTTP status code.

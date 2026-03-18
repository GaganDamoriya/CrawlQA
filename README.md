# UI QA Tool — POC

An AI-powered UI QA tool (foundation). Takes a website URL, crawls it with Playwright, captures full-page screenshots, and extracts visible text and links.

> AI analysis layer is not included yet — this is the crawler foundation only.

---

## Project Structure

```
/
├── backend/          # NestJS + Playwright crawler (port 3001)
│   ├── src/
│   │   ├── crawler/
│   │   │   ├── crawler.module.ts
│   │   │   ├── crawler.service.ts   # core crawl logic
│   │   │   └── crawler.controller.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── screenshots/  # saved screenshots (auto-created)
└── frontend/         # Next.js App Router UI (port 3000)
    └── app/
        └── page.tsx  # URL input + results display
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Backend

```bash
cd backend
npm install
npx playwright install chromium
npm run start:dev
```

Backend runs at `http://localhost:3001`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Usage

1. Open `http://localhost:3000`
2. Enter a URL (e.g. `https://example.com`)
3. Click **Scan Website**
4. View crawl results — each page shows its title, URL, link count, and raw JSON

Screenshots are saved to `backend/screenshots/`.

---

## API

### `POST /crawl`

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "pages": [
    {
      "url": "https://example.com",
      "title": "Example Domain",
      "screenshotPath": "/path/to/screenshots/example-com-0-1234567890.png",
      "text": "Visible page text (up to 5000 chars)...",
      "links": ["https://example.com/about", "https://example.com/contact"]
    }
  ]
}
```

Crawls the homepage + up to 2 internal links (max 3 pages total).

---

## Crawler Behavior

| Detail | Value |
|--------|-------|
| Browser | Chromium (headless) |
| Max pages | 3 (homepage + 2 internal links) |
| Page timeout | 15 seconds |
| Text limit | 5,000 characters per page |
| Screenshot | Full-page PNG |
| Link filter | Same-domain only, no `mailto:`/`tel:`/`javascript:` |
| Deduplication | Normalized URLs tracked in a `Set` |

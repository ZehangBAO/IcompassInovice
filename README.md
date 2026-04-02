# IcompassInvoice

A lightweight invoice generator built with Node.js, Express, EJS, and PDFKit. It renders invoice previews in the browser and exports downloadable PDF invoices without needing Python, Flask, or a DOCX template pipeline.

## Features

- Invoice form for sender, recipient, dates, tax, discount, and notes
- Dynamic line items with live total calculation
- Browser preview in a new tab
- PDF download generated on the server
- Multi-currency support: USD, EUR, GBP, CNY, JPY, AUD, CAD
- Render-ready deployment with Blueprint support

## Tech Stack

- Runtime: Node.js
- Framework: Express 5
- Templates: EJS
- PDF generation: PDFKit

## Local Development

### Prerequisites

- Node.js 18 or newer

### Install

```bash
npm install
```

### Run

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

### Test

```bash
npm test
```

## Deploy To Render

This repository is already set up for Render as a Node web service.

### Option 1: Use `render.yaml`

1. Push this repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select the repository.
4. Render will read `render.yaml` and create the service automatically.

### Option 2: Manual Web Service Setup

- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

Render will inject `PORT` automatically, and `server.js` already listens on `process.env.PORT || 3000`.

### Health Check

Use:

```txt
/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "IcompassInvoice",
  "timestamp": "2026-04-02T00:00:00.000Z"
}
```

## Project Structure

```txt
IcompassInvoice/
├── public/
│   ├── css/styles.css
│   └── js/main.js
├── views/
│   ├── index.ejs
│   └── invoice.ejs
├── render.yaml
├── server.js
├── test.js
└── package.json
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Invoice creation form |
| GET | `/health` | Render health check |
| POST | `/preview` | Render invoice preview HTML |
| POST | `/pdf` | Download invoice as PDF |

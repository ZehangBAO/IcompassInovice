# IcompassInvoice

A lightweight, browser-based invoice generation web application built with Node.js and Express.

## Features

- 📝 **Invoice form** – fill in sender/recipient details, line items, tax rate and discount
- 👁️ **Live preview** – see a fully-rendered HTML invoice in a new tab before downloading
- 📄 **PDF download** – generate a professional, styled PDF invoice with one click
- 💱 **Multi-currency** – USD, EUR, GBP, CNY, JPY, AUD, CAD
- 🧮 **Auto-totals** – subtotal, tax and discount calculated in real time

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Templating**: EJS
- **PDF generation**: PDFKit

## Getting Started

### Prerequisites

- Node.js ≥ 18

### Installation

```bash
npm install
```

### Running the server

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Running tests

```bash
npm test
```

## Project Structure

```
IcompassInvoice/
├── server.js          # Express application & routes
├── views/
│   ├── index.ejs      # Invoice creation form
│   └── invoice.ejs    # Invoice preview template
├── public/
│   ├── css/styles.css # Stylesheet
│   └── js/main.js     # Client-side totals calculator
├── test.js            # Node built-in test suite
└── package.json
```

## Routes

| Method | Path       | Description                              |
|--------|------------|------------------------------------------|
| GET    | `/`        | Invoice creation form                    |
| POST   | `/preview` | Render invoice as HTML (opens new tab)   |
| POST   | `/pdf`     | Download invoice as PDF                  |

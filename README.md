# IcompassInvoice

A Flask invoice API that downloads a DOCX template, fills it with JSON data, and returns a downloadable `.docx` invoice. This version is designed for custom internal templates and Lark file URLs.

## Project Structure

```txt
invoice-app/
├── app.py
├── requirements.txt
├── Dockerfile
├── render.yaml
└── output/          # created automatically
```

## Features

- Downloads a DOCX template from `template_url`
- Renders invoice fields with `docxtpl`
- Returns a download link for the generated file
- Supports custom template fields such as `senderName`, `senderAddress`, `items`, and more
- Ready for Render with either `Docker` or `Python 3`

## How Context Works

Every JSON field except `template_url` is passed into the DOCX template context.

That means these all work directly in your template:

```json
{
  "invoice_no": "INV-001",
  "customer_name": "Acme Pte Ltd",
  "senderName": "My Company",
  "senderAddress": "123 Main St",
  "senderEmail": "me@example.com",
  "senderPhone": "+1 555 111 2222",
  "notes": "Thank you",
  "template_url": "https://example.com/template.docx"
}
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Basic status page |
| GET | `/health` | Health check for Render |
| POST | `/generate-invoice` | Download template, render DOCX, return download URL |
| GET | `/download/<invoice_no>` | Download the generated DOCX |

## Local Run

```bash
pip install -r requirements.txt
gunicorn app:app
```

## Deploy To Render

### Option 1: Docker

- Language: `Docker`
- Branch: `main`
- Root Directory: leave blank

Render will use the included `Dockerfile`.

### Option 2: Python 3

- Language: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`

### Health Check

Use:

```txt
/health
```

## Lark Automation JSON

```json
{
  "invoice_no": "{{invoice_no}}",
  "customer_name": "{{customer_name}}",
  "date": "{{date}}",
  "amount": "{{amount}}",
  "notes": "{{notes}}",
  "template_url": "{{template[0].url}}"
}
```

If your internal template uses more fields, just add them to the JSON. Example:

```json
{
  "invoice_no": "{{invoice_no}}",
  "senderName": "{{sender_name}}",
  "senderAddress": "{{sender_address}}",
  "senderEmail": "{{sender_email}}",
  "senderPhone": "{{sender_phone}}",
  "template_url": "{{template[0].url}}"
}
```

## Example Word Template

```txt
INVOICE

Invoice No: {{ invoice_no }}
Customer: {{ customer_name }}
Date: {{ date }}

Amount: SGD {{ amount }}

Notes:
{{ notes }}

Thank you for your business.
```

You can also use custom placeholders like:

```txt
From: {{ senderName }}
Address: {{ senderAddress }}
Email: {{ senderEmail }}
Phone: {{ senderPhone }}
```

## Important Note

Generated files are stored in the service container's local filesystem. On Render this is not permanent storage, so generated invoices can disappear after redeploys or restarts.

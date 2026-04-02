'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// We test the parseInvoiceBody and helper logic by loading server.js through a
// lightweight approach: extract the pure logic into a testable surface.
// Since parseInvoiceBody is not exported, we test the HTTP API layer instead.

const http = require('node:http');
const { once } = require('node:events');

let server;
let port;

// Start the server before tests
test('server starts', async (t) => {
  const app = require('./server');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  assert.ok(port > 0, 'server should bind to a port');
});

test('GET / returns 200 with invoice form', async (t) => {
  const res = await fetch(`http://localhost:${port}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Create Invoice'), 'page should contain form title');
  assert.ok(html.includes('invoiceNumber'), 'page should contain invoice number field');
});

test('POST /preview returns 200 with invoice HTML', async (t) => {
  const body = new URLSearchParams({
    invoiceNumber: 'TEST-001',
    invoiceDate: '2026-01-15',
    dueDate: '2026-02-15',
    currency: 'USD',
    senderName: 'Acme Corp',
    senderAddress: '1 Main St',
    senderEmail: 'acme@example.com',
    senderPhone: '555-1234',
    recipientName: 'Client Inc',
    recipientAddress: '2 Client Ave',
    recipientEmail: 'client@example.com',
    recipientPhone: '555-5678',
    'itemDescription': 'Consulting Services',
    'itemQuantity': '10',
    'itemUnitPrice': '150',
    taxRate: '10',
    discount: '50',
    notes: 'Payment due within 30 days',
  });

  const res = await fetch(`http://localhost:${port}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('TEST-001'), 'invoice number should appear in preview');
  assert.ok(html.includes('Acme Corp'), 'sender name should appear');
  assert.ok(html.includes('Client Inc'), 'recipient name should appear');
  assert.ok(html.includes('Consulting Services'), 'item description should appear');
  assert.ok(html.includes('1,600.00') || html.includes('1600.00'), 'total should appear');
});

test('POST /pdf returns PDF content-type', async (t) => {
  const body = new URLSearchParams({
    invoiceNumber: 'PDF-001',
    invoiceDate: '2026-01-15',
    currency: 'USD',
    senderName: 'Test Corp',
    recipientName: 'Test Client',
    'itemDescription': 'Widget',
    'itemQuantity': '2',
    'itemUnitPrice': '25.00',
    taxRate: '0',
    discount: '0',
  });

  const res = await fetch(`http://localhost:${port}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  assert.equal(res.status, 200);
  assert.ok(
    res.headers.get('content-type').includes('application/pdf'),
    'response should be a PDF'
  );
  assert.ok(
    res.headers.get('content-disposition').includes('PDF-001'),
    'filename should include invoice number'
  );
});

// Stop server after all tests
test('server stops', async (t) => {
  await new Promise((resolve) => server.close(resolve));
});

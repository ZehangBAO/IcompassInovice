'use strict';

const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Home - show invoice creation form
app.get('/', (req, res) => {
  res.render('index');
});

// Health check for Render
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'IcompassInvoice',
    timestamp: new Date().toISOString(),
  });
});

// Preview invoice as HTML
app.post('/preview', (req, res) => {
  const invoiceData = parseInvoiceBody(req.body);
  res.render('invoice', { invoice: invoiceData, mode: 'preview' });
});

// Download invoice as PDF
app.post('/pdf', (req, res) => {
  const invoiceData = parseInvoiceBody(req.body);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  renderPDF(doc, invoiceData);

  doc.end();
});

/**
 * Parse and sanitise the form body into a structured invoice object.
 */
function parseInvoiceBody(body) {
  const items = [];
  const descriptions = [].concat(body.itemDescription || []);
  const quantities = [].concat(body.itemQuantity || []);
  const unitPrices = [].concat(body.itemUnitPrice || []);

  for (let i = 0; i < descriptions.length; i++) {
    const qty = parseFloat(quantities[i]) || 0;
    const price = parseFloat(unitPrices[i]) || 0;
    if (descriptions[i] && descriptions[i].trim()) {
      items.push({
        description: descriptions[i].trim(),
        quantity: qty,
        unitPrice: price,
        total: qty * price,
      });
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseFloat(body.taxRate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const discount = parseFloat(body.discount) || 0;
  const total = subtotal + taxAmount - discount;

  return {
    invoiceNumber: (body.invoiceNumber || '').trim() || 'INV-001',
    invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: body.dueDate || '',
    currency: body.currency || 'USD',
    sender: {
      name: (body.senderName || '').trim(),
      address: (body.senderAddress || '').trim(),
      email: (body.senderEmail || '').trim(),
      phone: (body.senderPhone || '').trim(),
    },
    recipient: {
      name: (body.recipientName || '').trim(),
      address: (body.recipientAddress || '').trim(),
      email: (body.recipientEmail || '').trim(),
      phone: (body.recipientPhone || '').trim(),
    },
    items,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    total,
    notes: (body.notes || '').trim(),
  };
}

/**
 * Render invoice content into a PDFKit document.
 */
function renderPDF(doc, inv) {
  const currencySymbol = getCurrencySymbol(inv.currency);

  // Header bar
  doc.rect(0, 0, doc.page.width, 100).fill('#2563eb');

  doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold')
    .text('INVOICE', 50, 30);

  doc.fontSize(10).font('Helvetica')
    .text(`Invoice #: ${inv.invoiceNumber}`, 50, 62)
    .text(`Date: ${formatDate(inv.invoiceDate)}`, 50, 76);

  if (inv.dueDate) {
    doc.text(`Due Date: ${formatDate(inv.dueDate)}`, 200, 76);
  }

  // From / To section
  doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
  doc.text('FROM', 50, 120);
  doc.font('Helvetica').fillColor('#374151')
    .text(inv.sender.name || '-', 50, 134)
    .text(inv.sender.address || '', 50, 148, { width: 200 });
  if (inv.sender.email) doc.text(inv.sender.email, 50, doc.y + 4);
  if (inv.sender.phone) doc.text(inv.sender.phone, 50, doc.y + 4);

  doc.fillColor('#111827').font('Helvetica-Bold')
    .text('TO', 300, 120);
  doc.font('Helvetica').fillColor('#374151')
    .text(inv.recipient.name || '-', 300, 134)
    .text(inv.recipient.address || '', 300, 148, { width: 200 });
  if (inv.recipient.email) doc.text(inv.recipient.email, 300, doc.y + 4);
  if (inv.recipient.phone) doc.text(inv.recipient.phone, 300, doc.y + 4);

  // Items table
  const tableTop = 260;
  doc.rect(50, tableTop, doc.page.width - 100, 22).fill('#2563eb');
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
    .text('DESCRIPTION', 60, tableTop + 7)
    .text('QTY', 330, tableTop + 7, { width: 50, align: 'right' })
    .text('UNIT PRICE', 390, tableTop + 7, { width: 70, align: 'right' })
    .text('TOTAL', 470, tableTop + 7, { width: 70, align: 'right' });

  let y = tableTop + 22;
  inv.items.forEach((item, idx) => {
    const rowFill = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
    doc.rect(50, y, doc.page.width - 100, 22).fill(rowFill);
    doc.fillColor('#111827').fontSize(9).font('Helvetica')
      .text(item.description, 60, y + 7, { width: 260 })
      .text(item.quantity.toString(), 330, y + 7, { width: 50, align: 'right' })
      .text(`${currencySymbol}${item.unitPrice.toFixed(2)}`, 390, y + 7, { width: 70, align: 'right' })
      .text(`${currencySymbol}${item.total.toFixed(2)}`, 470, y + 7, { width: 70, align: 'right' });
    y += 22;
  });

  // Totals
  y += 10;
  const totalsX = 370;

  const addTotalRow = (label, value, bold = false) => {
    doc.fillColor('#374151').fontSize(9)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, totalsX, y, { width: 100 })
      .text(value, totalsX + 100, y, { width: 80, align: 'right' });
    y += 18;
  };

  addTotalRow('Subtotal:', `${currencySymbol}${inv.subtotal.toFixed(2)}`);
  if (inv.taxRate > 0) {
    addTotalRow(`Tax (${inv.taxRate}%):`, `${currencySymbol}${inv.taxAmount.toFixed(2)}`);
  }
  if (inv.discount > 0) {
    addTotalRow('Discount:', `-${currencySymbol}${inv.discount.toFixed(2)}`);
  }

  y += 2;
  doc.moveTo(totalsX, y).lineTo(totalsX + 180, y).stroke('#2563eb');
  y += 6;

  doc.rect(totalsX - 10, y - 4, 200, 26).fill('#2563eb');
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
    .text('TOTAL DUE:', totalsX, y + 4, { width: 100 })
    .text(`${currencySymbol}${inv.total.toFixed(2)}`, totalsX + 100, y + 4, { width: 80, align: 'right' });

  // Notes
  if (inv.notes) {
    y += 50;
    doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
    doc.font('Helvetica').fillColor('#374151').text(inv.notes, 50, y + 14, { width: doc.page.width - 100 });
  }

  // Footer
  doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
    .text('Generated by IcompassInvoice', 50, doc.page.height - 40, {
      align: 'center',
      width: doc.page.width - 100,
    });
}

function getCurrencySymbol(currency) {
  const symbols = { USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: 'A$', CAD: 'C$' };
  return symbols[currency] || currency + ' ';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`IcompassInvoice server running at http://localhost:${PORT}`);
  });
}

module.exports = app;

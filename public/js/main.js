'use strict';

(function () {
  // Set default invoice date to today
  const today = new Date().toISOString().split('T')[0];
  const invoiceDateInput = document.getElementById('invoiceDate');
  if (invoiceDateInput && !invoiceDateInput.value) {
    invoiceDateInput.value = today;
  }

  // Currency symbol map
  const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: 'A$', CAD: 'C$',
  };

  function getCurrencySymbol() {
    const sel = document.getElementById('currency');
    return CURRENCY_SYMBOLS[sel ? sel.value : 'USD'] || '$';
  }

  function fmt(num) {
    return getCurrencySymbol() + num.toFixed(2);
  }

  // Recalculate all totals
  function recalculate() {
    let subtotal = 0;
    document.querySelectorAll('.item-row').forEach(function (row) {
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const price = parseFloat(row.querySelector('.price-input').value) || 0;
      const rowTotal = qty * price;
      subtotal += rowTotal;
      row.querySelector('.row-total').textContent = fmt(rowTotal);
    });

    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;

    document.getElementById('subtotalDisplay').textContent = fmt(subtotal);

    const taxRow = document.getElementById('taxRow');
    if (taxRate > 0) {
      document.getElementById('taxLabel').textContent = 'Tax (' + taxRate + '%)';
      document.getElementById('taxDisplay').textContent = fmt(taxAmount);
      taxRow.style.display = '';
    } else {
      taxRow.style.display = 'none';
    }

    const discountRow = document.getElementById('discountRow');
    if (discount > 0) {
      document.getElementById('discountDisplay').textContent = '-' + fmt(discount);
      discountRow.style.display = '';
    } else {
      discountRow.style.display = 'none';
    }

    document.getElementById('totalDisplay').textContent = fmt(total);
  }

  // Build a new item row
  function createItemRow() {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML =
      '<td><input type="text" name="itemDescription" placeholder="Service or product description" /></td>' +
      '<td><input type="number" name="itemQuantity" placeholder="1" min="0" step="any" class="qty-input" /></td>' +
      '<td><input type="number" name="itemUnitPrice" placeholder="0.00" min="0" step="0.01" class="price-input" /></td>' +
      '<td class="row-total">' + fmt(0) + '</td>' +
      '<td><button type="button" class="btn-icon remove-row" title="Remove row" aria-label="Remove row">\u2715</button></td>';
    return tr;
  }

  // Add row button
  document.getElementById('addRow').addEventListener('click', function () {
    const tbody = document.getElementById('itemsBody');
    const row = createItemRow();
    tbody.appendChild(row);
    bindRowEvents(row);
    row.querySelector('input[name="itemDescription"]').focus();
    recalculate();
  });

  // Bind events to a single row
  function bindRowEvents(row) {
    row.querySelector('.qty-input').addEventListener('input', recalculate);
    row.querySelector('.price-input').addEventListener('input', recalculate);
    row.querySelector('.remove-row').addEventListener('click', function () {
      const rows = document.querySelectorAll('.item-row');
      if (rows.length > 1) {
        row.remove();
        recalculate();
      } else {
        // Reset the last remaining row instead of removing it
        row.querySelector('input[name="itemDescription"]').value = '';
        row.querySelector('.qty-input').value = '';
        row.querySelector('.price-input').value = '';
        recalculate();
      }
    });
  }

  // Bind existing rows
  document.querySelectorAll('.item-row').forEach(bindRowEvents);

  // Global re-calc on currency / tax / discount change
  document.getElementById('currency').addEventListener('change', recalculate);
  document.getElementById('taxRate').addEventListener('input', recalculate);
  document.getElementById('discount').addEventListener('input', recalculate);

  // Initial calculation
  recalculate();
})();

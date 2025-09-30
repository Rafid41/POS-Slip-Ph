// POS_Slip_generation.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qr = require('qr-image');

const mmToPt = mm => mm * 2.835;

// Function to calculate the required PDF height dynamically
function calculateHeight(order, pageWidth, margin) {
  const doc = new PDFDocument({
    size: [pageWidth, 10000],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    autoFirstPage: false,
  });
  doc.addPage();

  doc.registerFont('RobotoMono-Regular', 'static/fonts/RobotoMono/RobotoMono-Regular.ttf');
  doc.registerFont('RobotoMono-Bold', 'static/fonts/RobotoMono/RobotoMono-Bold.ttf');

  const usableWidth = pageWidth - 2 * margin;

  const logoHeight = 50;
  const orderInfoFontSize = 6;
  const tableHeaderFontSize = 6;
  const tableRowFontSize = 6;
  const rowBaseHeight = 12;
  const footerHeight = 20;

  // Format date
  const createdAt = new Date(order.createdAt);
  const formattedDate = createdAt.toISOString().slice(0, 16).replace('T', ' ');

  // Order info height
  doc.font('RobotoMono-Regular').fontSize(orderInfoFontSize);
  const leftColumnHeight =
    doc.font('RobotoMono-Bold').heightOfString(`Order details`, { width: usableWidth * 0.7 }) +
    doc.font('RobotoMono-Regular').heightOfString(`Code: ${order.orderCode}`, { width: usableWidth * 0.7 }) +
    doc.heightOfString(`Date: ${formattedDate}`, { width: usableWidth * 0.7 }) +
    doc.heightOfString(`Status: ${order.status}`, { width: usableWidth * 0.7 }) +
    doc.heightOfString(`Payment Method: ${order.paymentMethod}`, { width: usableWidth * 0.7 }) + 10;

  const rightColumnHeight =
    doc.font('RobotoMono-Bold').heightOfString(`Bill to:`, { width: usableWidth * 0.3 }) +
    doc.font('RobotoMono-Regular').heightOfString(order.billingAddressSnapshot?.fullName || '', { width: usableWidth * 0.3 }) +
    doc.heightOfString(`CId: ${order.User.username}`, { width: usableWidth * 0.3 }) +
    doc.heightOfString(order.billingAddressSnapshot?.contactNo || '', { width: usableWidth * 0.3 }) + 10;

  const orderAndBillToHeight = Math.max(leftColumnHeight, rightColumnHeight);

  // Table header height
  doc.font('RobotoMono-Bold').fontSize(tableHeaderFontSize);
  const tableHeaderHeight = doc.heightOfString('Item Description Qty Amount', { width: usableWidth });

  // Column widths (60%, 10%, 30%)
  const colWidths = {
    productName: usableWidth * 0.6,
    qty: usableWidth * 0.1,
    amount: usableWidth * 0.3,
  };

  // Rows height
  doc.font('RobotoMono-Regular').fontSize(tableRowFontSize);
  let rowsHeight = 0;
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name}(${item.Product.strength}) ${item.Product.productType.name}`;
    const qty = `${item.unitQuantity}`;
    const amount = (unitPrice * item.unitQuantity).toFixed(2);

    const productNameHeight = doc.heightOfString(productName, { width: colWidths.productName });
    const qtyHeight = doc.heightOfString(qty, { width: colWidths.qty });
    const amountHeight = doc.heightOfString(amount, { width: colWidths.amount });

    const rowHeight = Math.max(productNameHeight, qtyHeight, amountHeight, 12);
    rowsHeight += rowHeight;
  });

  const totalsHeight = 4 * 12 + 20; // Subtotal, Discount, Shipping, Total + extra spacing

  const totalHeight =
    margin +
    mmToPt(5) +
    logoHeight +
    orderAndBillToHeight +
    tableHeaderHeight +
    rowsHeight +
    totalsHeight +
    footerHeight +
    margin + 40;

  return totalHeight;
}

function generatePOSSlip(order, res) {
  const pageWidth = mmToPt(57);
  const margin = mmToPt(1);

  const pageHeight = calculateHeight(order, pageWidth, margin);

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  });

  doc.pipe(res);

  doc.registerFont('RobotoMono-Regular', 'static/fonts/RobotoMono/RobotoMono-Regular.ttf');
  doc.registerFont('RobotoMono-Bold', 'static/fonts/RobotoMono/RobotoMono-Bold.ttf');

  const afterLogoY = margin + mmToPt(5);

  // Logo
  const logoPath = path.join('.', 'static', 'logo.png');
  const logoWidth = 50;
  const logoHeight = 50;
  const logoX = margin;
  const logoY = afterLogoY;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight });
    } catch (e) {}
  }

  // QR Code
  const qrCodeWidth = 50;
  const qrCodeX = pageWidth - margin - qrCodeWidth;
  const qrCodeY = afterLogoY;
  const qr_png = qr.imageSync(order.QRCode, { type: 'png' });
  doc.image(qr_png, qrCodeX, qrCodeY, { width: qrCodeWidth, height: qrCodeWidth });

  // Order details + Bill To
  const orderDetailsStartY = logoY + logoHeight;
  const usableWidth = pageWidth - 2 * margin;
  const leftWidth = usableWidth * 0.7;
  const rightWidth = usableWidth * 0.3;

  // Left: Order details
  doc.fontSize(6).font('RobotoMono-Bold').text('Order details:', margin, orderDetailsStartY, { width: leftWidth });
  doc.font('RobotoMono-Regular').text(`Code: ${order.orderCode}`, { width: leftWidth });

  const createdAt = new Date(order.createdAt);
  const formattedDate = createdAt.toISOString().slice(0, 16).replace('T', ' ');
  doc.text(`Date: ${formattedDate}`, { width: leftWidth });
  doc.text(`Stat: ${order.status}`, { width: leftWidth });

  const finalLeftY = doc.y;

  // Right: Bill To
  doc.y = orderDetailsStartY;
  doc.fontSize(6).font('RobotoMono-Bold').text('Bill to:', margin + leftWidth, doc.y, { width: rightWidth, align: 'right' });
  doc.font('RobotoMono-Regular')
    .text(`CId: ${order.User.username}`, { width: rightWidth, align: 'right' })
    .text(order.billingAddressSnapshot?.contactNo || '', { width: rightWidth, align: 'right' });
  doc.text(`Payment: ${order.paymentMethod}`, { width: rightWidth, align: 'right' });
  const finalRightY = doc.y;

  doc.y = Math.max(finalLeftY, finalRightY) + 15;

  const startX = margin;
  let y = doc.y;

  // Column widths (60%, 10%, 30%)
  const colWidths = {
    productName: usableWidth * 0.6,
    qty: usableWidth * 0.1,
    amount: usableWidth * 0.3,
  };

  // Table header
  doc.font('RobotoMono-Bold').fontSize(6);
  doc.text('Item Description', startX, y, { width: colWidths.productName });
  doc.text('Qty', startX + colWidths.productName, y, { width: colWidths.qty, align: 'right' });
  doc.text('Amount', startX + colWidths.productName + colWidths.qty, y, { width: colWidths.amount, align: 'right' });

  y += 12;
  doc.moveTo(startX, y).lineTo(pageWidth - margin, y).stroke();
  y += 2;

  // Table rows
  doc.font('RobotoMono-Regular').fontSize(6);
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name}(${item.Product.strength}) ${item.Product.productType.name}`;
    const qty = `${item.unitQuantity}`;
    const amount = (unitPrice * item.unitQuantity).toFixed(2);

    const rowHeight = Math.max(
      doc.heightOfString(productName, { width: colWidths.productName }),
      doc.heightOfString(qty, { width: colWidths.qty }),
      doc.heightOfString(amount, { width: colWidths.amount }),
      10
    );

    doc.text(productName, startX, y, { width: colWidths.productName });
    doc.text(qty, startX + colWidths.productName, y, { width: colWidths.qty, align: 'right' });
    doc.text(amount, startX + colWidths.productName + colWidths.qty, y, { width: colWidths.amount, align: 'right' });

    y += rowHeight;
  });

  doc.moveTo(pageWidth / 2, y + 5).lineTo(pageWidth - margin, y + 5).stroke();
  y += 13;

  // Totals section starting from 50% of page width
  const totalsLabelX = startX + usableWidth * 0.5; // 50% from left
  const totalsValueX = startX + colWidths.productName + colWidths.qty; // Amount column
  const totalsWidth = colWidths.amount;

  let currentY = y;

  doc.font('RobotoMono-Bold').fontSize(6).text('Subtotal:', totalsLabelX, currentY, { width: totalsWidth, align: 'left' });
  doc.font('RobotoMono-Regular').text(`${order.PriceSubTotal.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 10;

  doc.font('RobotoMono-Bold').text('Discount:', totalsLabelX, currentY, { width: totalsWidth, align: 'left' });
  doc.font('RobotoMono-Regular').text(`(-) ${order.discountAmount.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 10;

  doc.font('RobotoMono-Bold').text('Shipping:', totalsLabelX, currentY, { width: totalsWidth, align: 'left' });
  doc.font('RobotoMono-Regular').text(`${order.shippingCost.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 12;

  doc.font('RobotoMono-Bold').text('Total:', totalsLabelX, currentY, { width: totalsWidth, align: 'left' });
  doc.font('RobotoMono-Regular').text(`${order.totalAmount.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  y = currentY + 20;

  // Footer
  doc.moveTo(startX, y - 10).lineTo(pageWidth - margin, y - 10).stroke();
  doc.font('RobotoMono-Regular').fontSize(6).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(6).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };

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
  const halfWidth = usableWidth / 2;

  const logoHeight = 50;
  const orderInfoFontSize = 6;
  const tableHeaderFontSize = 6;
  const tableRowFontSize = 6;
  const rowBaseHeight = 12;
  const footerHeight = 20;

  // Order info height
  doc.font('RobotoMono-Regular').fontSize(orderInfoFontSize);
  const leftColumnHeight =
    doc.font('RobotoMono-Bold').heightOfString(`Order details`, { width: halfWidth }) +
    doc.font('RobotoMono-Regular').heightOfString(`Order Code: ${order.orderCode}`, { width: halfWidth }) +
    doc.heightOfString(`Order Date: ${order.createdAt}`, { width: halfWidth }) +
    doc.heightOfString(`Order Status: ${order.status}`, { width: halfWidth }) +
    doc.heightOfString(`Payment Method: ${order.paymentMethod}`, { width: halfWidth }) + 10;

  // Bill To height
  const rightColumnHeight =
    doc.font('RobotoMono-Bold').heightOfString(`Bill to:`, { width: halfWidth }) +
    doc.font('RobotoMono-Regular').heightOfString(`${order.billingAddressSnapshot.fullName}`, { width: halfWidth }) +
    doc.heightOfString(`CId: ${order.User.username}`, { width: halfWidth }) +
    doc.heightOfString(`${order.billingAddressSnapshot.contactNo}`, { width: halfWidth }) + 10;

  const orderAndBillToHeight = Math.max(leftColumnHeight, rightColumnHeight);

  // Table header height
  doc.font('RobotoMono-Bold').fontSize(tableHeaderFontSize);
  const tableHeaderHeight = doc.heightOfString('Product Name Qty Amount', { width: usableWidth });

  const colWidths = {
    productName: mmToPt(20),
    qty: mmToPt(15),
    amount: mmToPt(15),
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

  const totalsHeight = rowBaseHeight * 5 + 20;

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

  doc.font('RobotoMono-Regular');

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

  // Order details
  const orderDetailsStartY = logoY + logoHeight;
  const halfWidth = (pageWidth - 2 * margin) / 2;

  doc.fontSize(6).font('RobotoMono-Bold').text('Order details', margin, orderDetailsStartY, { width: halfWidth });
  doc.font('RobotoMono-Regular');
  doc.text(`Order Code: ${order.orderCode}`, { width: halfWidth });
  doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString('sv-SE')}`, { width: halfWidth });
  doc.text(`Order Status: ${order.status}`, { width: halfWidth });
  doc.text(`Payment Method: ${order.paymentMethod}`, { width: halfWidth });
  const finalLeftY = doc.y;

  // Bill to
  doc.y = orderDetailsStartY;
  doc.fontSize(6).font('RobotoMono-Bold').text('Bill to:', margin + halfWidth, doc.y, { width: halfWidth });
  doc.font('RobotoMono-Regular');
  doc.text(order.billingAddressSnapshot?.fullName || '', { width: halfWidth });
  doc.text(`CId: ${order.User.username}`, { width: halfWidth });
  doc.text(`${order.billingAddressSnapshot.contactNo}`, { width: halfWidth });
  const finalRightY = doc.y;

  doc.y = Math.max(finalLeftY, finalRightY) + 10;

  const startX = margin;
  let y = doc.y;

  const colWidths = {
    productName: mmToPt(20),
    qty: mmToPt(15),
    amount: mmToPt(15),
  };

  // Table header
  doc.font('RobotoMono-Bold').fontSize(6);
  doc.text('Product Name', startX, y, { width: colWidths.productName });
  doc.text('Qty', startX + colWidths.productName, y, { width: colWidths.qty, align: 'right' });
  doc.text('Amount', startX + colWidths.productName + colWidths.qty, y, { width: colWidths.amount, align: 'right' });
  y += 20;

  doc.moveTo(startX, y).lineTo(pageWidth - margin, y).stroke();
  y += 10;

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

  // Totals
  const totalsLabelX = startX + colWidths.productName - mmToPt(10);
  const totalsValueX = totalsLabelX + colWidths.qty;
  const totalsWidth = colWidths.amount + mmToPt(10);

  let currentY = y;

  doc.font('RobotoMono-Bold').fontSize(6).text('Subtotal:', totalsLabelX, currentY, { width: colWidths.qty, align: 'right' });
  doc.font('RobotoMono-Regular').text(`${order.PriceSubTotal.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 10;

  doc.font('RobotoMono-Bold').text('Discount:', totalsLabelX, currentY, { width: colWidths.qty, align: 'right' });
  doc.font('RobotoMono-Regular').text(`(-) ${order.discountAmount.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 10;

  doc.font('RobotoMono-Bold').text('Shipping:', totalsLabelX, currentY, { width: colWidths.qty, align: 'right' });
  doc.font('RobotoMono-Regular').text(`${order.shippingCost.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  currentY += 12;

  doc.font('RobotoMono-Bold').fontSize(6).text('Total:', totalsLabelX, currentY, { width: colWidths.qty, align: 'right' });
  doc.font('RobotoMono-Regular').fontSize(6).text(`${order.totalAmount.toFixed(2)}`, totalsValueX, currentY, { width: totalsWidth, align: 'right' });
  y = currentY + 20;

  // Footer
  doc.moveTo(startX, y - 10).lineTo(pageWidth - margin, y - 10).stroke();
  doc.font('RobotoMono-Regular').fontSize(6).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(6).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };

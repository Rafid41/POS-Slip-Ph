// POS_Slip_generation.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qr = require('qr-image');

const mmToPt = mm => mm * 2.835;

// Function to calculate the required PDF height dynamically
function calculateHeight(order, pageWidth, margin, fontName) {
  const doc = new PDFDocument({
    size: [pageWidth, 10000],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    autoFirstPage: false,
  });
  doc.addPage();

  const usableWidth = pageWidth - 2 * margin;

  const logoHeight = 50;
  const addressFontSize = 7;
  const orderInfoFontSize = 8;
  const tableHeaderFontSize = 8;
  const tableRowFontSize = 8;
  const rowBaseHeight = 12;
  const footerHeight = 20;

  // Address height (2 lines)
  doc.font(fontName).fontSize(addressFontSize);
  const addressLineHeight = doc.heightOfString('123 Main Street', { width: usableWidth });
  const addressHeight = addressLineHeight * 2 + 10;

  // Order info height
  doc.font(fontName).fontSize(orderInfoFontSize);
  const orderInfoHeight =
    doc.heightOfString(`Order details`, { width: usableWidth }) +
    doc.heightOfString(`Order Code: ${order.orderCode}`, { width: usableWidth }) +
    doc.heightOfString(`Order Date: ${order.createdAt}`, { width: usableWidth }) +
    doc.heightOfString(`Order Status: ${order.status}`, { width: usableWidth }) +
    doc.heightOfString(`Payment Method: ${order.paymentMethod}`, { width: usableWidth }) + 10;

  // Bill To height
  const billToHeight =
    doc.heightOfString(`Bill to:`, { width: usableWidth }) +
    doc.heightOfString(`${order.billingAddressSnapshot.fullName}`, { width: usableWidth }) +
    doc.heightOfString(`Customer ID: ${order.user.username}`, { width: usableWidth }) +
    doc.heightOfString(`Contact No: ${order.billingAddressSnapshot.contactNo}`, { width: usableWidth }) + 10;

  // Table header height
  doc.font(fontName).fontSize(tableHeaderFontSize).font('Helvetica-Bold');
  const tableHeaderHeight = doc.heightOfString('Product Name Qty×UnitPrice Amount', { width: usableWidth });

  const colWidths = {
    productName: mmToPt(25),
    qtyUnitPrice: mmToPt(15),
    amount: mmToPt(15),
  };

  // Rows height
  doc.font(fontName).fontSize(tableRowFontSize).font('Helvetica');
  let rowsHeight = 0;
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name}(${item.Product.strength}) ${item.Product.productType.name}`;
    const qtyUnitPrice = `${item.unitQuantity} × ${unitPrice.toFixed(2)}`;
    const amount = (unitPrice * item.unitQuantity).toFixed(2);

    const productNameHeight = doc.heightOfString(productName, { width: colWidths.productName });
    const qtyUnitPriceHeight = doc.heightOfString(qtyUnitPrice, { width: colWidths.qtyUnitPrice });
    const amountHeight = doc.heightOfString(amount, { width: colWidths.amount });

    const rowHeight = Math.max(productNameHeight, qtyUnitPriceHeight, amountHeight, 12);
    rowsHeight += rowHeight;
  });

  const totalsHeight = rowBaseHeight * 5 + 20;

  const totalHeight =
    margin +
    mmToPt(5) +
    logoHeight +
    addressHeight +
    Math.max(orderInfoHeight, billToHeight) +
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

  const robotoMonoFontPath = path.join('.', 'fonts', 'RobotoMono-Regular.ttf');
  const fontName = fs.existsSync(robotoMonoFontPath) ? 'Roboto Mono' : 'Helvetica';

  const pageHeight = calculateHeight(order, pageWidth, margin, fontName);

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  });

  doc.pipe(res);

  if (fs.existsSync(robotoMonoFontPath)) {
    doc.registerFont('Roboto Mono', robotoMonoFontPath);
    doc.font('Roboto Mono');
  } else {
    doc.font('Helvetica');
  }

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

  // Address
  const addressStartY = logoY + logoHeight;
  doc.font(fontName).fontSize(7)
    .text('123 Main Street', margin, addressStartY, { align: 'left' });
  doc.text('City, Country', { align: 'left' });
  doc.moveDown(1);

  // Order details
  const orderDetailsStartY = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').text('Order details', margin, orderDetailsStartY);
  doc.font('Helvetica').text(`Order Code: ${order.orderCode}`);
  doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString('sv-SE')}`);
  doc.text(`Order Status: ${order.status}`);
  doc.text(`Payment Method: ${order.paymentMethod}`);

  // Bill to
  const billToStartX = pageWidth / 2;
  doc.fontSize(8).font('Helvetica-Bold').text('Bill to:', billToStartX, orderDetailsStartY);
  doc.font('Helvetica').text(order.billingAddressSnapshot?.fullName || '');
  doc.text(`Customer ID: ${order.user.username}`);
  doc.text(`Contact No: ${order.billingAddressSnapshot.contactNo}`);


  doc.y = Math.max(doc.y, doc.y + 10) + 10;


  const startX = margin;
  let y = doc.y;

  const colWidths = {
    productName: mmToPt(25),
    qtyUnitPrice: mmToPt(15),
    amount: mmToPt(15),
  };

  // Table header
  doc.font(fontName).fontSize(8).font('Helvetica-Bold');
  doc.text('Product Name', startX, y, { width: colWidths.productName });
  doc.text('Qty×UnitPrice', startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
  doc.text('Amount', startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });
  y += 12;

  doc.moveTo(startX, y - 5).lineTo(pageWidth - margin, y - 5).stroke();

  // Table rows
  doc.font('Helvetica').fontSize(8);
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name}(${item.Product.strength}) ${item.Product.productType.name}`;
    const qtyUnitPrice = `${item.unitQuantity} × ${unitPrice.toFixed(2)}`;
    const amount = (unitPrice * item.unitQuantity).toFixed(2);

    const rowHeight = Math.max(
      doc.heightOfString(productName, { width: colWidths.productName }),
      doc.heightOfString(qtyUnitPrice, { width: colWidths.qtyUnitPrice }),
      doc.heightOfString(amount, { width: colWidths.amount }),
      12
    );

    doc.text(productName, startX, y, { width: colWidths.productName });
    doc.text(qtyUnitPrice, startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
    doc.text(amount, startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });

    y += rowHeight;
  });

  doc.moveTo(pageWidth/2, y + 5).lineTo(pageWidth - margin, y + 5).stroke();
  y += 13;

  // Totals
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Subtotal:', startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
  doc.font('Helvetica').text(`${order.PriceSubTotal.toFixed(2)}`, startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Discount:', startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
  doc.font('Helvetica').text(`(-) ${order.discountAmount.toFixed(2)}`, startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Shipping:', startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
  doc.font('Helvetica').text(`${order.shippingCost.toFixed(2)}`, startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });
  y += 15;

  doc.font('Helvetica-Bold').fontSize(8).text('Total:', startX + colWidths.productName, y, { width: colWidths.qtyUnitPrice, align: 'right' });
  doc.font('Helvetica').fontSize(8).text(`${order.totalAmount.toFixed(2)}`, startX + colWidths.productName + colWidths.qtyUnitPrice, y, { width: colWidths.amount, align: 'right' });
  y += 20;

  // Footer
  doc.moveTo(startX, y - 10).lineTo(pageWidth - margin, y - 10).stroke();
  doc.fontSize(8).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(7).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };
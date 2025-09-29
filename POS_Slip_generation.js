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
  const orderInfoFontSize = 7;
  const tableHeaderFontSize = 8;
  const tableRowFontSize = 7;
  const rowBaseHeight = 12;
  const footerHeight = 20;

  // Address height (2 lines)
  doc.font(fontName).fontSize(addressFontSize);
  const addressLineHeight = doc.heightOfString('123 Main Street', { width: usableWidth });
  const addressHeight = addressLineHeight * 2 + 10;

  // Order info height
  doc.font(fontName).fontSize(orderInfoFontSize);
  const orderInfoHeight =
    doc.heightOfString(`Order Id: ${order.id}`, { width: usableWidth }) +
    doc.heightOfString(`Order Date: ${order.createdAt}`, { width: usableWidth }) +
    doc.heightOfString(`Order Status: ${order.status}`, { width: usableWidth }) +
    doc.heightOfString(`Payment Method: ${order.paymentMethod}`, { width: usableWidth }) + 10;

  // Bill To height
  const billToHeight =
    doc.heightOfString(`Bill To:`, { width: usableWidth }) +
    doc.heightOfString(`${order.billingAddressSnapshot.fullName}`, { width: usableWidth }) +
    doc.heightOfString(
      `${order.billingAddressSnapshot.houseHoldingNo}, ${order.billingAddressSnapshot.streetSector}, ${order.billingAddressSnapshot.villageArea}, ${order.billingAddressSnapshot.policeStationSubDistrict}, ${order.billingAddressSnapshot.cityDistrict}, ${order.billingAddressSnapshot.stateDivision}, ${order.billingAddressSnapshot.country}`,
      { width: usableWidth }
    ) + 10;

  // Table header height
  doc.font(fontName).fontSize(tableHeaderFontSize).font('Helvetica-Bold');
  const tableHeaderHeight = doc.heightOfString('Item Qty Price Total', { width: usableWidth });

  const colWidths = {
    item: mmToPt(18),
    qty: mmToPt(8),
    price: mmToPt(14),
    total: mmToPt(15),
  };

  // Rows height
  doc.font(fontName).fontSize(tableRowFontSize).font('Helvetica');
  let rowsHeight = 0;
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name} ${item.Product.strength}`;
    const quantity = item.unitQuantity.toString();
    const price = unitPrice.toFixed(2);
    const lineTotal = (unitPrice * item.unitQuantity).toFixed(2);

    const productNameHeight = doc.heightOfString(productName, { width: colWidths.item });
    const quantityHeight = doc.heightOfString(quantity, { width: colWidths.qty });
    const priceHeight = doc.heightOfString(price, { width: colWidths.price });
    const totalHeight = doc.heightOfString(lineTotal, { width: colWidths.total });

    const rowHeight = Math.max(productNameHeight, quantityHeight, priceHeight, totalHeight, 12);
    rowsHeight += rowHeight;
  });

  const totalsHeight = rowBaseHeight * 5 + 20;

  const totalHeight =
    margin +
    mmToPt(5) +
    logoHeight +
    addressHeight +
    orderInfoHeight +
    billToHeight +
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

  const arialFontPath = path.join('.', 'fonts', 'arial.ttf');
  const fontName = fs.existsSync(arialFontPath) ? 'Arial' : 'Helvetica';

  const pageHeight = calculateHeight(order, pageWidth, margin, fontName);

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  });

  doc.pipe(res);

  if (fs.existsSync(arialFontPath)) {
    doc.registerFont('Arial', arialFontPath);
    doc.font('Arial');
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

  // Order info
  doc.fontSize(7);
  doc.text(`Order Id: ${order.id}`);
  doc.text(`Order Date: ${order.createdAt}`);
  doc.text(`Order Status: ${order.status}`);
  doc.text(`Payment Method: ${order.paymentMethod}`);
  doc.moveDown(0.5);

  // Bill To
  doc.fontSize(7).font('Helvetica-Bold').text('Bill To:');
  doc.font('Helvetica').text(order.billingAddressSnapshot?.fullName || '');

  // Collect all address parts safely, skipping null/empty
  const addressParts = [
    order.billingAddressSnapshot?.houseHoldingNo,
    order.billingAddressSnapshot?.streetSector,
    order.billingAddressSnapshot?.villageArea,
    order.billingAddressSnapshot?.policeStationSubDistrict,
    order.billingAddressSnapshot?.cityDistrict,
    order.billingAddressSnapshot?.stateDivision,
    order.billingAddressSnapshot?.country,
  ].filter(part => part && part.trim() !== ''); // remove null/undefined/empty

  // Join only the valid parts with commas
  if (addressParts.length > 0) {
    doc.text(addressParts.join(', '));
  }

  doc.moveDown(0.5);


  const startX = margin;
  let y = doc.y;

  const colWidths = {
    item: mmToPt(18),
    qty: mmToPt(8),
    price: mmToPt(14),
    total: mmToPt(15),
  };

  // Table header
  doc.font(fontName).fontSize(8).font('Helvetica-Bold');
  doc.text('Item', startX, y, { width: colWidths.item });
  doc.text('Qty', startX + colWidths.item, y, { width: colWidths.qty, align: 'right' });
  doc.text('Price', startX + colWidths.item + colWidths.qty, y, { width: colWidths.price, align: 'right' });
  doc.text('Total', startX + colWidths.item + colWidths.qty + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.moveTo(startX, y - 5).lineTo(pageWidth - margin, y - 5).stroke();

  // Table rows
  doc.font('Helvetica').fontSize(7);
  order.items.forEach(item => {
    const unitPrice = item.Product?.pricing?.[0]?.unitPrice || 0;
    const productName = `${item.Product.name} ${item.Product.strength}`;
    const quantity = item.unitQuantity.toString();
    const price = unitPrice.toFixed(2);
    const lineTotal = (unitPrice * item.unitQuantity).toFixed(2);

    const rowHeight = Math.max(
      doc.heightOfString(productName, { width: colWidths.item }),
      doc.heightOfString(quantity, { width: colWidths.qty }),
      doc.heightOfString(price, { width: colWidths.price }),
      doc.heightOfString(lineTotal, { width: colWidths.total }),
      12
    );

    doc.text(productName, startX, y, { width: colWidths.item });
    doc.text(quantity, startX + colWidths.item, y, { width: colWidths.qty, align: 'right' });
    doc.text(price, startX + colWidths.item + colWidths.qty, y, { width: colWidths.price, align: 'right' });
    doc.text(lineTotal, startX + colWidths.item + colWidths.qty + colWidths.price, y, { width: colWidths.total, align: 'right' });

    y += rowHeight;
  });

  doc.moveTo(startX, y + 5).lineTo(pageWidth - margin, y + 5).stroke();
  y += 13;

  // Totals
  doc.font('Helvetica-Bold').fontSize(7);
  doc.text('Subtotal:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.PriceSubTotal.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Discount:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.discountAmount.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  // doc.font('Helvetica-Bold').text('Tax (0%):', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  // doc.font('Helvetica').text(`${(0).toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  // y += 12;

  doc.font('Helvetica-Bold').text('Shipping:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.shippingCost.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 15;

  doc.font('Helvetica-Bold').fontSize(7.5).text('Total:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).text(`${order.totalAmount.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 20;

  // Footer
  doc.fontSize(7).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(6).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };

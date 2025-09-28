// pdfPOSSlip.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qr = require('qr-image');

const mmToPt = mm => mm * 2.835;

// Function to calculate the required PDF height dynamically
function calculateHeight(order, pageWidth, margin, fontName) {
  // Create a temporary PDF document for measuring text
  const doc = new PDFDocument({
    size: [pageWidth, 10000], // very tall, to fit all content during measurement
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    autoFirstPage: false,
  });
  doc.addPage();

  const usableWidth = pageWidth - 2 * margin;

  // Fixed heights
  const logoHeight = mmToPt(50);
  const addressFontSize = 7;
  const orderInfoFontSize = 7;
  const tableHeaderFontSize = 8;
  const tableRowFontSize = 7;
  const rowBaseHeight = 12; // default row height when product name is short
  const totalsFontSize = 8;
  const footerHeight = 20;

  // Measure address height (2 lines)
  doc.font(fontName).fontSize(addressFontSize);
  const addressLineHeight = doc.heightOfString('123 Main Street', { width: usableWidth, align: 'center' });
  const addressHeight = addressLineHeight * 2 + 10; // plus some spacing

  // Measure order info height (4 lines)
  doc.font(fontName).fontSize(orderInfoFontSize);
  const orderIdHeight = doc.heightOfString(`Order Id: ${order.Order_Id}`, { width: usableWidth });
  const orderDateHeight = doc.heightOfString(`Order Date: ${order.Order_Date}`, { width: usableWidth });
  const orderStatusHeight = doc.heightOfString(`Order Status: ${order.Order_Status}`, { width: usableWidth });
  const paymentMethodHeight = doc.heightOfString(`Payment Method: ${order.Payment_Method}`, { width: usableWidth });
  const orderInfoHeight = orderIdHeight + orderDateHeight + orderStatusHeight + paymentMethodHeight + 10;

  // Measure "Bill To" height (4 lines)
  const billToHeight = doc.heightOfString(`Bill To:`, { width: usableWidth }) + doc.heightOfString(`${order.Customer_Name}`, { width: usableWidth }) + doc.heightOfString(`${order.Customer_Address}`, { width: usableWidth }) + doc.heightOfString(`${order.Customer_Location}`, { width: usableWidth }) + doc.heightOfString(`${order.Customer_Region}`, { width: usableWidth }) + 10;

  // Table header height
  doc.font(fontName).fontSize(tableHeaderFontSize).font('Helvetica-Bold');
  const tableHeaderHeight = doc.heightOfString('Item Qty Price Total', { width: usableWidth });

  // Column widths for table
  const colWidths = {
    item: mmToPt(20),
    qty: mmToPt(8),
    price: mmToPt(14),
    total: mmToPt(15),
  };

  // Calculate rows height considering wrapped product names
  doc.font(fontName).fontSize(tableRowFontSize).font('Helvetica');
  let rowsHeight = 0;
  order.Products.forEach(product => {
    const nameHeight = doc.heightOfString(product.name, { width: colWidths.item, align: 'left' });
    rowsHeight += Math.max(nameHeight, rowBaseHeight);
  });

  // Totals height: subtotal, discount, tax, shipping, total (5 lines) + buffer
  const totalsHeight = rowBaseHeight * 5 + 20;

  // Sum up all parts plus margins and extra buffer
  const totalHeight =
    margin +
    logoHeight +
    addressHeight +
    orderInfoHeight +
    billToHeight +
    tableHeaderHeight +
    rowsHeight +
    totalsHeight +
    footerHeight +
    margin + 30; // buffer

  return totalHeight;
}

function generatePOSSlip(order, res) {
  const pageWidth = mmToPt(57); // 57mm width
  const margin = mmToPt(1);

  const arialFontPath = path.join('.', 'fonts', 'arial.ttf');
  const fontName = fs.existsSync(arialFontPath) ? 'Arial' : 'Helvetica';

  // Calculate page height dynamically based on order content
  const pageHeight = calculateHeight(order, pageWidth, margin, fontName);

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  });

  doc.pipe(res);

  // Load font
  if (fs.existsSync(arialFontPath)) {
    doc.registerFont('Arial', arialFontPath);
    doc.font('Arial');
  } else {
    doc.font('Helvetica');
  }

  const afterLogoY = margin + mmToPt(20);

  // Draw logo and QR code
  const logoPath = path.join('.', 'static', 'logo.png');
  const logoWidth = 50;
  const logoHeight = 50;
  const logoX = margin;
  const logoY = afterLogoY;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight });
    } catch (e) {
      // ignore image load errors
    }
  }

  const qrCodeWidth = 50;
  const qrCodeHeight = 50;
  const qrCodeX = pageWidth - margin - qrCodeWidth;
  const qrCodeY = afterLogoY;
  const qr_png = qr.imageSync(order.QR_Code, { type: 'png' });
  doc.image(qr_png, qrCodeX, qrCodeY, { width: qrCodeWidth, height: qrCodeHeight });

  // Address below logo
  const addressStartY = logoY + logoHeight;
  doc.font(fontName).fontSize(7)
    .text('123 Main Street', margin, addressStartY, { align: 'center', width: pageWidth - 2 * margin });
  doc.text('City, Country', { align: 'center' });
  doc.moveDown(1);

  // Order info
  doc.fontSize(7);
  doc.text(`Order Id: ${order.Order_Id}`, { align: 'left' });
  doc.text(`Order Date: ${order.Order_Date}`, { align: 'left' });
  doc.text(`Order Status: ${order.Order_Status}`, { align: 'left' });
  doc.text(`Payment Method: ${order.Payment_Method}`, { align: 'left' });
  doc.moveDown(0.5);

  // Bill To
  doc.fontSize(7).font('Helvetica-Bold').text('Bill To:', { align: 'left' });
  doc.font('Helvetica').text(`${order.Customer_Name}`, { align: 'left' });
  doc.text(`${order.Customer_Address}`, { align: 'left' });
  doc.text(`${order.Customer_Location}`, { align: 'left' });
  doc.text(`${order.Customer_Region}`, { align: 'left' });
  doc.moveDown(0.5);

  const startX = margin;
  let y = doc.y;

  // Column widths
  const colWidths = {
    item: mmToPt(20),
    qty: mmToPt(8),
    price: mmToPt(14),
    total: mmToPt(15),
  };

  // Table header
  doc.font(fontName).fontSize(8).font('Helvetica-Bold');
  doc.text('Item', startX, y, { width: colWidths.item, align: 'left' });
  doc.text('Qty', startX + colWidths.item, y, { width: colWidths.qty, align: 'right' });
  doc.text('Price', startX + colWidths.item + colWidths.qty - mmToPt(2), y, { width: colWidths.price, align: 'right' });
  doc.text('Total', startX + colWidths.item + colWidths.qty + colWidths.price - mmToPt(2), y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.moveTo(startX, y - 5).lineTo(pageWidth - margin, y - 5).stroke();

  // Table rows with wrapped product name and aligned qty/price/total
  doc.font('Helvetica').fontSize(7);
  order.Products.forEach(product => {
    const productName = product.name;

    const productNameHeight = doc.heightOfString(productName, {
      width: colWidths.item,
      align: 'left',
    });

    const rowHeight = Math.max(productNameHeight, 12);

    // Draw wrapped product name
    doc.text(productName, startX, y, {
      width: colWidths.item,
      align: 'left',
    });

    // Vertically center qty, price, total relative to rowHeight
    const valignOffset = (rowHeight - 12) / 2;

    doc.text(product.quantity.toString(), startX + colWidths.item, y + valignOffset, {
      width: colWidths.qty,
      align: 'right',
    });
    doc.text(`${product.price.toFixed(2)}`, startX + colWidths.item + colWidths.qty - mmToPt(2), y + valignOffset, {
      width: colWidths.price,
      align: 'right',
    });
    doc.text(`${(product.price * product.quantity).toFixed(2)}`, startX + colWidths.item + colWidths.qty + colWidths.price - mmToPt(2), y + valignOffset, {
      width: colWidths.total,
      align: 'right',
    });

    y += rowHeight;
  });

  doc.moveTo(startX, y - 5).lineTo(pageWidth - margin, y - 5).stroke();
  y += 8;

  // Totals
  doc.font('Helvetica-Bold').fontSize(7);
  doc.text('Subtotal:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Price_Subtotal.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Discount:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Discount_Amount.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  const newSubtotal = order.Price_Subtotal - order.Discount_Amount;

  doc.font('Helvetica-Bold').text(`Tax (${order.Price_Tax_Percentise}%):`, startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${(newSubtotal * order.Price_Tax_Percentise / 100).toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Shipping:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Shipping_Cost.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 15;

  const total = newSubtotal + (newSubtotal * order.Price_Tax_Percentise / 100) + order.Shipping_Cost;

  doc.font('Helvetica-Bold').fontSize(7.5).text('Total:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).text(`${total.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 20;

  // Footer
  doc.fontSize(7).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(6).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };

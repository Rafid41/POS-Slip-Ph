// pdfPOSSlip.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qr = require('qr-image');

const mmToPt = mm => mm * 2.835;

function generatePOSSlip(order, res) {
  const pageWidth = mmToPt(57); // 57mm width
  const pageHeight = mmToPt(200); // A fixed height for the page
  const margin = mmToPt(1);

  const arialFontPath = path.join('.', 'fonts', 'arial.ttf');
  const fontName = fs.existsSync(arialFontPath) ? 'Arial' : 'Helvetica';

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    autoFirstPage: false,
  });
  doc.addPage();

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
    item: mmToPt(18),
    qty: mmToPt(8),
    price: mmToPt(14),
    total: mmToPt(15),
  };

  // Table header
  const drawTableHeader = () => {
    doc.font(fontName).fontSize(8).font('Helvetica-Bold');
    doc.text('Item', startX, y, { width: colWidths.item, align: 'left' });
    doc.text('Qty', startX + colWidths.item, y, { width: colWidths.qty, align: 'right' });
    doc.text('Price', startX + colWidths.item + colWidths.qty, y, { width: colWidths.price, align: 'right' });
    doc.text('Total', startX + colWidths.item + colWidths.qty + colWidths.price, y, { width: colWidths.total, align: 'right' });
    y += 12;
    doc.moveTo(startX, y - 5).lineTo(pageWidth - margin, y - 5).stroke();
  };

  drawTableHeader();

  // Table rows with wrapped product name and aligned qty/price/total
  doc.font('Helvetica').fontSize(7);
  const tableBottom = pageHeight - margin - 100; // 100 for footer and totals

  order.Products.forEach(product => {
    const productName = product.name;
    const quantity = product.quantity.toString();
    const price = product.price.toFixed(2);
    const lineTotal = (product.price * product.quantity).toFixed(2);

    const productNameHeight = doc.heightOfString(productName, {
      width: colWidths.item,
      align: 'left',
    });
    const quantityHeight = doc.heightOfString(quantity, {
      width: colWidths.qty,
      align: 'right',
    });
    const priceHeight = doc.heightOfString(price, {
      width: colWidths.price,
      align: 'right',
    });
    const totalHeight = doc.heightOfString(lineTotal, {
      width: colWidths.total,
      align: 'right',
    });

    const rowHeight = Math.max(productNameHeight, quantityHeight, priceHeight, totalHeight, 12);

    if (y + rowHeight > tableBottom) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }

    // Draw wrapped product name
    doc.text(productName, startX, y, {
      width: colWidths.item,
      align: 'left',
    });

    doc.text(quantity, startX + colWidths.item, y, {
      width: colWidths.qty,
      align: 'right',
    });
    doc.text(price, startX + colWidths.item + colWidths.qty, y, {
      width: colWidths.price,
      align: 'right',
    });
    doc.text(lineTotal, startX + colWidths.item + colWidths.qty + colWidths.price, y, {
      width: colWidths.total,
      align: 'right',
    });

    y += rowHeight;
  });

  doc.moveTo(startX, y + 5).lineTo(pageWidth - margin, y + 5).stroke();
  y += 13;

  // Totals
  doc.font('Helvetica-Bold').fontSize(7);
  doc.text('Subtotal:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Price_Subtotal.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Discount:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Discount_Amount.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text(`Tax (${order.Price_Tax_Percentise}%):`, startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${(order.Price_Subtotal * order.Price_Tax_Percentise / 100).toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 12;

  doc.font('Helvetica-Bold').text('Shipping:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').text(`${order.Shipping_Cost.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 15;

  doc.font('Helvetica-Bold').fontSize(7.5).text('Total:', startX + colWidths.item, y, { width: colWidths.price, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).text(`${order.Total.toFixed(2)}`, startX + colWidths.item + colWidths.price, y, { width: colWidths.total, align: 'right' });
  y += 20;

  // Footer
  doc.fontSize(7).text('Thank you for your purchase!', 0, y, { align: 'center', width: pageWidth });
  doc.fontSize(6).text('Visit us again!', { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generatePOSSlip };

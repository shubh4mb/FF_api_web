import PDFDocument from 'pdfkit';

/**
 * Generates a PDF receipt for a merchant registration fee payment.
 * @param {Object} data
 * @param {string} data.shopName
 * @param {string} data.merchantEmail
 * @param {number} data.amount
 * @param {string} data.paymentId
 * @param {Date} data.date
 * @returns {Promise<Buffer>}
 */
export const generateReceiptPDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Flashfits', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text('Payment Receipt', { align: 'center' })
        .moveDown(2);

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

      // Date & Receipt Info
      doc
        .fontSize(10)
        .text(`Date: ${new Date(data.date).toLocaleDateString()}`)
        .text(`Payment ID: ${data.paymentId}`)
        .moveDown(1);

      // Merchant Info
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Billed To:')
        .font('Helvetica')
        .text(`Shop Name: ${data.shopName}`)
        .text(`Email: ${data.merchantEmail}`)
        .moveDown(2);

      // Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Amount', 450, tableTop, { width: 100, align: 'right' });
      doc.moveDown(0.5);
      
      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);

      // Table Content
      const itemTop = doc.y;
      doc.font('Helvetica');
      doc.text('Merchant Registration Fee', 50, itemTop);
      doc.text(`Rs. ${data.amount}`, 450, itemTop, { width: 100, align: 'right' });
      doc.moveDown(1);

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

      // Total
      const totalTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Total Paid:', 50, totalTop);
      doc.text(`Rs. ${data.amount}`, 450, totalTop, { width: 100, align: 'right' });

      // Footer
      doc
        .moveDown(4)
        .fontSize(10)
        .font('Helvetica')
        .text('Thank you for choosing Flashfits!', { align: 'center', color: 'gray' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

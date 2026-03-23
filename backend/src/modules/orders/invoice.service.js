const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Company details
const COMPANY = {
    name: 'KJN Trading Company',
    address: 'SY No 444/3 Near Bharath Petroleum, Kadiri Road',
    city: 'Mukkalachenuvu Andhra Pradesh 517390',
    phone: '9804599804',
    email: 'info@shopatkin.com',
    gstin: '37CMMPK7267H1ZG',
};

// Colors
const GREEN_DARK = '#1B5E20';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const GRAY = '#666666';
const LIGHT_GRAY = '#F5F5F5';
const BORDER = '#CCCCCC';

// Asset paths
const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'kjn-logo.png');
const SIGNATURE_PATH = path.join(__dirname, '..', '..', 'assets', 'signature.png');

/**
 * Generate invoice number: EC-YYYYMMDD + seq
 */
function generateInvoiceNumber(orderCreatedAt) {
    const d = new Date(orderCreatedAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    return `EC-${y}${m}${seq}`;
}

/**
 * Convert number to Indian words
 */
function numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convert(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    }

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = convert(rupees) + ' Rupees';
    if (paise > 0) result += ' And ' + convert(paise) + ' Paise';
    result += ' Only';
    return result;
}

/**
 * Generate PDF invoice buffer
 */
async function generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 30 });
            const buffers = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = doc.page.width - 60; // 30 margin each side
            const leftX = 30;
            const rightEdge = leftX + pageWidth;
            let y = 30;

            // ═══════════════ HEADER WITH LOGO ═══════════════
            let logoLoaded = false;
            try {
                if (fs.existsSync(LOGO_PATH)) {
                    doc.image(LOGO_PATH, leftX, y, { width: 55, height: 55 });
                    logoLoaded = true;
                }
            } catch (e) { /* skip logo on error */ }

            const headerTextX = logoLoaded ? leftX + 65 : leftX;

            // Company name
            doc.font('Helvetica-Bold').fontSize(14).fillColor(GREEN_DARK)
                .text(COMPANY.name, headerTextX, y, { width: pageWidth * 0.55 });
            y += 18;

            doc.font('Helvetica').fontSize(7.5).fillColor(GRAY);
            doc.text(COMPANY.address, headerTextX, y, { width: pageWidth * 0.55 }); y += 10;
            doc.text(COMPANY.city, headerTextX, y, { width: pageWidth * 0.55 }); y += 10;
            doc.text(`Phone - ${COMPANY.phone}`, headerTextX, y, { width: pageWidth * 0.55 }); y += 10;
            doc.text(`Email: ${COMPANY.email}`, headerTextX, y, { width: pageWidth * 0.55 }); y += 10;
            doc.text(`GSTIN - ${COMPANY.gstin}`, headerTextX, y, { width: pageWidth * 0.55 }); y += 5;

            // TAX INVOICE label (right side)
            const invoiceY = 30;
            doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN_DARK)
                .text('TAX INVOICE', rightEdge - 200, invoiceY, { width: 200, align: 'right' });

            // Invoice details (right side)
            const detailsY = invoiceY + 28;
            const labelX = rightEdge - 200;
            const valueX = rightEdge - 90;

            doc.font('Helvetica').fontSize(8).fillColor(GRAY);
            doc.text('Invoice Number', labelX, detailsY);
            doc.font('Helvetica-Bold').fillColor(BLACK).text(order.invoiceNumber || 'N/A', valueX, detailsY);

            doc.font('Helvetica').fillColor(GRAY).text('Order Number', labelX, detailsY + 14);
            doc.font('Helvetica-Bold').fillColor(BLACK).text(order.orderNumber, valueX, detailsY + 14);

            doc.font('Helvetica').fillColor(GRAY).text('Invoice Date', labelX, detailsY + 28);
            const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.font('Helvetica-Bold').fillColor(BLACK).text(invoiceDate, valueX, detailsY + 28);

            y = Math.max(y, detailsY + 50) + 10;

            // Separator line
            doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor(GREEN_DARK).lineWidth(1.5).stroke();
            y += 10;

            // ═══════════════ BILL TO ═══════════════
            doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN_DARK).text('BILL TO', leftX, y);
            y += 14;

            const addr = order.shippingAddress;
            const userName = order.user?.name || 'Customer';
            const userPhone = order.user?.phone || '';

            doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(userName.toUpperCase(), leftX, y);
            y += 12;
            if (userPhone) { doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(userPhone, leftX, y); y += 11; }
            if (addr) {
                const addrParts = [addr.line1, addr.line2, `${addr.city}, Dist : ${addr.city}`, `${addr.city} ${addr.state} ${addr.pincode}`].filter(Boolean);
                addrParts.forEach(line => {
                    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(line, leftX, y);
                    y += 11;
                });
            }

            y += 8;

            // ═══════════════ PRODUCT TABLE ═══════════════
            const colWidths = {
                num: 22, product: 145, hsn: 55, qty: 40,
                mrp: 52, disc: 42, rate: 58, tax: 48, amount: 63,
            };

            const cols = [
                { key: 'num', label: '#', align: 'center' },
                { key: 'product', label: 'Product/Service', align: 'left' },
                { key: 'hsn', label: 'HSN', align: 'center' },
                { key: 'qty', label: 'Qty', align: 'center' },
                { key: 'mrp', label: 'MRP', align: 'right' },
                { key: 'disc', label: 'Disc.', align: 'center' },
                { key: 'rate', label: 'Rate', align: 'right' },
                { key: 'tax', label: 'Tax', align: 'right' },
                { key: 'amount', label: 'Amount (Rs.)', align: 'right' },
            ];

            // Header row
            doc.rect(leftX, y, pageWidth, 20).fill(GREEN_DARK);
            let colX = leftX + 3;
            cols.forEach(col => {
                doc.font('Helvetica-Bold').fontSize(7.5).fillColor(WHITE)
                    .text(col.label, colX, y + 5, { width: colWidths[col.key], align: col.align });
                colX += colWidths[col.key];
            });
            y += 20;

            // Product rows
            const items = order.items || [];
            let totalQuantity = 0;

            items.forEach((item, idx) => {
                const rowHeight = 35;
                if (idx % 2 === 0) doc.rect(leftX, y, pageWidth, rowHeight).fill(LIGHT_GRAY);

                const mrp = parseFloat(item.mrp);
                const unitPrice = parseFloat(item.unitPrice);
                const gstPercent = parseFloat(item.gstPercent);
                const quantity = item.quantity;
                const totalPrice = parseFloat(item.totalPrice);
                const discountPercent = mrp > 0 ? ((mrp - unitPrice) / mrp * 100).toFixed(2) : 0;
                const taxablePerItem = unitPrice / (1 + gstPercent / 100);
                const taxPerItem = unitPrice - taxablePerItem;
                const totalTax = taxPerItem * quantity;
                const hsn = item.product?.sku || '';
                totalQuantity += quantity;

                colX = leftX + 3;
                const rowY = y + 8;

                doc.font('Helvetica').fontSize(7.5).fillColor(BLACK)
                    .text(String(idx + 1), colX, rowY, { width: colWidths.num, align: 'center' });
                colX += colWidths.num;

                doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK)
                    .text(item.productName, colX, rowY, { width: colWidths.product, align: 'left' });
                colX += colWidths.product;

                doc.font('Helvetica').fontSize(7.5).fillColor(BLACK)
                    .text(hsn, colX, rowY, { width: colWidths.hsn, align: 'center' });
                colX += colWidths.hsn;

                doc.text(`${quantity} Pcs`, colX, rowY, { width: colWidths.qty, align: 'center' });
                colX += colWidths.qty;

                doc.text(mrp.toFixed(2), colX, rowY, { width: colWidths.mrp, align: 'right' });
                colX += colWidths.mrp;

                doc.fontSize(7).fillColor(GRAY)
                    .text(`${parseFloat(discountPercent).toFixed(2)}%`, colX, rowY, { width: colWidths.disc, align: 'center' });
                colX += colWidths.disc;

                doc.fontSize(7.5).fillColor(BLACK)
                    .text((taxablePerItem * quantity).toFixed(2), colX, rowY, { width: colWidths.rate, align: 'right' });
                colX += colWidths.rate;

                doc.text(totalTax.toFixed(2), colX, rowY, { width: colWidths.tax, align: 'right' });
                doc.fontSize(6).fillColor(GRAY)
                    .text(`(${gstPercent}%)`, colX, rowY + 10, { width: colWidths.tax, align: 'right' });
                colX += colWidths.tax;

                doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLACK)
                    .text(totalPrice.toFixed(2), colX, rowY, { width: colWidths.amount, align: 'right' });

                y += rowHeight;
            });

            // Table bottom
            doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor(BORDER).lineWidth(0.5).stroke();
            y += 10;

            // ═══════════════ SUMMARY ═══════════════
            const subtotal = parseFloat(order.subtotal);
            const gstAmount = parseFloat(order.gstAmount);
            const shippingCharge = parseFloat(order.shippingCharge);
            const discountAmount = parseFloat(order.discountAmount);
            const totalAmount = parseFloat(order.totalAmount);
            const taxableAmount = subtotal - gstAmount;
            const isCOD = order.paymentMethod === 'COD';

            const summaryRightX = rightEdge - 180;

            // Left side: Total in words
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLACK)
                .text('Total Amounts (In Words):', leftX, y);
            y += 12;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(GREEN_DARK)
                .text(numberToWords(totalAmount), leftX, y, { width: pageWidth * 0.55 });
            y += 16;
            doc.font('Helvetica').fontSize(8).fillColor(BLACK)
                .text(`Total Quantity: ${totalQuantity}`, leftX, y);

            // Right side: Tax breakdown
            let sumY = y - 28;
            const labelRX = summaryRightX;
            const valueRX = rightEdge - 60;

            const cessAmount = parseFloat(order.cessAmount || 0);
            const advanceAmount = parseFloat(order.advanceAmount || 0);

            const itemTaxTypes = new Set((order.items || []).map(i => (i.gstType || 'IGST').toUpperCase()));
            const onlyCGSTSGST = itemTaxTypes.size === 1 && itemTaxTypes.has('CGST_SGST');

            const summaryRows = [
                { label: 'Taxable Amount', value: taxableAmount.toFixed(2) },
            ];

            if (onlyCGSTSGST) {
                const half = (gstAmount / 2);
                summaryRows.push({ label: 'CGST', value: half.toFixed(2) });
                summaryRows.push({ label: 'SGST', value: half.toFixed(2) });
            } else {
                summaryRows.push({ label: 'IGST', value: gstAmount.toFixed(2) });
            }
            if (cessAmount > 0) {
                summaryRows.push({ label: 'CESS', value: cessAmount.toFixed(2) });
            }
            if (shippingCharge > 0) {
                summaryRows.push({ label: isCOD ? 'Cod Charges' : 'Shipping', value: shippingCharge.toFixed(2) });
            }
            if (discountAmount > 0) {
                summaryRows.push({ label: 'Discount', value: `-${discountAmount.toFixed(2)}` });
            }
            if (advanceAmount > 0) {
                summaryRows.push({ label: 'Advance (COD)', value: advanceAmount.toFixed(2) });
            }

            summaryRows.forEach(row => {
                doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(row.label, labelRX, sumY, { width: 100, align: 'right' });
                doc.font('Helvetica').fillColor(BLACK).text(row.value, valueRX, sumY, { width: 60, align: 'right' });
                sumY += 13;
            });

            // Total payable highlighted
            doc.rect(labelRX, sumY - 2, 180, 16).fill('#FFF3E0');
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#E65100')
                .text('Total Payable', labelRX + 5, sumY + 1, { width: 90, align: 'right' });
            doc.text(`Rs.${totalAmount.toFixed(2)}`, valueRX, sumY + 1, { width: 60, align: 'right' });
            sumY += 18;

            // Received
            doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN_DARK)
                .text('Received', labelRX + 5, sumY, { width: 90, align: 'right' });
            doc.text(`Rs. ${totalAmount.toFixed(2)}`, valueRX, sumY, { width: 60, align: 'right' });

            y = Math.max(y + 30, sumY + 25);

            // ═══════════════ FOOTER ═══════════════
            doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor(GREEN_DARK).lineWidth(1).stroke();
            y += 10;

            const halfWidth = pageWidth / 2;

            doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN_DARK).text('Notes', leftX, y);
            doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN_DARK).text('Bank Details', leftX + halfWidth + 20, y);
            y += 12;

            doc.font('Helvetica-Oblique').fontSize(7).fillColor(GRAY)
                .text('Thank You For Doing Business With Us', leftX, y, { width: halfWidth });

            doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN_DARK)
                .text('Due Amount', leftX + halfWidth + 20, y);
            doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN_DARK)
                .text('Rs. 0.00', leftX + halfWidth + 120, y);

            y += 20;

            // Terms and conditions
            doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor(GREEN_DARK).lineWidth(0.5).stroke();
            y += 8;

            doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN_DARK).text('Terms And Conditions', leftX, y);

            // ── Authorized Signatory (right side, with signature image) ──
            const sigBlockX = rightEdge - 160;
            const sigBlockY = y;

            doc.font('Helvetica').fontSize(7.5).fillColor(GRAY)
                .text('For KJN Trading Company', sigBlockX, sigBlockY, { width: 160, align: 'right' });

            // Load signature image
            try {
                if (fs.existsSync(SIGNATURE_PATH)) {
                    doc.image(SIGNATURE_PATH, sigBlockX + 60, sigBlockY + 12, { width: 80, height: 35 });
                }
            } catch (e) { /* skip signature on error */ }

            doc.font('Helvetica-Bold').fontSize(7).fillColor(GREEN_DARK)
                .text('Authorized Signatory', sigBlockX, sigBlockY + 52, { width: 160, align: 'right' });

            y += 12;

            const terms = [
                '1. Report Any Product Damage Issues Within 1 Day Of Delivery.',
                '2. Unboxing Video Should Be Must For Damage Claim.',
                '3. We Don\'t Accept Any Returns.',
                '4. If You Want To Return Product Even The Product Was Good Transport Or Courier Charges To Be Born By Your Side.',
            ];
            doc.font('Helvetica').fontSize(6.5).fillColor(GRAY);
            terms.forEach(term => {
                doc.text(term, leftX, y, { width: pageWidth * 0.55, lineGap: 1.5 });
                y += 10;
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateInvoicePDF, generateInvoiceNumber };

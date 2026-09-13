import PDFDocument from "pdfkit";
import fs from "fs";
import axios from "axios";
import { displayEventType, displayLabel } from "./displayLabel.js";
import { formatDate, formatDateTime } from "./dateTime.js";


async function loadImageAsBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

export const generateInvoicePDF = async ({ evt, totals, savePath }) => {
  const eventTimeZone =
    evt.timezone || evt.location?.timezone || "America/Indiana/Indianapolis";
  const {
    subtotal,
    gratuity,
    totalBeforeDiscount,
    discountedTotal,
    deposit,
    amountPaid = deposit,
    balanceDue,
    coupon,
    lineItems = {},
  } = totals;
  const paid = Number(amountPaid) || 0;
  const balance =
    balanceDue == null
      ? Math.max(0, (Number(discountedTotal) || 0) - paid)
      : Math.max(0, Number(balanceDue) || 0);



  const primary = "#7B0323";
  const logoUrl = "https://res.cloudinary.com/dv3c5vntb/image/upload/v1765477575/logo_gjvrqr.png";

    const logo = await loadImageAsBuffer(logoUrl);


  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(savePath);
      doc.pipe(stream);

      // Logo
      doc.image(logo, 50, 40, { width: 130 });

      doc
        .fillColor(primary)
        .fontSize(26)
        .text("Invoice", 50, 120);

      doc
        .moveDown()
        .fontSize(12)
        .fillColor("#333")
        .text(`Event #${evt.shortCode}`)
        .text(`Client: ${evt.contact.fullName}`)
        .text(`Email: ${evt.contact.email}`)
        .text(`Date: ${formatDate(new Date(), { timeZone: eventTimeZone })}`);

      doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(primary).stroke();

      doc.moveDown().fontSize(16).fillColor(primary).text("Event Summary");
      doc.fontSize(12).fillColor("#333");
      doc.text(`Event: ${displayEventType(evt.type)}`);
      doc.text(
        `Date: ${formatDateTime(evt.startAt, {
          timeZone: eventTimeZone,
        })} – ${formatDateTime(evt.endAt, { timeZone: eventTimeZone })}`
      );
      doc.text(`Bar Type: ${displayEventType(evt.options?.barType)}`);

      doc.moveDown().fontSize(16).fillColor(primary).text("Payment Breakdown");
      doc.fontSize(12).fillColor("#000");
      doc.text(`Subtotal: $${subtotal.toFixed(2)}`);
      const pdfLine = (label, value) => {
        if (Number(value || 0) !== 0) doc.text(`${label}: $${Number(value).toFixed(2)}`);
      };
      pdfLine("Hourly Labor", lineItems.hourlyLabor);
      pdfLine("Booking Fee", lineItems.bookingFee);
      pdfLine("Procurement Service Fee", lineItems.procurementFee);
      pdfLine("Public Event Fee", lineItems.publicFee);
      pdfLine("Holiday Fee", lineItems.holidayFee);
      pdfLine("Gratuity", lineItems.gratuity ?? gratuity);
      pdfLine("Rush Fee", lineItems.rush);
      pdfLine("Tax", lineItems.tax);
      doc.text(`Total Before Discounts: $${totalBeforeDiscount.toFixed(2)}`);
      if (coupon) {
        doc.text(`Coupon Applied: ${coupon.code} (${displayLabel(coupon.type)}) — saved $${coupon.amountOffTotal.toFixed(2)}`);
      }
      doc.text(`Total After Discounts: $${discountedTotal.toFixed(2)}`);
      doc.text(`Amount Paid: $${paid.toFixed(2)}`);
      doc.text(`Balance Due: $${balance.toFixed(2)}`);

      doc.end();

      stream.on("finish", () => resolve(savePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

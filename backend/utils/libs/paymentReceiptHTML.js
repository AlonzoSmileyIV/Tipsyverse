import { displayEventType, displayLabel } from "./displayLabel.js";

export const paymentReceiptHTML = ({
  evt,
  intro='Thank you! Your event has been confirmed and your deposit has been authorized.',
  subtotal,
  gratuity,
  totalBeforeDiscount,
  discountedTotal,
  deposit,
  amountPaid = deposit,
  balanceDue,
  balanceDueAt,
  coupon,
  lineItems = {},
  nextStep=null
}) => {
    
  const primary = "#7B0323";

  const couponLine = coupon
    ? `<p><strong>Coupon Applied:</strong> ${coupon.code} (${displayLabel(coupon.type)}) — saved $${coupon.amountOffTotal.toFixed(
        2
      )}</p>`
    : "";
  const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;
  const eventTimezone =
    evt.timezone ||
    evt.location?.timezone ||
    "America/Indiana/Indianapolis";
  const dateTime = (value) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: eventTimezone,
    }).format(new Date(value));
  const zoneName = (value) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      timeZone: eventTimezone,
      timeZoneName: "short",
    })
      .formatToParts(new Date(value))
      .find((part) => part.type === "timeZoneName")?.value || eventTimezone;
  const paid = Number(amountPaid) || 0;
  const balance =
    balanceDue == null
      ? Math.max(0, (Number(discountedTotal) || 0) - paid)
      : Math.max(0, Number(balanceDue) || 0);
  const itemLine = (label, value) =>
    Number(value || 0) !== 0 ? `<p><strong>${label}:</strong> ${money(value)}</p>` : "";

  return `
  <div style="background:#f4f4f7;padding:30px;font-family:Arial,sans-serif;">
    <div style="max-width:650px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">

      <!-- HEADER -->
      <div style="background:${primary};padding:25px;text-align:center;">
        <h2 style="color:#fff;margin:0;font-size:26px;">Payment Receipt</h2>
      </div>

      <!-- BODY -->
      <div style="padding:30px;font-size:16px;color:#333;">
        <p>Hi ${evt.contact.fullName},</p>
        <p>${intro}</p>

        <h3 style="margin-top:25px;color:${primary}">Event Summary</h3>
        <p><strong>Event:</strong> ${displayEventType(evt.type)}</p>
        <p><strong>Date:</strong> ${dateTime(evt.startAt)} – ${dateTime(
    evt.endAt
  )} ${zoneName(evt.startAt)}</p>
        <p><strong>Bar Type:</strong> ${displayEventType(evt.options?.barType)}</p>

        <h3 style="margin-top:25px;color:${primary}">Payment Breakdown</h3>
        <p><strong>Subtotal:</strong> ${money(subtotal)}</p>
        ${itemLine("Hourly Labor", lineItems.hourlyLabor)}
        ${itemLine("Booking Fee", lineItems.bookingFee)}
        ${itemLine("Procurement Service Fee", lineItems.procurementFee)}
        ${itemLine("Public Event Fee", lineItems.publicFee)}
        ${itemLine("Holiday Fee", lineItems.holidayFee)}
        ${itemLine("Gratuity", lineItems.gratuity ?? gratuity)}
        ${itemLine("Rush Fee", lineItems.rush)}
        ${itemLine("Tax", lineItems.tax)}
        <p><strong>Total Before Discounts:</strong> ${money(totalBeforeDiscount)}</p>
        ${couponLine}
        <p><strong>Total After Discounts:</strong> ${money(discountedTotal)}</p>
        <p><strong>Amount Paid:</strong> ${money(paid)}</p>
        <p><strong>Balance Due:</strong> ${money(balance)}</p>
        ${balanceDueAt ? `<p><strong>Balance Due Date:</strong> ${dateTime(balanceDueAt)} ${zoneName(balanceDueAt)}</p>` : ""}
        
        ${
            nextStep && `<h3 style="margin-top:25px;color:${primary}">Next Steps</h3>
        <p>${nextStep}</p>`
        }

        <p style="margin-top:25px;">— The Tipsyverse Team</p>
      </div>

      <!-- FOOTER -->
      <div style="background:#f0f0f0;padding:18px;text-align:center;font-size:12px;color:#666;">
        <p>This is an automated message. Need help? Email <a href="mailto:support@tipsyverse.com" style="color:${primary};font-weight:bold;">support@tipsyverse.com</a></p>
        <p>© ${new Date().getFullYear()} Tipsyverse</p>
      </div>

    </div>
  </div>`;
};


import { displayEventType } from "./displayLabel.js";

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeProcurementItems = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          name: item?.name || item?.item || item?.label || item?.title || "",
          qty: Number(item?.qty) || 1,
        }))
        .filter((item) => String(item.name || "").trim())
    : [];

const paymentBalance = (evt, fallbackTotal) => {
  const payment = evt?.payment || {};
  if (Number.isFinite(Number(payment.balance))) return Number(payment.balance);
  if (Number.isFinite(Number(payment.total))) return Number(payment.total);
  return Number(fallbackTotal) || 0;
};

const getBartenderName = (u) =>
  u?.bartenderProfile?.stageName ||
  u?.fullName ||
  u?.fullname ||
  u?.name ||
  "Bartender";

function buildEventUpdatedEmail({
  evt,
  beforeTotals,
  afterTotals,
  beforeDoc,
  afterDoc,
  changes,
}) {
  const beforeEvent = beforeDoc || {};
  const afterEvent = afterDoc || evt || {};
  const oldTotal = paymentBalance(beforeEvent, beforeTotals.total);
  const newTotal = paymentBalance(afterEvent, afterTotals.total);
  const delta = newTotal - oldTotal;
  const oldProcurementCost =
    Number(beforeEvent.options?.procurementActualCost) || 0;
  const newProcurementCost =
    Number(afterEvent.options?.procurementActualCost) || 0;
  const procurementDelta =
    Math.round((newProcurementCost - oldProcurementCost) * 100) / 100;
  const procurementItems = normalizeProcurementItems(
    afterEvent.options?.procurementItems
  );
  const receiptProof = afterEvent.options?.procurementReceiptProof || "";
  const procurementBillingHtml =
    procurementDelta > 0
      ? `
        <h3>Items We Picked Up</h3>
        <p>We picked up the following items for your event and added the receipt total to your balance:</p>
        ${
          procurementItems.length
            ? `
              <ul>
                ${procurementItems
                  .map(
                    (item) =>
                      `<li><b>${Number(item.qty) || 1}</b> × ${escapeHtml(
                        item.name
                      )}</li>`
                  )
                  .join("")}
              </ul>
            `
            : "<p>No itemized pickup list was recorded.</p>"
        }
        <ul>
          <li>Pickup receipt total: <b>${money(newProcurementCost)}</b></li>
          ${
            procurementDelta !== newProcurementCost
              ? `<li>Amount added to this balance update: <b>${money(
                  procurementDelta
                )}</b></li>`
              : ""
          }
          ${
            receiptProof
              ? `<li>Receipt proof: <a href="${escapeHtml(
                  receiptProof
                )}">View receipt</a></li>`
              : "<li>Receipt proof: Not provided</li>"
          }
        </ul>
      `
      : "";

  const when = `${new Date(evt.startAt).toLocaleString()} → ${new Date(
    evt.endAt
  ).toLocaleString()}`;

  const addr =
    evt.location?.formatted ||
    [evt.location?.address1, evt.location?.city, evt.location?.state, evt.location?.zipcode]
      .filter(Boolean)
      .join(", ");

  // ✅ choose a source
  const bartenderUsers =
    (Array.isArray(evt.assignedBartenders) && evt.assignedBartenders.length
      ? evt.assignedBartenders
      : Array.isArray(evt.preferredBartenders)
      ? evt.preferredBartenders
      : []) || [];

  const bartenderNames = bartenderUsers
    .map(getBartenderName)
    .filter(Boolean);

  const bartendersHtml =
    bartenderNames.length > 0
      ? `
        <h3>Bartenders</h3>
        <ul>
          ${bartenderNames.map((n) => `<li>${n}</li>`).join("")}
        </ul>
      `
      : ""; // don’t show section if none

  const subject = `Tipsyverse - Update to your Tipsyverse event (${evt.shortCode || evt._id})`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.4;">
      <h2>Event updated</h2>
      <p>Hi ${evt.contact?.fullName || "there"},</p>
      <p>We updated your event details. Here’s the latest summary:</p>

      <ul>
        <li><b>When:</b> ${when}</li>
        <li><b>Where:</b> ${addr || "—"}</li>
        <li><b>Event type:</b> ${displayEventType(evt.type, "—")}</li>
      </ul>

      ${bartendersHtml}

      <h3>Pricing</h3>
      <ul>
        <li>Old balance: <b>${money(oldTotal)}</b></li>
        <li>Current balance: <b>${money(newTotal)}</b></li>
        <li>${delta >= 0 ? "Increased" : "Decreased"} by: <b>${money(Math.abs(delta))}</b></li>
      </ul>

      ${procurementBillingHtml}

      <p>If you have any questions, reply to this email and we’ll help.</p>
      <p>— Tipsyverse</p>
    </div>
  `;

  const procurementText =
    procurementDelta > 0
      ? `\nItems picked up:\n${procurementItems
          .map((item) => `- ${Number(item.qty) || 1} x ${item.name}`)
          .join("\n") || "- No itemized pickup list recorded"}\nReceipt total: ${money(
          newProcurementCost
        )}${
          procurementDelta !== newProcurementCost
            ? `\nAmount added to this balance update: ${money(
                procurementDelta
              )}`
            : ""
        }\nReceipt proof: ${receiptProof || "Not provided"}`
      : "";

  return {
    subject,
    html,
    text: `Old balance: ${money(oldTotal)}\nCurrent balance: ${money(
      newTotal
    )}\nDifference: ${money(delta)}${procurementText}`,
  };
}

export default buildEventUpdatedEmail;

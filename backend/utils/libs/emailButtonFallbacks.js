const BUTTON_CLASS_PATTERN = /(?:^|\s)button(?:\s|$)/i;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readAttribute = (attributes, name) => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i")
  );
  return match?.[2] || "";
};

const isButtonAnchor = (attributes) => {
  const className = readAttribute(attributes, "class");
  const style = readAttribute(attributes, "style");
  const role = readAttribute(attributes, "role");

  return (
    BUTTON_CLASS_PATTERN.test(className) ||
    role.toLowerCase() === "button" ||
    (/display\s*:\s*inline-block/i.test(style) &&
      /background(?:-color)?\s*:/i.test(style))
  );
};

export const appendEmailButtonFallbacks = (html = "") => {
  const content = String(html || "");
  const urls = [];
  const anchorPattern = /<a\b([^>]*)>/gi;

  for (const match of content.matchAll(anchorPattern)) {
    const attributes = match[1] || "";
    if (!isButtonAnchor(attributes)) continue;

    const url = readAttribute(attributes, "href").trim();
    if (!/^https?:\/\//i.test(url) || urls.includes(url)) continue;
    urls.push(url);
  }

  if (!urls.length) return content;

  const fallbacks = urls
    .map((url) => {
      const safeUrl = escapeHtml(url);
      return `<p style="margin:12px 0;overflow-wrap:anywhere;word-break:break-word;">If the button doesn&rsquo;t work, use this URL: <a href="${safeUrl}" style="color:#7B0323;text-decoration:underline;">${safeUrl}</a></p>`;
    })
    .join("");

  return `${content}<div class="button-url-fallbacks" style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;">${fallbacks}</div>`;
};

export default appendEmailButtonFallbacks;

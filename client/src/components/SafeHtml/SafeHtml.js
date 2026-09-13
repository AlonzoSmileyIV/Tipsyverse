import DOMPurify from "dompurify";

export default function SafeHtml({ html = "", as: Component = "div", ...props }) {
  const sanitized = DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style"],
  });
  return <Component {...props} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

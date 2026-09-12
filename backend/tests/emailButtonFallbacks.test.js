import test from "node:test";
import assert from "node:assert/strict";
import { appendEmailButtonFallbacks } from "../utils/libs/emailButtonFallbacks.js";

test("adds a fallback URL for class-based email buttons", () => {
  const html = appendEmailButtonFallbacks(
    '<p><a href="https://tipsyverse.test/events/123" class="button">Open Event</a></p>'
  );

  assert.match(html, /If the button doesn&rsquo;t work, use this URL:/);
  assert.equal((html.match(/https:\/\/tipsyverse\.test\/events\/123/g) || []).length, 3);
});

test("adds fallbacks for inline-styled buttons and deduplicates their URLs", () => {
  const html = appendEmailButtonFallbacks(`
    <a href="https://tipsyverse.test/schedule" style="display:inline-block;background:#800020;">Schedule</a>
    <a href="https://tipsyverse.test/schedule" class="button">Schedule again</a>
  `);

  assert.equal((html.match(/If the button doesn&rsquo;t work/g) || []).length, 1);
});

test("does not add fallbacks for ordinary links or email addresses", () => {
  const source = `
    <a href="https://tipsyverse.test/privacy">Privacy</a>
    <a href="mailto:support@tipsyverse.com" class="button">Email support</a>
  `;

  assert.equal(appendEmailButtonFallbacks(source), source);
});

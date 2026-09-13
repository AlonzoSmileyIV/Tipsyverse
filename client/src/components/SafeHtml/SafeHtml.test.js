import { render } from "@testing-library/react";
import SafeHtml from "./SafeHtml";

test("removes executable markup and unsafe attributes", () => {
  const { container } = render(
    <SafeHtml html={'<img src="x" onerror="alert(1)"><script>alert(2)</script><b>safe</b>'} />
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).not.toHaveAttribute("onerror");
  expect(container.querySelector("b")).toHaveTextContent("safe");
});

test("forbids embedded frames, forms, and inline styles", () => {
  const { container } = render(
    <SafeHtml html={'<iframe src="https://evil.invalid"></iframe><form></form><p style="color:red">text</p>'} />
  );
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector("p")).not.toHaveAttribute("style");
});

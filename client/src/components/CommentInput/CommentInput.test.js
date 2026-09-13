import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentInput from "./CommentInput";

test("loads legacy Draft raw text without mounting Draft.js", () => {
  render(
    <CommentInput
      isEditing
      initialRawContent={{
        blocks: [
          { key: "a", text: "Legacy first line" },
          { key: "b", text: "Legacy second line" },
        ],
        entityMap: {},
      }}
      onSubmit={() => {}}
    />
  );

  expect(screen.getByRole("textbox")).toHaveValue(
    "Legacy first line\nLegacy second line"
  );
});

test("submits stable plain text and selected mentions", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <CommentInput
      loggedInUserId="current"
      mentionUserData={[
        { _id: "mentioned", username: "jane", profile: {} },
      ]}
      onSubmit={onSubmit}
    />
  );

  const input = screen.getByRole("textbox");
  await user.type(input, "Hello @ja");
  await user.click(screen.getByText("@jane"));
  await user.type(input, "welcome!");
  fireEvent.click(screen.getByRole("button", { name: "Send comment" }));

  expect(onSubmit).toHaveBeenCalledWith({
    text: "Hello @jane welcome!",
    mentions: [{ userId: "mentioned", username: "jane" }],
  });
});

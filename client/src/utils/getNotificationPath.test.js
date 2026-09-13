import getNotificationPath from "./getNotificationPath";

describe("getNotificationPath", () => {
  it("opens a newly created assignment notification on event attendance", () => {
    expect(
      getNotificationPath({
        type: "event_bartenders_selected",
        slug: "my-events/event-1/attendance",
        entity: { _id: "event-1" },
      })
    ).toBe("/my-events/event-1/attendance");
  });

  it("deep-links older assignment notifications that only stored my-events", () => {
    expect(
      getNotificationPath({
        type: "event_bartenders_selected",
        slug: "my-events",
        entity: { _id: "event-1" },
      })
    ).toBe("/my-events/event-1/attendance");
  });

  it("keeps entity slugs for drink and comment notifications", () => {
    expect(
      getNotificationPath({ slug: "drinks", entity: { slug: "aperol-spritz" } })
    ).toBe("/drinks/aperol-spritz");
  });
});

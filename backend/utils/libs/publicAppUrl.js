export const publicAppUrl = (env = process.env) => {
  const configured =
    env.PUBLIC_APP_URL || env.FRONTEND_URL || "http://localhost:3000";

  try {
    const url = new URL(configured);
    if (url.hostname === "tipsyverse.com") {
      url.hostname = "www.tipsyverse.com";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(configured).replace(/\/$/, "");
  }
};

export const customerEventUrl = (eventId, path = "details", env = process.env) =>
  `${publicAppUrl(env)}/my-events/${eventId}/${path}`;

export const adminEventUrl = (eventId, env = process.env) =>
  `${publicAppUrl(env)}/admin/events?eventId=${eventId}`;

const trimSlashes = (value = "") => String(value).replace(/^\/+|\/+$/g, "");

export const getNotificationPath = (notification = {}) => {
  const baseSlug = trimSlashes(notification.slug);
  const entity = notification.entity;
  const entityId = entity?._id || notification.entityId ||
    (typeof entity === "string" ? entity : "");

  // Older bartender-selection notifications only stored `my-events`. Keep
  // those useful after the backend starts writing the complete deep link.
  if (
    notification.type === "event_bartenders_selected" &&
    entityId &&
    !/^my-events\/[^/]+/.test(baseSlug)
  ) {
    return `/my-events/${entityId}/attendance`;
  }

  const entitySlug = trimSlashes(entity?.slug);
  const comment = notification.comment;
  const commentId = comment?.parentComment?._id || comment?._id;
  const query = commentId ? `?commentId=${commentId}` : "";
  const path = entitySlug ? `${baseSlug}/${entitySlug}` : baseSlug;

  return path ? `/${path}${query}` : "";
};

export default getNotificationPath;

export const buildNestedComments = (flatComments) => {
  const map = {};
  const roots = [];

  flatComments.forEach((c) => {
    map[c._id] = { ...c.toObject?.() || c, replies: [] };
  });

  flatComments.forEach((c) => {
    const parentIds = c?.analytics?.userReplies || [];

    parentIds.forEach((replyId) => {
      const reply = map[replyId];
      if (reply) {
        map[c._id].replies.push(reply);
      }
    });
  });

  // Only top-level comments are those not included as replies in any comment
  const replyIds = new Set(flatComments.flatMap(c => c.analytics?.userReplies || []));
  flatComments.forEach((c) => {
    if (!replyIds.has(c._id)) {
      roots.push(map[c._id]);
    }
  });

  return roots;
};

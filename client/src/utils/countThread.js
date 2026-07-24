// src/utils/countThread.js
export function countThreaded(source = []) {
  if (!Array.isArray(source)) return 0;

  // normalize to an array of comment nodes
  const nodes = source
    .map((item) => (item?.comment ? item.comment : item))
    .filter(Boolean);

  let total = 0;
  const walk = (arr) => {
    for (const n of arr || []) {
      total += 1;
      const replies = n?.analytics?.userReplies;
      if (Array.isArray(replies) && replies.length) walk(replies);
    }
  };

  walk(nodes);
  return total;
}

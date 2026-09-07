const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
};

const sameDefinition = (index, keys, options) =>
  JSON.stringify(stableValue(index.key)) === JSON.stringify(stableValue(keys)) &&
  Boolean(index.unique) === Boolean(options.unique) &&
  JSON.stringify(stableValue(index.partialFilterExpression || null)) ===
    JSON.stringify(stableValue(options.partialFilterExpression || null));

export const ensureMongoIndex = async (collection, keys, options = {}) => {
  const indexes = await collection.indexes();
  const equivalent = indexes.find((index) =>
    sameDefinition(index, keys, options)
  );
  if (equivalent) {
    return { name: equivalent.name, created: false };
  }

  const name = await collection.createIndex(keys, options);
  return { name, created: true };
};

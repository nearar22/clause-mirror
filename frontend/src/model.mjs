export const shortAddress = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
export const tone = value => ({ ALIGNED: "mint", REVIEW: "amber", BLOCKED: "red", FINAL: "ink" }[value] || "paper");
export const clean = value => value instanceof Map
  ? Object.fromEntries([...value].map(([key, item]) => [key, clean(item)]))
  : Array.isArray(value) ? value.map(clean)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]))
  : typeof value === "bigint" ? Number(value) : value;
export function nextActions(record, account) {
  if (!record) return [];
  const actor = (account || "").toLowerCase();
  if (record.status === "READY") return ["assess"];
  if (record.status === "ASSESSED" && actor === record.reviewer) return ["revision", "finalize"];
  if (record.status === "REVISION_REQUESTED" && actor === record.owner) return ["replace"];
  return [];
}

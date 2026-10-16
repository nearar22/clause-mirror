export const shortAddress = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
export const tone = value => ({ ALIGNED: "mint", AWAITING_SIGNOFF: "mint", RELEASE_AUTHORIZED: "mint", RELEASED: "mint", REVIEW: "amber", REVISION_REQUIRED: "amber", BLOCKED: "red", REJECTED: "red" }[value] || "paper");
export const clean = value => value instanceof Map
  ? Object.fromEntries([...value].map(([key, item]) => [key, clean(item)]))
  : Array.isArray(value) ? value.map(clean)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]))
  : typeof value === "bigint" ? Number(value) : value;
export function nextActions(record, account) {
  if (!record) return [];
  const actor = (account || "").toLowerCase();
  const owner = (record.owner || "").toLowerCase();
  const reviewer = (record.reviewer || "").toLowerCase();
  if (record.status === "EVIDENCE_PENDING") return ["freeze"];
  if (record.status === "FROZEN") return ["assess"];
  if (record.status === "REVISION_REQUIRED" && actor === reviewer) return ["revision"];
  if (record.status === "REVISION_REQUIRED" && actor === owner) return ["replace"];
  if (record.status === "AWAITING_SIGNOFF" && actor === reviewer) return ["finalize"];
  if (record.status === "RELEASE_AUTHORIZED" && actor === owner) return ["release"];
  return [];
}

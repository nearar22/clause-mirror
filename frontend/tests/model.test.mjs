import test from "node:test";
import assert from "node:assert/strict";
import { clean, nextActions, shortAddress, tone } from "../src/model.mjs";

test("cleans maps and bigint values returned by the SDK", () => {
  assert.deepEqual(clean(new Map([["revision", 2n]])), { revision: 2 });
});

test("derives role-bound actions from lifecycle state", () => {
  const record = { status: "REVISION_REQUIRED", owner: "0xaaa", reviewer: "0xbbb" };
  assert.deepEqual(nextActions({ ...record, status: "EVIDENCE_PENDING" }, ""), ["freeze"]);
  assert.deepEqual(nextActions({ ...record, status: "FROZEN" }, ""), ["assess"]);
  assert.deepEqual(nextActions(record, "0xBbB"), ["revision"]);
  assert.deepEqual(nextActions(record, "0xAaA"), ["replace"]);
  assert.deepEqual(nextActions({ ...record, status: "AWAITING_SIGNOFF" }, "0xBbB"), ["finalize"]);
  assert.deepEqual(nextActions({ ...record, status: "RELEASE_AUTHORIZED" }, "0xAaA"), ["release"]);
  assert.deepEqual(nextActions({ ...record, status: "RELEASED" }, "0xAaA"), []);
});

test("display helpers are stable", () => {
  assert.equal(shortAddress("0x1234567890abcdef"), "0x1234…cdef");
  assert.equal(tone("BLOCKED"), "red");
});

import test from "node:test";
import assert from "node:assert/strict";
import { clean, nextActions, shortAddress, tone } from "../src/model.mjs";

test("cleans maps and bigint values returned by the SDK", () => {
  assert.deepEqual(clean(new Map([["revision", 2n]])), { revision: 2 });
});

test("derives role-bound actions from lifecycle state", () => {
  const record = { status: "ASSESSED", owner: "0xaaa", reviewer: "0xbbb" };
  assert.deepEqual(nextActions(record, "0xBbB"), ["revision", "finalize"]);
  assert.deepEqual(nextActions(record, "0xaaa"), []);
  assert.deepEqual(nextActions({ ...record, status: "REVISION_REQUESTED" }, "0xAaA"), ["replace"]);
});

test("display helpers are stable", () => {
  assert.equal(shortAddress("0x1234567890abcdef"), "0x1234…cdef");
  assert.equal(tone("BLOCKED"), "red");
});

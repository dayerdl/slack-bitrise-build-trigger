import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReleaseToTsvContent,
  deleteReleaseFromTsvContent,
  parsePipeKeyValues,
  ReleaseMutationError,
} from "./releaseMutation.js";

test("parsePipeKeyValues", () => {
  const obj = parsePipeKeyValues("| client:moa | version:1.0.0 | date:2026-05-04 | env:prod |");
  assert.equal(obj.client, "moa");
  assert.equal(obj.version, "1.0.0");
  assert.equal(obj.env, "prod");
});

test("append and delete round-trip", () => {
  const start = `client\tversion\tdate\tenv\tstatus\tnotes
A\t1\t2025-01-01	p	s	`;

  const row = {
    client: "B",
    version: "2",
    date: "2025-02-02",
    env: "stage",
    status: "",
    notes: "x",
  };

  const added = appendReleaseToTsvContent(start, row);
  const rowsAfterAdd = added.split("\n").filter(Boolean).length;
  assert.ok(rowsAfterAdd >= 3);

  const removed = deleteReleaseFromTsvContent(added, "B", "2");
  assert.ok(!removed.includes("\tB\t2\t"));
});

test("append duplicate throws", () => {
  const start = `client\tversion\tdate\tenv\tstatus\tnotes
A\t1\t2025-01-01	p	s	`;

  assert.throws(
    () =>
      appendReleaseToTsvContent(start, {
        client: "A",
        version: "1",
        date: "x",
        env: "y",
        status: "",
        notes: "",
      }),
    ReleaseMutationError
  );
});

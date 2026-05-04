import assert from "node:assert/strict";
import test from "node:test";

import { groupReleasesByClient, parseClientReleasesTsv } from "./clientReleases.js";

test("parses TSV rows", () => {
  const rows = parseClientReleasesTsv(`client	version	date	env	status	notes
Alpha	1.0.0	2025-01-01	prod	released	note a
Beta	2.0.0	2025-02-01	stage		note with	tab`);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].client, "Alpha");
  assert.equal(rows[1].notes, "note with	tab");
});

test("groups and sorts by client and date desc", () => {
  const rows = parseClientReleasesTsv(`client	version	date	env	status	notes
Zoo	1.0.0	2025-01-01	prod	r	
Zoo	2.0.0	2025-06-01	prod	r	
Aardvark	1.0.0	2025-03-01	stage	r	`);

  const { clients, byClient } = groupReleasesByClient(rows);

  assert.deepEqual(clients, ["Aardvark", "Zoo"]);
  assert.equal(byClient.get("Zoo")[0].version, "2.0.0");
});

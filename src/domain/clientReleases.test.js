import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConiqCatalogSections,
  filterRowsByClientQuery,
  groupReleasesByClient,
  parseClientReleasesTsv,
} from "./clientReleases.js";

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

test("filterRowsByClientQuery exact then partial", () => {
  const rows = parseClientReleasesTsv(`client	version	date	env	status	notes
Foo Bar	1.0.0	2025-01-01	prod	r	
Foo Baz	2.0.0	2025-02-01	prod	r	`);

  const exact = filterRowsByClientQuery(rows, "Foo Bar");
  assert.equal(exact.length, 1);
  assert.equal(exact[0].client, "Foo Bar");

  const partial = filterRowsByClientQuery(rows, "Foo");
  assert.equal(partial.length, 2);
});

test("filterRowsByClientQuery resolves Coniq slug via catalog", () => {
  const rows = [
    { client: "Mall of America", version: "1", date: "", env: "", status: "", notes: "" },
    { client: "Other", version: "2", date: "", env: "", status: "", notes: "" },
  ];
  const catalog = {
    slugs: ["moa", "other"],
    slugToTsv: { moa: "Mall of America", other: null },
  };
  const out = filterRowsByClientQuery(rows, "moa", catalog);
  assert.equal(out.length, 1);
  assert.equal(out[0].client, "Mall of America");
});

test("buildConiqCatalogSections includes orphan TSV clients", () => {
  const rows = parseClientReleasesTsv(`client	version	date	env	status	notes
Mall of America	1	2025-01-01	prod	r	
OWA	2	2025-01-02	prod	r	`);
  const slugToTsv = { moa: "Mall of America" };
  const sec = buildConiqCatalogSections(rows, ["moa"], slugToTsv);
  assert.equal(sec.length, 2);
  assert.equal(sec[0].kind, "coniq");
  assert.equal(sec[1].kind, "orphan");
  assert.equal(sec[1].tsvName, "OWA");
});

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  type DirectoryLodge,
  normalizeMailroomProposal,
} from "./mailroom-proposal.ts";

const directory: DirectoryLodge[] = [{
  id: "11111111-1111-4111-8111-111111111111",
  district_name: "Ottawa District 1",
  name: "Example Lodge",
  lodge_number: "123",
  aliases: ["Example"],
  location: "Ottawa",
}];

Deno.test("outside-scope material remains held", () => {
  const proposal = normalizeMailroomProposal({
    publication_target: "district",
    source_scope: "outside_scope",
    classification_tags: ["district_event"],
    warnings: [],
    events: [],
    announcements: [],
    library_items: [],
  }, directory, []);
  assertEquals(proposal.publication_target, "hold");
  assertStringIncludes((proposal.warnings as string[]).join(" "), "outside");
});

Deno.test("unknown visiting lodge IDs are removed", () => {
  const proposal = normalizeMailroomProposal({
    publication_target: "district",
    source_scope: "district_1",
    classification_tags: ["district_summons"],
    summons: { destination: "district", district_lodge_id: "not-approved" },
    warnings: [],
    events: [],
    announcements: [],
    library_items: [],
  }, directory, []);
  assertEquals((proposal.summons as Record<string, unknown>).district_lodge_id, null);
  assertStringIncludes((proposal.warnings as string[]).join(" "), "approved directory");
});

Deno.test("educational items require a fresh rights review", () => {
  const proposal = normalizeMailroomProposal({
    publication_target: "carleton",
    source_scope: "carleton",
    classification_tags: ["library_item"],
    warnings: [],
    events: [],
    announcements: [],
    library_items: [{
      title: "Education",
      source_file_name: "paper.pdf",
      rights_reviewed: true,
      include_in_lodge_guide: true,
    }],
  }, directory, [{ file_name: "paper.pdf", storage_path: "mailroom/id/paper.pdf" }]);
  const item = (proposal.library_items as Array<Record<string, unknown>>)[0];
  assertEquals(item.rights_reviewed, false);
  assertEquals(item.include_in_lodge_guide, false);
  assertEquals(item.source_storage_path, "mailroom/id/paper.pdf");
});

Deno.test("memorial service events remain outside Lodge Guide", () => {
  const proposal = normalizeMailroomProposal({
    publication_target: "carleton",
    source_scope: "carleton",
    classification_tags: ["memorial_notice"],
    warnings: [],
    summons: null,
    events: [{
      destination: "carleton",
      is_memorial_service: true,
      visibility: "public",
      include_in_lodge_guide: true,
    }],
    announcements: [],
    library_items: [],
  }, directory, []);
  const event = (proposal.events as Array<Record<string, unknown>>)[0];
  assertEquals(event.visibility, "members");
  assertEquals(event.include_in_lodge_guide, false);
});

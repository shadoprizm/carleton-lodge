import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  type DirectoryLodge,
  mailroomExtractionSchema,
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
  const proposal = normalizeMailroomProposal(
    {
      publication_target: "district",
      source_scope: "outside_scope",
      classification_tags: ["district_event"],
      warnings: [],
      events: [],
      announcements: [],
      library_items: [],
    },
    directory,
    [],
  );
  assertEquals(proposal.publication_target, "hold");
  assertStringIncludes((proposal.warnings as string[]).join(" "), "outside");
});

Deno.test("unknown visiting lodge IDs are removed", () => {
  const proposal = normalizeMailroomProposal(
    {
      publication_target: "district",
      source_scope: "district_1",
      classification_tags: ["district_summons"],
      summons: { destination: "district", district_lodge_id: "not-approved" },
      warnings: [],
      events: [],
      announcements: [],
      library_items: [],
    },
    directory,
    [],
  );
  assertEquals(
    (proposal.summons as Record<string, unknown>).district_lodge_id,
    null,
  );
  assertStringIncludes(
    (proposal.warnings as string[]).join(" "),
    "approved directory",
  );
});

Deno.test("educational items require a fresh rights review", () => {
  const proposal = normalizeMailroomProposal(
    {
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
    },
    directory,
    [{ file_name: "paper.pdf", storage_path: "mailroom/id/paper.pdf" }],
  );
  const item = (proposal.library_items as Array<Record<string, unknown>>)[0];
  assertEquals(item.rights_reviewed, false);
  assertEquals(item.include_in_lodge_guide, false);
  assertEquals(item.source_storage_path, "mailroom/id/paper.pdf");
});

Deno.test("memorial service events remain outside Lodge Guide", () => {
  const proposal = normalizeMailroomProposal(
    {
      publication_target: "carleton",
      source_scope: "carleton",
      classification_tags: ["memorial_notice"],
      warnings: [],
      summons: null,
      events: [{
        destination: "carleton",
        is_memorial_service: true,
        visibility: "public",
        notify_members: true,
        include_in_lodge_guide: true,
      }],
      announcements: [{
        notice_type: "memorial",
        visibility: "public",
        notify_members: true,
        include_in_lodge_guide: true,
      }],
      library_items: [],
    },
    directory,
    [],
  );
  const event = (proposal.events as Array<Record<string, unknown>>)[0];
  assertEquals(event.visibility, "members");
  assertEquals(event.notify_members, false);
  assertEquals(event.include_in_lodge_guide, false);
  const announcement =
    (proposal.announcements as Array<Record<string, unknown>>)[0];
  assertEquals(announcement.visibility, "members");
  assertEquals(announcement.notify_members, false);
  assertEquals(announcement.include_in_lodge_guide, false);
});

Deno.test("mailroom action defaults are normalized before review", () => {
  const proposal = normalizeMailroomProposal(
    {
      publication_target: "mixed",
      source_scope: "district_1",
      classification_tags: [
        "carleton_summons",
        "district_event",
        "announcement",
      ],
      warnings: [],
      summons: {
        destination: "carleton",
        notify_members: false,
        include_in_lodge_guide: false,
      },
      events: [{
        destination: "district",
        district_lodge_id: directory[0].id,
        visibility: "public",
        notify_members: true,
        is_memorial_service: false,
      }],
      announcements: [{
        notice_type: "general",
        visibility: "public",
        notify_members: false,
        include_in_lodge_guide: true,
      }],
      library_items: [],
    },
    directory,
    [],
  );
  const summons = proposal.summons as Record<string, unknown>;
  const event = (proposal.events as Array<Record<string, unknown>>)[0];
  const announcement =
    (proposal.announcements as Array<Record<string, unknown>>)[0];
  assertEquals(summons.notify_members, true);
  assertEquals(summons.include_in_lodge_guide, true);
  assertEquals(event.visibility, "members");
  assertEquals(event.notify_members, false);
  assertEquals(announcement.visibility, "members");
});

Deno.test("structured-output schema avoids unsupported uniqueness keywords", () => {
  assertEquals(
    JSON.stringify(mailroomExtractionSchema).includes('"uniqueItems"'),
    false,
  );
});

import { describe, expect, it } from 'vitest';

const migrationSources = import.meta.glob(
  '/supabase/migrations/*_add_document_display_order.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const migration = Object.values(migrationSources)[0] ?? '';

const libraryPageSources = import.meta.glob(
  '/src/pages/{LibraryPage.tsx,admin/AdminLibraryPage.tsx}',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const libraryPages = Object.values(libraryPageSources);

describe('document ordering migration', () => {
  it('stores and backfills a per-category document order', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS display_order bigint');
    expect(migration).toContain('PARTITION BY category_id');
    expect(migration).toContain('assign_document_display_order');
    expect(migration).toContain('ALTER COLUMN display_order SET NOT NULL');
  });

  it('uses an RLS-bound reorder function and validates the complete category', () => {
    expect(migration).toContain('FUNCTION public.reorder_library_documents');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("has_admin_section_permission('library', 'write')");
    expect(migration).toContain('requested_document_count <> category_document_count');
    expect(migration).toContain('Document list is stale');
    expect(migration).toContain('display_order IS DISTINCT FROM requested.position - 1');
    expect(migration).toContain('TO authenticated');
  });

  it('keeps linked summons source fields protected', () => {
    expect(migration).toContain('protect_linked_summons_library_source');
    expect(migration).toContain("to_jsonb(NEW) - 'display_order'");
    expect(migration).toContain('pg_trigger_depth() = 1');
  });

  it('uses the stored order in both library views', () => {
    expect(libraryPages).toHaveLength(2);
    for (const page of libraryPages) {
      expect(page).toContain(".order('display_order', { ascending: true })");
    }
  });
});

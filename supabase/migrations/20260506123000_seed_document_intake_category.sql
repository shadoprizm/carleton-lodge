/*
  # Seed Document Intake Category

  Adds a default holding category for bulk document uploads. Admins can upload
  many documents here first, then edit each record and move it into the correct
  library category afterward.
*/

INSERT INTO public.document_categories (name, description, display_order)
SELECT
  'Needs Sorting',
  'Temporary holding area for newly uploaded documents that still need details or a final category.',
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.document_categories
  WHERE name = 'Needs Sorting'
);

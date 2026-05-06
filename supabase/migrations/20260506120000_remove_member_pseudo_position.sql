/*
  Remove the seeded "Member" pseudo-position.

  Regular roster members are represented by a NULL position_id. Officer
  positions remain in lodge_positions and continue to drive officer ordering.
*/

DELETE FROM public.lodge_positions
WHERE lower(trim(name)) = 'member';

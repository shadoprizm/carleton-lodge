/*
  # Seed Lodge Officers 2026

  ## Summary
  Adds missing officer positions and inserts all 16 current lodge officers
  with their names, phone numbers and positions.

  ## Changes

  ### Modified Tables
  - `lodge_positions` - Adds four new positions: Inner Guard, Dir. of Ceremonies,
    Immed Past Master, Ass't Secretary, and Piper, with appropriate display order.

  - `lodge_members` - Inserts 15 named officers plus one vacant Ass't Secretary row.

  ## Notes
  - Existing positions are inserted only if no row with that name already exists.
  - The "Ass't Secretary (Vacant)" entry has no phone and is flagged as visible.
  - All entries are visible to members by default.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lodge_positions WHERE name = 'Inner Guard') THEN
    INSERT INTO lodge_positions (name, display_order) VALUES ('Inner Guard', 7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lodge_positions WHERE name = 'Dir. of Ceremonies') THEN
    INSERT INTO lodge_positions (name, display_order) VALUES ('Dir. of Ceremonies', 12);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lodge_positions WHERE name = 'Immed Past Master') THEN
    INSERT INTO lodge_positions (name, display_order) VALUES ('Immed Past Master', 13);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lodge_positions WHERE name = 'Ass''t Secretary') THEN
    INSERT INTO lodge_positions (name, display_order) VALUES ('Ass''t Secretary', 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lodge_positions WHERE name = 'Piper') THEN
    INSERT INTO lodge_positions (name, display_order) VALUES ('Piper', 16);
  END IF;
END $$;

DO $$
DECLARE
  pos_wm   uuid := (SELECT id FROM lodge_positions WHERE name = 'Worshipful Master');
  pos_sw   uuid := (SELECT id FROM lodge_positions WHERE name = 'Senior Warden');
  pos_jw   uuid := (SELECT id FROM lodge_positions WHERE name = 'Junior Warden');
  pos_sd   uuid := (SELECT id FROM lodge_positions WHERE name = 'Senior Deacon');
  pos_jd   uuid := (SELECT id FROM lodge_positions WHERE name = 'Junior Deacon');
  pos_ig   uuid := (SELECT id FROM lodge_positions WHERE name = 'Inner Guard');
  pos_ss   uuid := (SELECT id FROM lodge_positions WHERE name = 'Senior Steward');
  pos_js   uuid := (SELECT id FROM lodge_positions WHERE name = 'Junior Steward');
  pos_ipm  uuid := (SELECT id FROM lodge_positions WHERE name = 'Immed Past Master');
  pos_chap uuid := (SELECT id FROM lodge_positions WHERE name = 'Chaplain');
  pos_dc   uuid := (SELECT id FROM lodge_positions WHERE name = 'Dir. of Ceremonies');
  pos_tyl  uuid := (SELECT id FROM lodge_positions WHERE name = 'Tyler');
  pos_sec  uuid := (SELECT id FROM lodge_positions WHERE name = 'Secretary');
  pos_asec uuid := (SELECT id FROM lodge_positions WHERE name = 'Ass''t Secretary');
  pos_tre  uuid := (SELECT id FROM lodge_positions WHERE name = 'Treasurer');
  pos_pip  uuid := (SELECT id FROM lodge_positions WHERE name = 'Piper');
BEGIN
  INSERT INTO lodge_members (full_name, phone, position_id, visible_to_members) VALUES
    ('W. Bro. Jace Baart',        '613-898-1786', pos_wm,   true),
    ('W. Bro. Dan Gray',          '613-286-6467', pos_sw,   true),
    ('Bro. C.S. Duff Sullivan',   '613-839-5240', pos_jw,   true),
    ('Bro. Brad Purdie',          '873-788-1435', pos_sd,   true),
    ('Bro. Daniel McLean',        '613-832-3064', pos_jd,   true),
    ('Bro. Jeramy Ratelle',       '613-985-0878', pos_ig,   true),
    ('Bro. Bruce Ricker',         '613-265-6548', pos_ss,   true),
    ('Bro. Chad Findlay',         '613-229-7420', pos_js,   true),
    ('V.W. Bro. Ken Fields',      '613-880-8383', pos_ipm,  true),
    ('W. Bro. Rick Coker',        '343-551-7118', pos_chap, true),
    ('W. Bro. Nick Beck',         '613-592-9629', pos_dc,   true),
    ('W. Bro. Sean Downey',       '613-913-9228', pos_tyl,  true),
    ('V.W. Bro. Blake Farmer',    '613-324-3272', pos_sec,  true),
    ('Ass''t Secretary (Vacant)', null,           pos_asec, true),
    ('W. Bro. Peter Pregel',      '613-223-1239', pos_tre,  true),
    ('W. Bro. Ches Booth',        '613-832-1955', pos_pip,  true);
END $$;

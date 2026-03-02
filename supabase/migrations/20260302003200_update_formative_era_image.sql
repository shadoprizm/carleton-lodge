-- Update the Formative Era image to local lodge image
UPDATE history_eras
SET image_url = '/formative-era-local.png',
    updated_at = now()
WHERE slug = 'formative-era-1904-1920';

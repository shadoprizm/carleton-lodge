-- Update the Modern Era image from stock photo to actual lodge initiation photo
UPDATE history_eras
SET image_url = '/modern-era-initiation.jpg',
    updated_at = now()
WHERE slug = 'modern-era-2000-2026';

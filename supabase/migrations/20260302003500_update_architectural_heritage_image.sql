-- Update the Architectural Heritage image to local lodge photo
UPDATE history_eras
SET image_url = '/architectural-heritage.jpg',
    updated_at = now()
WHERE slug = 'architectural-heritage-1872-1925';

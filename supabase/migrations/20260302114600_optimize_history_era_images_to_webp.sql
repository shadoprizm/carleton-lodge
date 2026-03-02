-- Switch the heaviest home-page history images to optimized WebP assets.
-- This cuts first-load transfer size significantly without changing layout/content.
UPDATE history_eras
SET image_url = '/formative-era-local.webp',
    updated_at = now()
WHERE slug = 'formative-era-1904-1920';

UPDATE history_eras
SET image_url = '/grok-image-44835151-d0be-4a7e-aa87-5252eaec5947.webp',
    updated_at = now()
WHERE slug = 'great-fire-1920';

UPDATE history_eras
SET image_url = '/c429f9cd-db98-41c6-b9e4-b9b05a3eb298.webp',
    updated_at = now()
WHERE slug = 'international-connection-1916-1930';

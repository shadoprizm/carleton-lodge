const optimizedAssetMap: Record<string, string> = {
  '/formative-era-local.png': '/formative-era-local.webp',
  '/grok-image-44835151-d0be-4a7e-aa87-5252eaec5947.png': '/grok-image-44835151-d0be-4a7e-aa87-5252eaec5947.webp',
  '/c429f9cd-db98-41c6-b9e4-b9b05a3eb298.jpg': '/c429f9cd-db98-41c6-b9e4-b9b05a3eb298.webp',
  '/Screenshot_2026-03-01_at_08.13.26.png': '/logo-mark.webp',
};

export const getOptimizedAssetUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;

  const directMatch = optimizedAssetMap[url];
  if (directMatch) return directMatch;

  try {
    const parsed = new URL(url);
    const mappedPath = optimizedAssetMap[parsed.pathname];
    if (!mappedPath) return url;

    parsed.pathname = mappedPath;
    return parsed.toString();
  } catch {
    return url;
  }
};

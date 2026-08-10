import type {
  GalleryCategory,
  HistoryChapter,
  HistoryEvent,
  HistoryImage,
  HistorySource,
} from './types';
import { historyChapters } from './chapters';
import { historyEvents, landingTimelineEventIds } from './events';
import { historyImages } from './images';
import { historySources } from './sources';

export * from './types';
export { historyChapters, narrativeChapters } from './chapters';
export { historyEvents, landingTimelineEventIds } from './events';
export { historyImages } from './images';
export { historySources } from './sources';
export { allHistoryPeople, keyFigures, knownCharterMembers } from './people';
export { historyPlaces } from './places';
export { historyArtifacts } from './artifacts';
export { openQuestions } from './openQuestions';

/** Mandatory display label for AI reconstructions (IMAGE_POLICY.md — use verbatim). */
export const AI_RECONSTRUCTION_LABEL =
  'Historical reconstruction — AI-generated from documented sources; not an original photograph.';

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  historical_photographs: 'Historical photographs',
  buildings: 'Buildings',
  people: 'People',
  documents_maps: 'Documents & maps',
  artifacts: 'Artifacts',
  modern_lodge_history: 'Modern Lodge history',
  ai_reconstructions: 'AI reconstructions',
};

/** Display label for an image, per IMAGE_POLICY.md. */
export function imageTypeLabel(image: HistoryImage): string {
  switch (image.imageType) {
    case 'historical_photo':
      return 'Historical photograph';
    case 'document_scan':
      return 'Historical document';
    case 'map':
      return 'Historical map';
    case 'modern_artifact_photo':
      return image.dateLabel
        ? `Photographed ${image.dateLabel} — historical artifact`
        : 'Modern photograph — historical artifact';
    case 'modern_photo':
      return image.dateLabel ? `Modern photograph — ${image.dateLabel}` : 'Modern photograph';
    case 'ai_reconstruction':
      return AI_RECONSTRUCTION_LABEL;
  }
}

const byId = <T extends { id: string }>(items: T[]) => {
  const map = new Map(items.map((item) => [item.id, item]));
  return (id: string) => map.get(id);
};

export const getChapter = (slug: string): HistoryChapter | undefined =>
  historyChapters.find((chapter) => chapter.slug === slug);

export const sourceById: (id: string) => HistorySource | undefined = byId(historySources);

export const imageById: (id: string) => HistoryImage | undefined = byId(historyImages);

export const eventsForChapter = (chapterId: string): HistoryEvent[] =>
  historyEvents
    .filter((event) => event.chapterIds?.includes(chapterId))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

export const imagesForChapter = (chapterId: string): HistoryImage[] =>
  historyImages.filter((image) => image.chapterIds?.includes(chapterId));

export const landingTimelineEvents = (): HistoryEvent[] =>
  landingTimelineEventIds
    .map((id) => historyEvents.find((event) => event.id === id))
    .filter((event): event is HistoryEvent => Boolean(event));

export const sourcesFor = (sourceIds: string[]): HistorySource[] =>
  sourceIds
    .map((id) => sourceById(id))
    .filter((source): source is HistorySource => Boolean(source));

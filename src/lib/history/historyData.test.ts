import { describe, expect, it } from 'vitest';
import {
  allHistoryPeople,
  eventsForChapter,
  historyArtifacts,
  historyChapters,
  historyEvents,
  historyImages,
  historyPlaces,
  historySources,
} from './index';
import type { ImageType } from './types';

// Every file under static/, keyed by path relative to this test file.
// (The project has no @types/node, so Vite's import.meta.glob is used
// instead of node:fs to verify on-disk assets.)
const staticFiles = import.meta.glob('/static/**/*');
const staticPathExists = (localPath: string) => Boolean(staticFiles[`/static${localPath}`]);

const VALID_IMAGE_TYPES: ImageType[] = [
  'historical_photo',
  'document_scan',
  'map',
  'modern_artifact_photo',
  'modern_photo',
  'ai_reconstruction',
];

const sourceIds = new Set(historySources.map((source) => source.id));
const imageIds = new Set(historyImages.map((image) => image.id));

const expectSourcesExist = (owner: string, ids: string[]) => {
  for (const id of ids) {
    expect(sourceIds.has(id), `${owner} references unknown source ${id}`).toBe(true);
  }
};

describe('history archive data integrity', () => {
  it('gives every event, person, place and artifact source IDs that exist in the register', () => {
    for (const event of historyEvents) expectSourcesExist(`event ${event.id}`, event.sources);
    for (const person of allHistoryPeople) expectSourcesExist(`person ${person.id}`, person.sources);
    for (const place of historyPlaces) expectSourcesExist(`place ${place.id}`, place.sources);
    for (const artifact of historyArtifacts) expectSourcesExist(`artifact ${artifact.id}`, artifact.sources);
  });

  it('keeps chapter slugs unique', () => {
    const slugs = historyChapters.map((chapter) => chapter.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses only valid image types', () => {
    for (const image of historyImages) {
      expect(VALID_IMAGE_TYPES, `image ${image.id} has invalid type`).toContain(image.imageType);
    }
  });

  it('never files an AI reconstruction under the historical photographs gallery category', () => {
    for (const image of historyImages) {
      if (image.imageType === 'ai_reconstruction') {
        expect(image.galleryCategory, `AI image ${image.id} must not be a historical photograph`).not.toBe(
          'historical_photographs',
        );
      }
    }
  });

  it('points every localPath at a file that exists in static/', () => {
    for (const image of historyImages) {
      if (image.localPath) {
        expect(
          staticPathExists(image.localPath),
          `image ${image.id} localPath ${image.localPath} is missing from static/`,
        ).toBe(true);
      }
    }
  });

  it('never references the public/ preservation archive (not served in production)', () => {
    for (const image of historyImages) {
      if (image.localPath) {
        expect(image.localPath, `image ${image.id} must not point into the preservation store`).not.toContain(
          'archive/legacy-owned',
        );
      }
    }
  });

  it('resolves every referenced imageId', () => {
    for (const person of allHistoryPeople) {
      if (person.imageId) expect(imageIds.has(person.imageId), `person ${person.id}`).toBe(true);
    }
    for (const place of historyPlaces) {
      for (const id of place.imageIds) {
        expect(imageIds.has(id), `place ${place.id} references unknown image ${id}`).toBe(true);
      }
    }
    for (const artifact of historyArtifacts) {
      if (artifact.imageId) expect(imageIds.has(artifact.imageId), `artifact ${artifact.id}`).toBe(true);
    }
  });

  it('keeps chapter event references valid and chronologically ordered', () => {
    const chapterIds = new Set(historyChapters.map((chapter) => chapter.id));
    for (const event of historyEvents) {
      for (const chapterId of event.chapterIds ?? []) {
        expect(chapterIds.has(chapterId), `event ${event.id} references unknown chapter ${chapterId}`).toBe(true);
      }
    }
    for (const chapter of historyChapters) {
      const sortKeys = eventsForChapter(chapter.id).map((event) => event.sortKey);
      expect([...sortKeys].sort(), `events for chapter ${chapter.id} are out of order`).toEqual(sortKeys);
    }
  });

  it('keeps image chapter references valid', () => {
    const chapterIds = new Set(historyChapters.map((chapter) => chapter.id));
    for (const image of historyImages) {
      for (const chapterId of image.chapterIds ?? []) {
        expect(chapterIds.has(chapterId), `image ${image.id} references unknown chapter ${chapterId}`).toBe(true);
      }
    }
  });

  it('never presents a complete 23-name charter member roster', () => {
    const charterMembers = allHistoryPeople.filter((person) => person.category === 'charter_member');
    expect(charterMembers.length).toBeLessThan(23);
  });
});

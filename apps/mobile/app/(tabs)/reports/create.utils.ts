function createUuidFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function createEntityId(prefix: 'photo' | 'report') {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomSuffix}`;
}

export interface ReportPhotoLike {
  id: string;
}

export function appendPhoto<T extends ReportPhotoLike>(
  photos: T[],
  photo: T,
  maxPhotos = 10
) {
  if (photos.length >= maxPhotos) {
    return photos;
  }
  return [...photos, photo];
}

export function removePhotoById<T extends ReportPhotoLike>(photos: T[], id: string) {
  return photos.filter(photo => photo.id !== id);
}

export function createPhotoId(
  randomUuid:
    | (() => string)
    | null
    | undefined = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
): string {
  return randomUuid ? randomUuid() : createEntityId('photo');
}

export function createReportId(
  randomUuid:
    | (() => string)
    | null
    | undefined = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
): string {
  return randomUuid ? randomUuid() : createUuidFallback();
}

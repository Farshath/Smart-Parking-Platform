/**
 * Utility functions to normalize MongoDB documents so they consistently contain
 * both `id` and `_id` string properties across all API responses.
 *
 * This resolves the discrepancy where Mongoose `.lean()` queries bypass
 * Schema `.toJSON()` transforms, leaving `_id` as an ObjectId and `id` undefined.
 */

export function normalizeEntity<T extends Record<string, any>>(
  doc: T
): T & { id: string; _id: string } {
  if (!doc || typeof doc !== 'object') {
    return doc as any;
  }

  const rawId = doc._id || doc.id;
  const idStr = rawId ? rawId.toString() : '';

  const normalized: Record<string, any> = {
    ...doc,
    id: idStr,
    _id: idStr,
  };

  // Normalize populated ownerId if present
  if (normalized.ownerId && typeof normalized.ownerId === 'object') {
    const ownerRawId = normalized.ownerId._id || normalized.ownerId.id;
    if (ownerRawId) {
      normalized.ownerId = {
        ...normalized.ownerId,
        id: ownerRawId.toString(),
        _id: ownerRawId.toString(),
      };
    }
  }

  // Normalize populated userId if present
  if (normalized.userId && typeof normalized.userId === 'object') {
    const userRawId = normalized.userId._id || normalized.userId.id;
    if (userRawId) {
      normalized.userId = {
        ...normalized.userId,
        id: userRawId.toString(),
        _id: userRawId.toString(),
      };
    }
  }

  // Normalize populated listingId if present
  if (normalized.listingId && typeof normalized.listingId === 'object') {
    const listingRawId = normalized.listingId._id || normalized.listingId.id;
    if (listingRawId) {
      normalized.listingId = {
        ...normalized.listingId,
        id: listingRawId.toString(),
        _id: listingRawId.toString(),
      };
    }
  }

  return normalized as T & { id: string; _id: string };
}

export function normalizeEntities<T extends Record<string, any>>(
  docs: T[]
): Array<T & { id: string; _id: string }> {
  if (!Array.isArray(docs)) return [];
  return docs.map((doc) => normalizeEntity(doc));
}

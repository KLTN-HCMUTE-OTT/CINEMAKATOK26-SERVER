import * as LRUMap from 'pixl-cache';

type LRUCacheMapOptions = {
  maxItems?: number;
  maxAge?: number;
  maxBytes?: number;
};

export function LRUCacheMap({ maxItems = 10000, maxAge = 10, maxBytes }: LRUCacheMapOptions = {}) {
  return new LRUMap({
    maxItems,
    maxAge,
    maxBytes,
  });
}

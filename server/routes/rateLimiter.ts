const rateLimitStores = new Map<string, Map<string, { count: number; resetAt: number }>>();

function getStore(name: string): Map<string, { count: number; resetAt: number }> {
  if (!rateLimitStores.has(name)) {
    rateLimitStores.set(name, new Map());
  }
  return rateLimitStores.get(name)!;
}

export function checkRateLimit(storeName: string, key: string, maxRequests: number, windowMs: number): boolean {
  const store = getStore(storeName);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [, store] of rateLimitStores) {
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

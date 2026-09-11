if (typeof globalThis.localStorage === 'undefined') {
  const data = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as typeof globalThis & { window: typeof globalThis }).window = globalThis as unknown as Window & typeof globalThis;
}

if (typeof globalThis.window.dispatchEvent !== 'function') {
  globalThis.window.dispatchEvent = () => true;
}
if (typeof globalThis.window.addEventListener !== 'function') {
  globalThis.window.addEventListener = () => undefined;
}
if (typeof globalThis.window.removeEventListener !== 'function') {
  globalThis.window.removeEventListener = () => undefined;
}

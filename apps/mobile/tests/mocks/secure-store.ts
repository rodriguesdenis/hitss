const items = new Map<string, string>();

export const getItem = jest.fn((key: string) => items.get(key) ?? null);

export const setItem = jest.fn((key: string, value: string) => {
  items.set(key, value);
});

export const getItemAsync = jest.fn(
  async (key: string) => items.get(key) ?? null,
);

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  items.set(key, value);
});

export const deleteItemAsync = jest.fn(async (key: string) => {
  items.delete(key);
});

export function storedKeys(): string[] {
  return [...items.keys()];
}

export function resetSecureStore() {
  items.clear();
}

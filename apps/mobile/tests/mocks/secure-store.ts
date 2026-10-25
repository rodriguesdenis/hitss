const items = new Map<string, string>();

export const getItemAsync = jest.fn(
  async (key: string) => items.get(key) ?? null,
);

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  items.set(key, value);
});

export const deleteItemAsync = jest.fn(async (key: string) => {
  items.delete(key);
});

export function resetSecureStore() {
  items.clear();
}

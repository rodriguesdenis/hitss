import {
  asyncStorage,
  createMemoryStorage,
  type StorageAdapter,
} from './storage';

describe.each<[string, () => StorageAdapter]>([
  ['AsyncStorage', () => asyncStorage],
  ['memory', createMemoryStorage],
])('StorageAdapter contract: %s', (_name, create) => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = create();
  });

  it('returns null for a missing key', async () => {
    await expect(storage.getItem('missing')).resolves.toBeNull();
  });

  it('reads back what it stored', async () => {
    await storage.setItem('k', '{"a":1}');
    await expect(storage.getItem('k')).resolves.toBe('{"a":1}');
  });

  it('overwrites an existing value', async () => {
    await storage.setItem('k', 'one');
    await storage.setItem('k', 'two');
    await expect(storage.getItem('k')).resolves.toBe('two');
  });

  it('removes a key without touching the others', async () => {
    await storage.setItem('a', '1');
    await storage.setItem('b', '2');
    await storage.removeItem('a');
    await expect(storage.getItem('a')).resolves.toBeNull();
    await expect(storage.getItem('b')).resolves.toBe('2');
  });

  it('removing a missing key resolves', async () => {
    await expect(storage.removeItem('missing')).resolves.toBeUndefined();
  });
});

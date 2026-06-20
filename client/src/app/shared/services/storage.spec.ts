import {TestBed} from '@angular/core/testing';

import {StorageService} from './storage';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('get()', () => {
    it('returns null when the key does not exist', async () => {
      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns the stored object for an existing key', async () => {
      await service.set('my-key', {foo: 'bar'});
      const result = await service.get<{foo: string}>('my-key');
      expect(result).toEqual({foo: 'bar'});
    });

    it('returns null after the key has been deleted', async () => {
      await service.set('gone', 'value');
      await service.delete('gone');
      const result = await service.get('gone');
      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('stores and retrieves an object', async () => {
      await service.set('obj', {hello: 'world'});
      expect(await service.get<{hello: string}>('obj')).toEqual({hello: 'world'});
    });

    it('stores and retrieves a number', async () => {
      await service.set('num', 42);
      expect(await service.get<number>('num')).toBe(42);
    });

    it('stores and retrieves an array', async () => {
      await service.set('arr', [1, 2, 3]);
      expect(await service.get<number[]>('arr')).toEqual([1, 2, 3]);
    });

    it('overwrites a previously stored value', async () => {
      await service.set('key', 'first');
      await service.set('key', 'second');
      expect(await service.get<string>('key')).toBe('second');
    });
  });

  describe('delete()', () => {
    it('removes the key so get() returns null', async () => {
      await service.set('key-to-delete', {data: true});
      await service.delete('key-to-delete');
      expect(await service.get('key-to-delete')).toBeNull();
    });

    it('does not affect other keys', async () => {
      await service.set('keep', 'yes');
      await service.set('drop', 'no');
      await service.delete('drop');
      expect(await service.get<string>('keep')).toBe('yes');
    });
  });

  describe('round-trip', () => {
    it('preserves nested objects with arrays', async () => {
      const obj = {name: 'test', count: 3, tags: ['a', 'b']};
      await service.set('item', obj);
      expect(await service.get(typeof obj)).toBeNull(); // wrong key → null
      expect(await service.get<typeof obj>('item')).toEqual(obj);
    });
  });
});

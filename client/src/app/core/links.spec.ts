import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {LinksService} from './links';
import {environment} from '../../environments/environment';

describe('LinksService', () => {
  let service: LinksService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(LinksService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createSingle()', () => {
    it('extracts result from response envelope', async () => {
      const mockResult = {link_token: 'abc123', url: 'https://example.com'};
      const createPromise = service.createSingle({secret: 'my secret'} as any);
      http.expectOne(`${environment.apiBaseUrl}/links`).flush({result: mockResult});
      const result = await createPromise;
      expect(result).toEqual(mockResult as any);
    });

    it('does not send credentials (public endpoint)', async () => {
      const createPromise = service.createSingle({secret: 'my secret'} as any);
      const req = http.expectOne(`${environment.apiBaseUrl}/links`);
      expect(req.request.withCredentials).toBeFalse();
      req.flush({result: {}});
      await createPromise;
    });

    it('uses POST method', async () => {
      const createPromise = service.createSingle({secret: 'test'} as any);
      const req = http.expectOne(`${environment.apiBaseUrl}/links`);
      expect(req.request.method).toBe('POST');
      req.flush({result: {}});
      await createPromise;
    });
  });

  describe('createBulk()', () => {
    it('sends credentials', async () => {
      const bulkPromise = service.createBulk([]);
      const req = http.expectOne(`${environment.apiBaseUrl}/links/bulk`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({results: []});
      await bulkPromise;
    });

    it('sets Idempotency-Key header when provided', async () => {
      const bulkPromise = service.createBulk([], {idempotencyKey: 'my-key-123'});
      const req = http.expectOne(`${environment.apiBaseUrl}/links/bulk`);
      expect(req.request.headers.get('Idempotency-Key')).toBe('my-key-123');
      req.flush({results: []});
      await bulkPromise;
    });

    it('does not set Idempotency-Key header when not provided', async () => {
      const bulkPromise = service.createBulk([]);
      const req = http.expectOne(`${environment.apiBaseUrl}/links/bulk`);
      expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
      req.flush({results: []});
      await bulkPromise;
    });

    it('returns results array', async () => {
      const mockResults = [{link_token: 't1'}, {link_token: 't2'}];
      const bulkPromise = service.createBulk([]);
      http.expectOne(`${environment.apiBaseUrl}/links/bulk`).flush({results: mockResults});
      const results = await bulkPromise;
      expect(results).toEqual(mockResults as any);
    });
  });

  describe('listStatus()', () => {
    it('sends credentials', async () => {
      const listPromise = service.listStatus();
      const req = http.expectOne(r => r.url.includes('/links/status'));
      expect(req.request.withCredentials).toBeTrue();
      req.flush([]);
      await listPromise;
    });

    it('sets since query param when provided', async () => {
      const listPromise = service.listStatus({since: '2024-01-01'});
      const req = http.expectOne(r => r.url.includes('/links/status'));
      expect(req.request.params.get('since')).toBe('2024-01-01');
      req.flush([]);
      await listPromise;
    });

    it('sets until query param when provided', async () => {
      const listPromise = service.listStatus({until: '2024-12-31'});
      const req = http.expectOne(r => r.url.includes('/links/status'));
      expect(req.request.params.get('until')).toBe('2024-12-31');
      req.flush([]);
      await listPromise;
    });

    it('sets Authorization header when PAT provided', async () => {
      const listPromise = service.listStatus(undefined, {pat: 'mytoken'});
      const req = http.expectOne(r => r.url.includes('/links/status'));
      expect(req.request.headers.get('Authorization')).toBe('Bearer mytoken');
      req.flush([]);
      await listPromise;
    });

    it('does not set Authorization header when no PAT', async () => {
      const listPromise = service.listStatus();
      const req = http.expectOne(r => r.url.includes('/links/status'));
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush([]);
      await listPromise;
    });
  });

  describe('deleteLink()', () => {
    it('URL-encodes the item ID', async () => {
      const deletePromise = service.deleteLink('item/with/slashes');
      const req = http.expectOne(`${environment.apiBaseUrl}/links/by-item/item%2Fwith%2Fslashes`);
      expect(req.request.url).toContain('item%2Fwith%2Fslashes');
      req.flush(null);
      await deletePromise;
    });

    it('uses DELETE method', async () => {
      const deletePromise = service.deleteLink('item123');
      const req = http.expectOne(r => r.url.includes('/links/by-item/'));
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await deletePromise;
    });

    it('sets Authorization header when PAT provided', async () => {
      const deletePromise = service.deleteLink('item123', {pat: 'mytoken'});
      const req = http.expectOne(r => r.url.includes('/links/by-item/'));
      expect(req.request.headers.get('Authorization')).toBe('Bearer mytoken');
      req.flush(null);
      await deletePromise;
    });
  });

  describe('redeemLink()', () => {
    it('URL-encodes the link token', async () => {
      const redeemPromise = service.redeemLink('token/with/slash');
      const req = http.expectOne(r => r.url.includes('token%2Fwith%2Fslash'));
      expect(req.request.url).toContain('token%2Fwith%2Fslash');
      req.flush({});
      await redeemPromise;
    });

    it('does not send credentials (public endpoint)', async () => {
      const redeemPromise = service.redeemLink('sometoken');
      const req = http.expectOne(r => r.url.includes('/links/redeem/'));
      expect(req.request.withCredentials).toBeFalse();
      req.flush({});
      await redeemPromise;
    });

    it('includes passphrase hash in query when provided', async () => {
      const redeemPromise = service.redeemLink('token', 'abc123hash');
      const req = http.expectOne(r => r.url.includes('/links/redeem/'));
      expect(req.request.urlWithParams).toContain('abc123hash');
      req.flush({});
      await redeemPromise;
    });
  });
});

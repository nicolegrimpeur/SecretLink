import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {PatService} from './pat';
import {environment} from '../../environments/environment';

describe('PatService', () => {
  let service: PatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list()', () => {
    it('returns the list of PATs', async () => {
      const mockPats = [{id: 1, label: 'CI', scopes: ['read']}];
      const listPromise = service.list();
      http.expectOne(`${environment.apiBaseUrl}/users/tokens`).flush(mockPats);
      const result = await listPromise;
      expect(result).toEqual(mockPats as any);
    });

    it('uses withCredentials', async () => {
      const listPromise = service.list();
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush([]);
      await listPromise;
    });

    it('uses GET method', async () => {
      const listPromise = service.list();
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
      await listPromise;
    });
  });

  describe('create()', () => {
    it('sends label and scopes', async () => {
      const createPromise = service.create('My token', ['read', 'write']);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens`);
      expect(req.request.body['label']).toBe('My token');
      expect(req.request.body['scopes']).toEqual(['read', 'write']);
      req.flush({token: 'abc', token_preview: 'abc...', pat: {}});
      await createPromise;
    });

    it('accepts null label', async () => {
      const createPromise = service.create(null, ['read']);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens`);
      expect(req.request.body['label']).toBeNull();
      req.flush({});
      await createPromise;
    });

    it('uses POST method with credentials', async () => {
      const createPromise = service.create('test', []);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({});
      await createPromise;
    });
  });

  describe('revoke()', () => {
    it('sends DELETE to the correct URL', async () => {
      const revokePromise = service.revoke(42);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens/42`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await revokePromise;
    });

    it('uses withCredentials', async () => {
      const revokePromise = service.revoke(1);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/tokens/1`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush(null);
      await revokePromise;
    });

    it('includes the ID in the URL', async () => {
      const revokePromise = service.revoke(99);
      const req = http.expectOne(r => r.url.endsWith('/users/tokens/99'));
      req.flush(null);
      await revokePromise;
    });
  });
});

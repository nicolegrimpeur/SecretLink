import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {AuthService} from './auth';
import {environment} from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('user starts as null', () => {
    expect(service.user).toBeNull();
  });

  describe('login()', () => {
    it('sets user when MFA is not required', async () => {
      const mockUser = {id: 1, email: 'test@example.com'};
      const loginPromise = service.login('test@example.com', 'password');
      http.expectOne(`${environment.apiBaseUrl}/users/login`)
        .flush({mfa_required: false, user: mockUser});
      await loginPromise;
      expect(service.user).toEqual(mockUser as any);
    });

    it('does not set user when MFA is required', async () => {
      const loginPromise = service.login('test@example.com', 'password');
      http.expectOne(`${environment.apiBaseUrl}/users/login`)
        .flush({mfa_required: true, pre_auth_token: 'token123'});
      const result = await loginPromise;
      expect(result.mfa_required).toBeTrue();
      expect(service.user).toBeNull();
    });

    it('uses withCredentials', async () => {
      const loginPromise = service.login('test@example.com', 'password');
      const req = http.expectOne(`${environment.apiBaseUrl}/users/login`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({mfa_required: false, user: {id: 1}});
      await loginPromise;
    });

    it('emits updated user via user$', async () => {
      const mockUser = {id: 2, email: 'a@b.com'};
      let emitted: any;
      service.user$.subscribe(u => emitted = u);

      const loginPromise = service.login('a@b.com', 'pw');
      http.expectOne(`${environment.apiBaseUrl}/users/login`)
        .flush({mfa_required: false, user: mockUser});
      await loginPromise;
      expect(emitted).toEqual(mockUser as any);
    });
  });

  describe('logout()', () => {
    it('clears user and uses withCredentials', async () => {
      const loginPromise = service.login('a@b.com', 'pw');
      http.expectOne(`${environment.apiBaseUrl}/users/login`)
        .flush({mfa_required: false, user: {id: 1, email: 'a@b.com'}});
      await loginPromise;
      expect(service.user).toBeTruthy();

      const logoutPromise = service.logout();
      const req = http.expectOne(`${environment.apiBaseUrl}/users/logout`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({});
      await logoutPromise;
      expect(service.user).toBeNull();
    });
  });

  describe('verifyMfa()', () => {
    it('sets user after verification', async () => {
      const mockUser = {id: 1, email: 'test@example.com'};
      const verifyPromise = service.verifyMfa('pretoken', '123456');
      http.expectOne(`${environment.apiBaseUrl}/users/mfa/verify`).flush(mockUser);
      await verifyPromise;
      expect(service.user).toEqual(mockUser as any);
    });

    it('sends totp_code when provided', async () => {
      const verifyPromise = service.verifyMfa('pretoken', '123456');
      const req = http.expectOne(`${environment.apiBaseUrl}/users/mfa/verify`);
      expect(req.request.body['totp_code']).toBe('123456');
      req.flush({id: 1});
      await verifyPromise;
    });

    it('sends recovery_code when provided', async () => {
      const verifyPromise = service.verifyMfa('pretoken', undefined, 'RECOVERY-CODE');
      const req = http.expectOne(`${environment.apiBaseUrl}/users/mfa/verify`);
      expect(req.request.body['recovery_code']).toBe('RECOVERY-CODE');
      req.flush({id: 1});
      await verifyPromise;
    });

    it('sends remember_device flag', async () => {
      const verifyPromise = service.verifyMfa('pretoken', '111111', undefined, true);
      const req = http.expectOne(`${environment.apiBaseUrl}/users/mfa/verify`);
      expect(req.request.body['remember_device']).toBeTrue();
      req.flush({id: 1});
      await verifyPromise;
    });
  });

  describe('me()', () => {
    it('sets user from response', async () => {
      const mockUser = {id: 42, email: 'me@example.com'};
      const mePromise = service.me();
      http.expectOne(`${environment.apiBaseUrl}/users/me`).flush(mockUser);
      await mePromise;
      expect(service.user).toEqual(mockUser as any);
    });
  });

  describe('deleteMe()', () => {
    it('clears user after deletion', async () => {
      const loginPromise = service.login('a@b.com', 'pw');
      http.expectOne(`${environment.apiBaseUrl}/users/login`)
        .flush({mfa_required: false, user: {id: 1, email: 'a@b.com'}});
      await loginPromise;

      const deletePromise = service.deleteMe();
      http.expectOne(`${environment.apiBaseUrl}/users/me`).flush({});
      await deletePromise;
      expect(service.user).toBeNull();
    });

    it('uses DELETE method', async () => {
      const deletePromise = service.deleteMe();
      const req = http.expectOne(`${environment.apiBaseUrl}/users/me`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
      await deletePromise;
    });
  });

  describe('changePassword()', () => {
    it('posts current and new password', async () => {
      const changePromise = service.changePassword('old', 'new123');
      const req = http.expectOne(`${environment.apiBaseUrl}/users/password`);
      expect(req.request.body['current_password']).toBe('old');
      expect(req.request.body['new_password']).toBe('new123');
      req.flush({});
      await changePromise;
    });
  });
});

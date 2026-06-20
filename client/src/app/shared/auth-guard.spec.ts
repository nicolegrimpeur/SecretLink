import {TestBed} from '@angular/core/testing';
import {CanActivateFn, provideRouter, Router} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {authGuard, guestGuard} from './auth-guard';
import {AuthService} from '../core/auth';

describe('Route guards', () => {
  let authService: AuthService;
  let router: Router;

  const runAuthGuard: CanActivateFn = (...p) =>
    TestBed.runInInjectionContext(() => authGuard(...p));

  const runGuestGuard: CanActivateFn = (...p) =>
    TestBed.runInInjectionContext(() => guestGuard(...p));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  // ── authGuard ────────────────────────────────────────────────

  describe('authGuard', () => {
    it('returns true when user is authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue({id: 1} as any);
      expect(runAuthGuard({} as any, {} as any)).toBeTrue();
    });

    it('returns false when user is not authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue(null);
      spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      expect(runAuthGuard({} as any, {} as any)).toBeFalse();
    });

    it('redirects to /auth when user is not authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue(null);
      const navSpy = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      runAuthGuard({} as any, {} as any);
      expect(navSpy).toHaveBeenCalledWith('/auth');
    });

    it('does not redirect when user is authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue({id: 1} as any);
      const navSpy = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      runAuthGuard({} as any, {} as any);
      expect(navSpy).not.toHaveBeenCalled();
    });
  });

  // ── guestGuard ───────────────────────────────────────────────

  describe('guestGuard', () => {
    it('returns true when user is not authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue(null);
      expect(runGuestGuard({} as any, {} as any)).toBeTrue();
    });

    it('returns false when user is authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue({id: 1} as any);
      spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      expect(runGuestGuard({} as any, {} as any)).toBeFalse();
    });

    it('redirects to /dashboard when user is authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue({id: 1} as any);
      const navSpy = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      runGuestGuard({} as any, {} as any);
      expect(navSpy).toHaveBeenCalledWith('/dashboard');
    });

    it('does not redirect when user is not authenticated', () => {
      spyOnProperty(authService, 'user', 'get').and.returnValue(null);
      const navSpy = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
      runGuestGuard({} as any, {} as any);
      expect(navSpy).not.toHaveBeenCalled();
    });
  });
});

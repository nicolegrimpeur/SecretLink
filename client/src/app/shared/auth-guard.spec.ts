import {TestBed} from '@angular/core/testing';
import {CanActivateFn, provideRouter, Router} from '@angular/router';
import {provideHttpClient, withXhr} from '@angular/common/http';
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
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ]
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  // ── authGuard ────────────────────────────────────────────────

  describe('authGuard', () => {
    it('returns true when user is authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue({id: 1} as any);
      expect(runAuthGuard({} as any, {} as any)).toBe(true);
    });

    it('returns false when user is not authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue(null);
      vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      expect(runAuthGuard({} as any, {} as any)).toBe(false);
    });

    it('redirects to /auth when user is not authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue(null);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      runAuthGuard({} as any, {} as any);
      expect(navSpy).toHaveBeenCalledWith('/auth');
    });

    it('does not redirect when user is authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue({id: 1} as any);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      runAuthGuard({} as any, {} as any);
      expect(navSpy).not.toHaveBeenCalled();
    });
  });

  // ── guestGuard ───────────────────────────────────────────────

  describe('guestGuard', () => {
    it('returns true when user is not authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue(null);
      expect(runGuestGuard({} as any, {} as any)).toBe(true);
    });

    it('returns false when user is authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue({id: 1} as any);
      vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      expect(runGuestGuard({} as any, {} as any)).toBe(false);
    });

    it('redirects to /dashboard when user is authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue({id: 1} as any);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      runGuestGuard({} as any, {} as any);
      expect(navSpy).toHaveBeenCalledWith('/dashboard');
    });

    it('does not redirect when user is not authenticated', () => {
      vi.spyOn(authService, 'user', 'get').mockReturnValue(null);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockReturnValue(Promise.resolve(true));
      runGuestGuard({} as any, {} as any);
      expect(navSpy).not.toHaveBeenCalled();
    });
  });
});

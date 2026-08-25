import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Router} from '@angular/router';
import {sessionExpiredInterceptor} from './session-expired.interceptor';
import {AuthService} from '../core/auth';
import {ToastService} from './services/toast';
import {User} from '../shared/models/user';
import type {Mock} from 'vitest';

describe('sessionExpiredInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: {navigateByUrl: Mock};

  const signIn = () => auth['userSubject'].next({id: 1, email: 'a@b.c'} as User);

  beforeEach(() => {
    router = {navigateByUrl: vi.fn().mockResolvedValue(true)};

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
        provideHttpClientTesting(),
        {provide: Router, useValue: router},
        {provide: ToastService, useValue: {toastMsg: () => Promise.resolve()}},
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  function fire(url: string, status = 401, code = 'UNAUTHORIZED', headers?: {[k: string]: string}) {
    let failed = false;
    http.get(url, {headers}).subscribe({error: () => (failed = true)});
    httpMock.expectOne(url).flush({error: {code}}, {status, statusText: 'Unauthorized'});
    return () => failed;
  }

  it('déconnecte et redirige quand une session active est rejetée', () => {
    signIn();
    const failed = fire('/links/status');

    expect(auth.user).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth');
    expect(failed(), 'l\'erreur doit rester propagée aux pages').toBe(true);
  });

  it('laisse passer un 401 anonyme sans rediriger (page publique / me() d\'amorçage)', () => {
    fire('/users/me');

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ne redirige pas sur un échec de connexion', () => {
    fire('/users/login');

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ne déconnecte pas sur un mot de passe actuel erroné', () => {
    signIn();
    fire('/users/password', 401, 'INVALID_CURRENT_PASSWORD');

    expect(auth.user).not.toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ne déconnecte pas sur un 401 provoqué par un PAT invalide', () => {
    signIn();
    fire('/links/status', 401, 'UNAUTHORIZED', {Authorization: 'Bearer pat-invalide'});

    expect(auth.user, 'la session navigateur reste valide').not.toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('déconnecte sur un 401 sans corps exploitable', () => {
    signIn();
    let failed = false;
    http.get('/links/status').subscribe({error: () => (failed = true)});
    httpMock.expectOne('/links/status').flush(null, {status: 401, statusText: 'Unauthorized'});

    expect(auth.user).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth');
    expect(failed).toBe(true);
  });

  it('ignore les statuts autres que 401', () => {
    signIn();
    fire('/links/status', 403);

    expect(auth.user).not.toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

import {HttpErrorResponse} from '@angular/common/http';
import {apiErrorText} from './api-error';

describe('apiErrorText', () => {
  const apiError = (code: string, status = 400) =>
    new HttpErrorResponse({error: {error: {code}}, status, statusText: 'Error'});

  it('traduit un code connu de l\'API', () => {
    expect(apiErrorText(apiError('RATE_LIMITED'))).toContain('Trop de tentatives');
  });

  it('distingue une absence de réponse d\'une erreur serveur', () => {
    const offline = new HttpErrorResponse({status: 0, statusText: 'Unknown Error'});

    expect(apiErrorText(offline)).toContain('Impossible de joindre le serveur');
    expect(apiErrorText(apiError('INTERNAL_SERVER_ERROR', 500))).toContain('erreur serveur');
    expect(apiErrorText(offline)).not.toEqual(apiErrorText(apiError('INTERNAL_SERVER_ERROR', 500)));
  });

  it('laisse un override prendre le pas sur le message générique', () => {
    const overrides = {PAYLOAD_TOO_LARGE: 'Import trop gros.'};

    expect(apiErrorText(apiError('PAYLOAD_TOO_LARGE', 413), {overrides})).toBe('Import trop gros.');
    expect(apiErrorText(apiError('PAYLOAD_TOO_LARGE', 413))).toContain('trop volumineux');
  });

  it('utilise le repli sur un code inconnu', () => {
    expect(apiErrorText(apiError('CODE_INEXISTANT'), {fallback: 'Échec.'})).toBe('Échec.');
  });

  it('reste robuste sans corps exploitable', () => {
    const empty = new HttpErrorResponse({status: 502, statusText: 'Bad Gateway'});

    expect(apiErrorText(empty, {fallback: 'Échec.'})).toBe('Échec.');
    expect(apiErrorText(undefined)).toBeTruthy();
  });
});

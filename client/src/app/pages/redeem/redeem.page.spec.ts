import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpErrorResponse, provideHttpClient, withXhr} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {ToastController} from '@ionic/angular';
import type {Mock} from 'vitest';

import {RedeemPage} from './redeem.page';
import {LinksService} from '../../core/links';

const apiError = (status: number, code: string) =>
  new HttpErrorResponse({status, error: {error: {code, message: 'x'}}});

describe('RedeemPage', () => {
  let component: RedeemPage;
  let fixture: ComponentFixture<RedeemPage>;
  let redeemLink: Mock;

  beforeEach(async () => {
    redeemLink = vi.fn();

    await TestBed.configureTestingModule({
      imports: [RedeemPage],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        {provide: LinksService, useValue: {redeemLink}},
        {
          provide: ToastController,
          useValue: {
            create: vi.fn().mockReturnValue(
              Promise.resolve({present: () => Promise.resolve()})
            )
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RedeemPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.token = 'un-token';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('demande la passphrase sur INVALID_PASSPHRASE', async () => {
    redeemLink.mockRejectedValue(apiError(403, 'INVALID_PASSPHRASE'));

    await component.reveal();

    expect(component.state()).toBe('passphrase_required');
    expect(component.isPassphraseInvalid()).toBe(true);
  });

  it('passe en erreur sur un 403 inattendu, sans rester en chargement', async () => {
    redeemLink.mockRejectedValue(apiError(403, 'CSRF_ORIGIN_MISMATCH'));

    await component.reveal();

    expect(component.state()).toBe('error');
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('Impossible de révéler le secret.');
  });
});

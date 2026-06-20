import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {ToastController} from '@ionic/angular/standalone';

import {RedeemPage} from './redeem.page';

describe('RedeemPage', () => {
  let component: RedeemPage;
  let fixture: ComponentFixture<RedeemPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RedeemPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ToastController,
          useValue: {
            create: jasmine.createSpy('create').and.returnValue(
              Promise.resolve({present: () => Promise.resolve()})
            )
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RedeemPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

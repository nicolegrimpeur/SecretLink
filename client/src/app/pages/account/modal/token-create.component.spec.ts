import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {ModalController, ToastController} from '@ionic/angular/standalone';

import {TokenCreateComponent} from './token-create.component';

describe('TokenCreateComponent', () => {
  let component: TokenCreateComponent;
  let fixture: ComponentFixture<TokenCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenCreateComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ModalController,
          useValue: {
            dismiss: jasmine.createSpy('dismiss').and.returnValue(Promise.resolve()),
          }
        },
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

    fixture = TestBed.createComponent(TokenCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

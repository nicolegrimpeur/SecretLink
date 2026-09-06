import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {NavController, PopoverController, ToastController} from '@ionic/angular';

import {LayoutComponent} from './layout.component';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NavController,
          useValue: {navigateRoot: vi.fn(), navigateForward: vi.fn()}
        },
        {
          provide: PopoverController,
          useValue: {create: vi.fn().mockReturnValue(Promise.resolve({present: () => {}}))}
        },
        {
          provide: ToastController,
          useValue: {create: vi.fn().mockReturnValue(Promise.resolve({present: () => {}}))}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

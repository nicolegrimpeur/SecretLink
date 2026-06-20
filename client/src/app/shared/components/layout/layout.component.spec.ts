import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {NavController, PopoverController, ToastController} from '@ionic/angular/standalone';

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
          useValue: {navigateRoot: jasmine.createSpy(), navigateForward: jasmine.createSpy()}
        },
        {
          provide: PopoverController,
          useValue: {create: jasmine.createSpy('create').and.returnValue(Promise.resolve({present: () => {}}))}
        },
        {
          provide: ToastController,
          useValue: {create: jasmine.createSpy('create').and.returnValue(Promise.resolve({present: () => {}}))}
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

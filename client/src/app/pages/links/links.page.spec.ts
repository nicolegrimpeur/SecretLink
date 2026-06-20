import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

import {LinksPage} from './links.page';

describe('LinksPage', () => {
  let component: LinksPage;
  let fixture: ComponentFixture<LinksPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinksPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LinksPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

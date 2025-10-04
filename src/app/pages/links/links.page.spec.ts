import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinksPage } from './links.page';

describe('LinksPage', () => {
  let component: LinksPage;
  let fixture: ComponentFixture<LinksPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LinksPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

import {DashboardPage} from './dashboard.page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in loading state', () => {
    expect(component.loading()).toBeTrue();
  });

  it('starts with empty links and tokens', () => {
    expect(component.links()).toEqual([]);
    expect(component.tokens()).toEqual([]);
  });

  it('countActive starts at 0', () => {
    expect(component.countActive()).toBe(0);
  });

  describe('statusOf()', () => {
    it('returns deleted when deleted_at is set', () => {
      const row = {deleted_at: '2024-01-01', used_at: null, expires_at: null} as any;
      expect(component.statusOf(row)).toBe('deleted');
    });

    it('returns used when used_at is set', () => {
      const row = {deleted_at: null, used_at: '2024-01-01', expires_at: null} as any;
      expect(component.statusOf(row)).toBe('used');
    });

    it('returns expired when past expires_at', () => {
      const row = {deleted_at: null, used_at: null, expires_at: '2000-01-01'} as any;
      expect(component.statusOf(row)).toBe('expired');
    });

    it('returns active for a non-expired, non-used, non-deleted link', () => {
      const row = {deleted_at: null, used_at: null, expires_at: null} as any;
      expect(component.statusOf(row)).toBe('active');
    });
  });
});

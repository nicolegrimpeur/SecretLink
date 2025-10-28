import { TestBed } from '@angular/core/testing';

import { AppVersionService } from './app-version.service';

describe('AppVersion', () => {
  let service: AppVersionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppVersionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import {TestBed} from '@angular/core/testing';

import {AppVersionService} from './app-version';

describe('AppVersionService', () => {
  let service: AppVersionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppVersionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exposes a non-empty version string', () => {
    expect(service.version).toBeTruthy();
    expect(typeof service.version).toBe('string');
  });

  it('version matches semver format (x.y.z)', () => {
    expect(service.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

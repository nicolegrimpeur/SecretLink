import { TestBed } from '@angular/core/testing';

import { Links } from './links';

describe('Links', () => {
  let service: Links;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Links);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

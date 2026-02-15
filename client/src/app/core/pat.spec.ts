import {TestBed} from '@angular/core/testing';

import {Pat} from './pat';

describe('Pat', () => {
  let service: Pat;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Pat);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import {TestBed} from '@angular/core/testing';
import {ToastController} from '@ionic/angular/standalone';
import type {Mock} from 'vitest';

import {ToastService} from './toast';

describe('ToastService', () => {
  let service: ToastService;
  let mockToastEl: {present: Mock};
  let mockToastCtrl: {create: Mock};

  beforeEach(() => {
    mockToastEl = {present: vi.fn().mockReturnValue(Promise.resolve())};
    mockToastCtrl = {
      create: vi.fn().mockReturnValue(Promise.resolve(mockToastEl))
    };

    TestBed.configureTestingModule({
      providers: [{provide: ToastController, useValue: mockToastCtrl}]
    });
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates and presents a toast with the given message', async () => {
    await service.toastMsg('Hello!');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      expect.objectContaining({message: 'Hello!'})
    );
    expect(mockToastEl.present).toHaveBeenCalled();
  });

  it('uses default duration of 2000ms', async () => {
    await service.toastMsg('msg');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      expect.objectContaining({duration: 2000})
    );
  });

  it('uses default position of bottom', async () => {
    await service.toastMsg('msg');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      expect.objectContaining({position: 'bottom'})
    );
  });

  it('accepts a custom duration', async () => {
    await service.toastMsg('msg', 5000);
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      expect.objectContaining({duration: 5000})
    );
  });

  it('accepts position top', async () => {
    await service.toastMsg('msg', 2000, 'top');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      expect.objectContaining({position: 'top'})
    );
  });
});

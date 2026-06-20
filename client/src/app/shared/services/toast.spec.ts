import {TestBed} from '@angular/core/testing';
import {ToastController} from '@ionic/angular/standalone';

import {ToastService} from './toast';

describe('ToastService', () => {
  let service: ToastService;
  let mockToastEl: {present: jasmine.Spy};
  let mockToastCtrl: {create: jasmine.Spy};

  beforeEach(() => {
    mockToastEl = {present: jasmine.createSpy('present').and.returnValue(Promise.resolve())};
    mockToastCtrl = {
      create: jasmine.createSpy('create').and.returnValue(Promise.resolve(mockToastEl))
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
      jasmine.objectContaining({message: 'Hello!'})
    );
    expect(mockToastEl.present).toHaveBeenCalled();
  });

  it('uses default duration of 2000ms', async () => {
    await service.toastMsg('msg');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({duration: 2000})
    );
  });

  it('uses default position of bottom', async () => {
    await service.toastMsg('msg');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({position: 'bottom'})
    );
  });

  it('accepts a custom duration', async () => {
    await service.toastMsg('msg', 5000);
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({duration: 5000})
    );
  });

  it('accepts position top', async () => {
    await service.toastMsg('msg', 2000, 'top');
    expect(mockToastCtrl.create).toHaveBeenCalledWith(
      jasmine.objectContaining({position: 'top'})
    );
  });
});

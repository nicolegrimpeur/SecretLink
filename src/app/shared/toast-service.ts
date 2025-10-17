import {inject, Injectable} from '@angular/core';
import {ToastController} from "@ionic/angular/standalone";

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toast = inject(ToastController);

  async toastMsg(message: string, duration: number = 2000, position: 'top' | 'bottom' = 'bottom') {
    const t = await this.toast.create({message, duration, position});
    await t.present();
  }
}

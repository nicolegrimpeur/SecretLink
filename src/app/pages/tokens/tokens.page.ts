import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  ModalController
} from '@ionic/angular/standalone';
import {PAT} from "../../shared/models/pat";
import {PatService} from "../../shared/services/pat";
import {AlertController, ToastController} from "@ionic/angular";
import {TokenCreateComponent} from "./modal/token-create.component";

@Component({
  selector: 'app-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonButton, IonList, IonLabel, IonItem, IonInput, IonBadge, IonButtons]
})
export class TokensPage {
  private api = inject(PatService);
  private toast = inject(ToastController);
  private alert = inject(AlertController);
  private modal = inject(ModalController);

  list = signal<PAT[]>([]);
  q = signal('');
  filtered = computed(() => {
    const s = (this.q() || '').toLowerCase();
    if (!s) return this.list();
    return this.list().filter(t =>
      (t?.label || '').toLowerCase().includes(s) ||
      t?.scopes.some(x => x.toLowerCase().includes(s))
    );
  });

  async ionViewWillEnter() {
    await this.reload();
  }

  async reload() {
    this.list.set(await this.api.list());
  }

  async openCreate() {
    const m = await this.modal.create({component: TokenCreateComponent});
    await m.present();
    const {data, role} = await m.onWillDismiss();
    if (role === 'created') {
      await this.reload();
      await this.toastMsg('Token créé. Copiez-le et stockez-le en lieu sûr.');
    }
  }

  async confirmRevoke(t: PAT) {
    const a = await this.alert.create({
      header: 'Révoquer ce token ?',
      message: `Label: ${t?.label || '—'}`,
      buttons: [
        {text: 'Annuler', role: 'cancel'},
        {text: 'Révoquer', role: 'destructive', handler: () => this.revoke(t)}
      ]
    });
    await a.present();
  }

  async revoke(t: PAT) {
    if (t) {
      await this.api.revoke(t.id);
      await this.reload();
      this.toastMsg('Token révoqué').then();
    }
  }

  private async toastMsg(message: string) {
    const t = await this.toast.create({message, duration: 1400, position: 'bottom'});
    t.present().then();
  }

  applyFilter(event: any) { /* computed filtered() se met à jour via q */
    console.log(event);
    this.q.set(event?.detail?.value || '');
    console.log(this.q);
    console.log(this.filtered);
    console.log(this.filtered());
  }
}

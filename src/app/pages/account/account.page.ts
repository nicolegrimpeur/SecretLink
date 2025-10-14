import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent,
  IonInput, IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonList, IonText, IonToggle,
  ModalController
} from '@ionic/angular/standalone';
import {PAT} from "../../shared/models/pat";
import {PatService} from "../../shared/services/pat";
import {AlertController, ToastController} from "@ionic/angular";
import {TokenCreateComponent} from "./modal/token-create.component";
import {AuthService} from "../../shared/services/auth";
import {Storage} from "../../core/storage";

@Component({
  selector: 'app-tokens',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonButton, IonList, IonLabel, IonItem, IonInput, IonBadge, IonButtons, IonText, ReactiveFormsModule, IonCard, IonCardTitle, IonCardHeader, IonCardContent, IonInputPasswordToggle, IonToggle]
})
export class AccountPage {
  private api = inject(PatService);
  private toast = inject(ToastController);
  private alert = inject(AlertController);
  private modal = inject(ModalController);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private storage = inject(Storage);


  /////////// Gestion du mot de passe ///////////
  loading = false;
  error: string | null = null;

  form = this.fb.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  async submit() {
    if (this.form.invalid) return;
    const {current_password, new_password, confirm} = this.form.value as any;
    if (new_password !== confirm) {
      this.error = 'Les mots de passe ne correspondent pas';
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      await this.auth.changePassword(current_password, new_password);
      await (await this.toast.create({message: 'Mot de passe mis à jour', duration: 1400})).present();
    } catch (e: any) {
      this.error = e?.error?.error?.message || 'Échec de la mise à jour';
    } finally {
      this.loading = false;
    }
  }


  /////////// Gestion des tokens ///////////
  displayActiveOnly = signal<boolean>(true);
  list = signal<PAT[]>([]);
  q = signal('');
  filtered = computed(() => {
    const s = (this.q() || '').toLowerCase();
    if (!s) return this.list().filter(t =>
      this.displayActiveOnly() ? !t?.revoked_at : true
    );
    return this.list().filter(t =>
      ((t?.label || '').toLowerCase().includes(s) || t?.scopes.some(x => x.toLowerCase().includes(s))) &&
      (this.displayActiveOnly() ? !t?.revoked_at : true)
    );
  });

  async ionViewWillEnter() {
    this.displayActiveOnly.set(await this.storage.get<boolean>('acc_showRevoked') ?? true);
    await this.reload();
  }

  async reload() {
    this.list.set(await this.api.list());
  }

  toggleShowRevoked(v: boolean) {
    this.displayActiveOnly.set(v);
    this.storage.set('acc_showRevoked', v).then();
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
}

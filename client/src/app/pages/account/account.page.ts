import {Component, computed, inject, signal} from '@angular/core';

import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonList,
  IonRow,
  IonText,
  IonToggle,
  ModalController
} from '@ionic/angular/standalone';
import {PAT} from "../../shared/models/pat";
import {PatService} from "../../core/pat";
import {TokenCreateComponent} from "./modal/token-create.component";
import {AuthService} from "../../core/auth";
import {StorageService} from "../../shared/services/storage";
import {ToastService} from "../../shared/services/toast";
import {addIcons} from "ionicons";
import {trashBinOutline, trashOutline} from "ionicons/icons";
import {Router} from "@angular/router";

@Component({
  selector: 'app-tokens',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, IonButton, IonList, IonLabel, IonItem, IonInput, IonBadge, IonButtons, IonText, ReactiveFormsModule, IonCard, IonCardTitle, IonCardHeader, IonCardContent, IonInputPasswordToggle, IonToggle, IonIcon, IonGrid, IonRow, IonCol]
})
export class AccountPage {
  private api = inject(PatService);
  private toast = inject(ToastService);
  private alert = inject(AlertController);
  private modal = inject(ModalController);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private router = inject(Router);


  /////////// Gestion du mot de passe ///////////
  loading = false;
  error: string | null = null;

  form = this.fb.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  constructor() {
    addIcons({trashOutline, trashBinOutline});
  }

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
      await this.toast.toastMsg('Mot de passe mis à jour', 1400);
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
      await this.toast.toastMsg('Token créé. Copiez-le et stockez-le en lieu sûr.');
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
      this.toast.toastMsg('Token révoqué').then();
    }
  }

  ///// purge du compte, donc supprimer les liens inactifs et les api keys révoqués /////
  async purgeAccount() {
    const a = await this.alert.create({
      header: 'Purger le compte ?',
      message: `Cette action supprimera tous les liens inactifs (utilisés, expirés ou supprimés) et supprimera tous les tokens révoqués.`,
      buttons: [
        {text: 'Annuler', role: 'cancel'},
        {
          text: 'Purger', role: 'destructive', handler: async () => {
            try {
              await this.auth.purgeMe();
              this.toast.toastMsg('Compte purgé').then();
              await this.reload();
            } catch {
              this.toast.toastMsg('Échec de la purge du compte').then();
            }
          }
        },
      ]
    });
    await a.present();
  }

  async deleteAccount() {
    const alert = await this.alert.create({
      header: 'Supprimer le compte ?',
      message: `Cette action est irréversible. Tapez \'supprimer\' ci-dessous pour confirmer :`,
      cssClass: 'delete-account-alert',
      inputs: [
        {
          name: 'confirmText',
          type: 'text',
          placeholder: 'Écrire "supprimer" pour confirmer'
        }
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: (data) => {
            if (data.confirmText?.toLowerCase() === 'supprimer') {
              this.auth.deleteMe()
                .then(() => {
                  this.toast.toastMsg('Compte supprimé');
                  this.router.navigateByUrl('/auth', {replaceUrl: true}).then();
                })
                .catch(() => {
                  this.toast.toastMsg('Échec de la suppression du compte');
                });
              return true; // permet la fermeture de l’alerte
            } else {
              this.toast.toastMsg('Texte de confirmation invalide');
              return false; // empêche la fermeture de l’alerte
            }
          }
        }
      ]
    });

    await alert.present();
  }
}

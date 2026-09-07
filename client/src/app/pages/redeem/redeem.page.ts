import {Component, inject, OnInit, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';

import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonSkeletonText,
  IonText,
  IonTextarea
} from '@ionic/angular';
import {ToastController} from "@ionic/angular/lazy";
import {ActivatedRoute} from "@angular/router";
import {addIcons} from "ionicons";
import {copyOutline, lockClosedOutline} from "ionicons/icons";
import {LinksService} from "../../core/links";
import {CryptoService} from "../../shared/services/crypto";

@Component({
  selector: 'app-redeem',
  templateUrl: './redeem.page.html',
  styleUrls: ['./redeem.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, IonCard, IonCardTitle, IonCardHeader, IonCardSubtitle, IonCardContent, IonItem, IonCheckbox, IonButton, IonSkeletonText, IonIcon, IonInput, IonInputPasswordToggle, ReactiveFormsModule, IonText, IonTextarea]
})
export class RedeemPage implements OnInit {
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);
  private linksService = inject(LinksService);
  private crypto = inject(CryptoService);
  private fb = inject(FormBuilder);

  // Pas un signal : lu une seule fois dans ngOnInit et jamais rendu.
  token = '';

  state = signal<'ready' | 'loading' | 'success' | 'error' | 'passphrase_required'>('ready');
  loading = signal(false);
  ack = signal(false);

  secret = signal<string | null>(null);
  itemId = signal<string | null>(null);
  errorMessage = signal('Ce lien a peut-être déjà été utilisé, supprimé ou a expiré.');
  form = this.fb.group({
    passphrase: ['', [Validators.required]]
  });
  isPassphraseInvalid = signal(false);

  constructor() {
    addIcons({lockClosedOutline, copyOutline});
  }

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }

  async reveal() {
    if (!this.token) {
      this.state.set('error');
      return;
    }
    this.loading.set(true);
    if (this.state() !== 'passphrase_required') this.state.set('loading');

    try {
      const pass = this.form.value.passphrase?.trim();
      const passphrase_hash = pass ? await this.crypto.hashPassphrase(pass) : '';

      const redeemResponse = await this.linksService.redeemLink(this.token, passphrase_hash);

      this.itemId.set(redeemResponse.item_id);
      this.secret.set(await this.crypto.decryptIfNeeded(redeemResponse.secret, pass));
      this.state.set('success');
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 403) {
        if (err.error?.error?.code === 'PASSPHRASE_REQUIRED') {
          this.state.set('passphrase_required');
        } else if (err.error?.error?.code === 'INVALID_PASSPHRASE') {
          this.state.set('passphrase_required');
          this.isPassphraseInvalid.set(true);
        }
      } else {
        const status = err.status;
        const msg =
          status === 404 ? 'Lien introuvable.' :
            status === 410 ? 'Lien déjà utilisé ou expiré.' :
              status === 429 ? 'Trop de tentatives. Réessayez dans un instant.' :
                status === 403 ? 'Passphrase incorrecte.' :
                  err.error?.error?.message || 'Impossible de révéler le secret.';
        this.fail(msg);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async copy() {
    const secret = this.secret();
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    await (await this.toast.create({
      message: 'Copié dans le presse papier',
      duration: 1200,
      position: 'bottom'
    })).present();
  }

  private fail(msg?: string) {
    if (msg) this.errorMessage.set(msg);
    this.state.set('error');
  }
}

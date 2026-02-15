import {Component, inject, OnInit} from '@angular/core';

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
} from '@ionic/angular/standalone';
import {ToastController} from "@ionic/angular";
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

  token = '';
  state: 'ready' | 'loading' | 'success' | 'error' | 'passphrase_required' = 'ready';
  loading = false;
  ack = false;

  secret: string | null = null;
  itemId: string | null = null;
  errorMessage = 'Ce lien a peut-être déjà été utilisé, supprimé ou a expiré.';
  form = this.fb.group({
    passphrase: ['', [Validators.required]]
  });
  isPassphraseInvalid = false;

  constructor() {
    addIcons({lockClosedOutline, copyOutline});
  }

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }

  async reveal() {
    if (!this.token) {
      this.state = 'error';
      return;
    }
    this.loading = true;
    if (this.state !== 'passphrase_required') this.state = 'loading';

    try {
      const pass = this.form.value.passphrase?.trim();
      const passphrase_hash = pass ? await this.crypto.hashPassphrase(pass) : '';

      const redeemResponse = await this.linksService.redeemLink(this.token, passphrase_hash);

      this.itemId = redeemResponse.item_id;
      this.secret = await this.crypto.decryptIfNeeded(redeemResponse.secret, pass);
      this.state = 'success';
    } catch (e: any) {
      if (e?.status === 403) {
        if (e?.error?.error?.code === 'PASSPHRASE_REQUIRED') {
          this.state = 'passphrase_required';
        } else if (e?.error?.error?.code === 'INVALID_PASSPHRASE') {
          this.state = 'passphrase_required';
          this.isPassphraseInvalid = true;
        }
      } else {
        const status = e?.status;
        const msg =
          status === 404 ? 'Lien introuvable.' :
            status === 410 ? 'Lien déjà utilisé ou expiré.' :
              status === 429 ? 'Trop de tentatives. Réessayez dans un instant.' :
                status === 403 ? 'Passphrase incorrecte.' :
                  e?.error?.error?.message || 'Impossible de révéler le secret.';
        this.fail(msg);
      }
    } finally {
      this.loading = false;
    }
  }

  async copy() {
    if (!this.secret) return;
    await navigator.clipboard.writeText(this.secret);
    await (await this.toast.create({
      message: 'Copié dans le presse papier',
      duration: 1200,
      position: 'bottom'
    })).present();
  }

  private fail(msg?: string) {
    if (msg) this.errorMessage = msg;
    this.state = 'error';
  }
}

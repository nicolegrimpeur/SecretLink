import {Component, inject, OnInit} from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon, IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRow
} from '@ionic/angular/standalone';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {bulbOutline, cloudOutline, linkOutline, lockClosedOutline, shareSocialOutline} from 'ionicons/icons';
import {AuthService} from "../../core/auth";
import {User} from "../../shared/models/user";
import {AppVersionService} from '../../shared/app-version.service'
import {LinksService} from "../../core/links";
import {FormBuilder, ReactiveFormsModule, Validators} from "@angular/forms";
import {LinkCreateResult, LinkCreateSingleItem} from "../../shared/models/link-create";
import {ToastService} from "../../shared/toast-service";
import {environment} from "../../../environments/environment";

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    ReactiveFormsModule,
    IonInput
  ]
})
export class HomePage implements OnInit {
  private auth = inject(AuthService);
  private appVersion = inject(AppVersionService);
  private linksService = inject(LinksService);
  private toast = inject(ToastService);
  user: User = null;
  version = this.appVersion.version;

  loading = false;
  form = inject(FormBuilder).group({
    secret: ['', [Validators.required]],
  });
  creationResult: LinkCreateResult | null = null;

  private readonly errorCreationHelpText = [
    {code: 'VALIDATION_ERROR', text: 'Les informations fournies ne sont pas valides. Veuillez vérifier les champs et réessayer.'},
    {code: 'SERVER_ERROR', text: 'Une erreur serveur est survenue. Veuillez réessayer plus tard.'},
  ]
  statusHelp: { [key: string]: string } = {
    'created': 'Lien créé avec succès.',
    'invalid_item_id': 'Les informations fournies sont invalides. Veuillez les vérifier et réessayer.',
  }

  constructor() {
    addIcons({
      lockClosedOutline,
      linkOutline,
      shareSocialOutline,
      bulbOutline,
      cloudOutline
    });
  }

  ngOnInit() {
    this.auth.user$.subscribe(u => this.user = u);
  }

  async createSecret() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const payload: LinkCreateSingleItem = {
        secret: this.form.value.secret!,
      };
      this.creationResult = await this.linksService.createSingle(payload);
    } catch (e: any) {
      const errorCode = e?.error?.error?.code || 'SERVER_ERROR';
      const helpEntry = this.errorCreationHelpText.find(entry => entry.code === errorCode);
      const helpMessage = helpEntry ? helpEntry.text : 'Création échouée.';

      this.toast.toastMsg(helpMessage, 3000).then();
    } finally {
      this.loading = false;
    }
  }

  linkUrl(token: string) {
    return `${environment.frontBaseUrl}/redeem/${encodeURIComponent(token)}`;
  }

  copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => this.toast.toastMsg('Copié dans le presse-papier').then())
      .catch(() => this.toast.toastMsg('Échec de la copie dans le presse-papier').then());
  }
}


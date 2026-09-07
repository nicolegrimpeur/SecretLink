import {Component, DestroyRef, inject, OnInit, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {apiErrorText} from '../../shared/services/api-error';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRow
} from '@ionic/angular';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {
  browsersOutline,
  bulbOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cloudOutline,
  linkOutline,
  lockClosedOutline,
  extensionPuzzleOutline,
  shareSocialOutline,
  textOutline,
  timeOutline
} from 'ionicons/icons';
import {AuthService} from "../../core/auth";
import {User} from "../../shared/models/user";
import {AppVersionService} from '../../shared/services/app-version'
import {LinksService} from "../../core/links";
import {FormBuilder, ReactiveFormsModule, Validators} from "@angular/forms";
import {LinkCreateResult, LinkCreateSingleItem} from "../../shared/models/link-create";
import {ToastService} from "../../shared/services/toast";
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
    IonInput,
    IonBadge,
    IonAccordion,
    IonAccordionGroup
  ]
})
export class HomePage implements OnInit {
  private auth = inject(AuthService);
  private appVersion = inject(AppVersionService);
  private linksService = inject(LinksService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  user = signal<User>(null);
  version = this.appVersion.version;
  chromeExtensionUrl = environment.chromeExtensionUrl;

  loading = signal(false);
  form = inject(FormBuilder).group({
    secret: ['', [Validators.required]],
  });
  creationResult = signal<LinkCreateResult | null>(null);

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
      cloudOutline,
      textOutline,
      timeOutline,
      closeCircleOutline,
      checkmarkCircleOutline,
      extensionPuzzleOutline,
      browsersOutline
    });
  }

  ngOnInit() {
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(u => this.user.set(u));
  }

  async createSecret() {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      const payload: LinkCreateSingleItem = {
        secret: this.form.value.secret!,
      };
      this.creationResult.set(await this.linksService.createSingle(payload));
    } catch (e) {
      this.toast.toastMsg(apiErrorText(e, {fallback: 'Création échouée.'}), 3000).then();
    } finally {
      this.loading.set(false);
    }
  }

  copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => this.toast.toastMsg('Copié dans le presse-papier').then())
      .catch(() => this.toast.toastMsg('Échec de la copie dans le presse-papier').then());
  }
}


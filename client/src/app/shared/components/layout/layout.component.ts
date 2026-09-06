import {Component, DestroyRef, inject, OnInit, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonPopover,
  IonRouterOutlet,
  IonTitle,
  IonToolbar,
  NavController,
  PopoverController,
  ToastController
} from "@ionic/angular";
import {Router, RouterLink} from "@angular/router";
import {addIcons} from 'ionicons';
import {
  chevronDownOutline,
  chevronUpOutline,
  constructOutline,
  gridOutline,
  keyOutline,
  linkOutline,
  lockClosedOutline,
  logOutOutline,
  personCircleOutline,
} from 'ionicons/icons';
import {AuthService} from "../../../core/auth";
import {StorageService} from "../../services/storage";
import {User} from "../../models/user";
import {NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonIcon,
    IonButton,
    IonPopover,
    IonContent,
    IonItem,
    IonList,
    RouterLink,
    IonTitle,
    IonRouterOutlet,
    NgOptimizedImage
  ]
})
export class LayoutComponent implements OnInit {
  public popoverOpen = signal(false);
  private router = inject(Router);
  private auth = inject(AuthService);
  private nav = inject(NavController);
  private storage = inject(StorageService);
  private toastController = inject(ToastController);
  private popoverController = inject(PopoverController);
  private destroyRef = inject(DestroyRef);
  user = signal<User>(null);
  isManagementPage = signal(false);
  tabManagementPages = ['/account', '/dashboard', '/links'];
  // Pas un signal : jamais rendu, uniquement lu pour décider d'afficher le toast.
  cookieConsentGiven = false;

  constructor() {
    addIcons({
      lockClosedOutline,
      linkOutline,
      gridOutline,
      personCircleOutline,
      chevronDownOutline,
      keyOutline,
      constructOutline,
      logOutOutline,
      chevronUpOutline,
    });
  }

  ngOnInit() {
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(u => this.user.set(u));

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.isManagementPage.set(this.tabManagementPages.some(path => this.router.url.startsWith(path)));
    });

    this.storage.get<boolean>('cookieConsent').then(consent => {
      this.cookieConsentGiven = consent === true;
      if (!this.cookieConsentGiven) {
        this.showCookieConsent().then();
      }
    });
  }

  onClickSecretLink()  {
    this.nav.navigateRoot('/home').then();
  }

  async handleLogout() {
    this.popoverOpen.set(false);
    await this.popoverController.dismiss().catch(() => {});

    await this.auth.logout();
    await this.router.navigateByUrl('/auth');
  }

  async showCookieConsent() {
    const toastButton = [
      {
        text: 'Plus d\'informations',
        role: 'info',
        handler: () => {
          this.router.navigateByUrl('/privacy').then();
        }
      },
      {
        text: 'Fermer',
        role: 'accept',
        handler: async () => {
          this.cookieConsentGiven = true;
          await this.storage.set('cookieConsent', true);
        }
      }
    ];

    const toast = await this.toastController.create({
      message: 'Ce site utilise uniquement des cookies essentiels à son bon fonctionnement. Aucun cookie de suivi n\'est utilisé.',
      duration: 10000,
      position: 'bottom',
      buttons: toastButton,
      color: 'primary',
      layout: 'stacked'
    });

    await toast.present();
  }
}

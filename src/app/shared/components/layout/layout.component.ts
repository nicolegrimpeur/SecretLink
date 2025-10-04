import {Component, inject} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon, IonItem,
  IonLabel, IonList, IonListHeader,
  IonPopover,
  IonToolbar
} from "@ionic/angular/standalone";
import {Router, RouterLink, RouterLinkActive} from "@angular/router";

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
    IonLabel,
    IonItem,
    IonListHeader,
    IonList,
    RouterLink,
    RouterLinkActive
  ]
})
export class LayoutComponent {
  private router = inject(Router);

  constructor() { }

  user = {
    name: 'John Doe',
    email: 'johndoe@gmail.com',
  };

  navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid-outline' },
    { path: '/links',     label: 'Links',     icon: 'list-outline' },
    { path: '/tokens',    label: 'Tokens',    icon: 'key-outline'  },
  ];

  async handleLogout() {
    await this.router.navigateByUrl('/auth/login');
  }

}

import {Component, inject, OnInit} from '@angular/core';
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
  IonToolbar
} from "@ionic/angular/standalone";
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
import {AuthService} from "../../services/auth";
import {User} from "../../models/user";

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
    IonRouterOutlet
  ]
})
export class LayoutComponent implements OnInit {
  public popoverOpen = false;
  private router = inject(Router);
  private auth = inject(AuthService);
  user: User = null;

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
    this.auth.user$.subscribe(u => this.user = u);
  }

  async handleLogout() {
    // dismiss the popover first
    this.popoverOpen = false;


    await this.auth.logout();
    await this.router.navigateByUrl('/auth');
  }
}

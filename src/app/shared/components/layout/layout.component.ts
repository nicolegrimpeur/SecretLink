import {Component} from '@angular/core';
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
import {RouterLink} from "@angular/router";
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
export class LayoutComponent {
  public popoverOpen = false;

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

}

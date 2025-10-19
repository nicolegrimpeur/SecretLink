import {Component} from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRow
} from '@ionic/angular/standalone';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {checkmarkCircleOutline, cloudOutline, linkOutline, lockClosedOutline, shareSocialOutline} from 'ionicons/icons';

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
    IonIcon
  ]
})
export class HomePage  {

  constructor() {
    addIcons({
      lockClosedOutline,
      linkOutline,
      shareSocialOutline,
      checkmarkCircleOutline,
      cloudOutline
    });
  }

}


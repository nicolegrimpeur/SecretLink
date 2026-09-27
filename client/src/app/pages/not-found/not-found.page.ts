import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonIcon} from '@ionic/angular';
import {addIcons} from 'ionicons';
import {unlinkOutline} from 'ionicons/icons';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.page.html',
  styleUrls: ['./not-found.page.scss'],
  standalone: true,
  imports: [IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton, IonIcon, RouterLink]
})
export class NotFoundPage {
  constructor() {
    addIcons({unlinkOutline});
  }
}

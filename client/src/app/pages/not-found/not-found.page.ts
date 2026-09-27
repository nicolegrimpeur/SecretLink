import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent} from '@ionic/angular';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.page.html',
  standalone: true,
  imports: [IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, RouterLink]
})
export class NotFoundPage {}

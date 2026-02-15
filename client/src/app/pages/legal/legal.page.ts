import {Component} from '@angular/core';

import {FormsModule} from '@angular/forms';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-legal',
  templateUrl: './legal.page.html',
  styleUrls: ['./legal.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, IonCardTitle, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle]
})
export class LegalPage {

  constructor() { }

}

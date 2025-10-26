import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
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
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonCardSubtitle]
})
export class PrivacyPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}

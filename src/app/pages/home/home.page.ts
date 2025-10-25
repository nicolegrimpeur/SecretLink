import {Component, inject, OnInit} from '@angular/core';
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
import {bulbOutline, cloudOutline, linkOutline, lockClosedOutline, shareSocialOutline} from 'ionicons/icons';
import {AuthService} from "../../core/auth";
import {User} from "../../shared/models/user";

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
export class HomePage implements OnInit {
  private auth = inject(AuthService);
  user: User = null;

  constructor() {
    addIcons({
      lockClosedOutline,
      linkOutline,
      shareSocialOutline,
      bulbOutline,
      cloudOutline
    });
  }

  ngOnInit() {
    this.auth.user$.subscribe(u => this.user = u);
  }
}


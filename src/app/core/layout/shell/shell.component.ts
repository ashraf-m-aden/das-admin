import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';

/**
 * Enveloppe des routes protégées : Header (nav + user menu) + contenu de
 * la route + Footer. Utilisé comme composant parent dans app.routes.ts.
 */
@Component({
  selector: 'das-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}

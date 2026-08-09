import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

/**
 * Enveloppe des routes protégées : rail de navigation (Sidebar) + contenu
 * de la route. Chaque page fournit son propre en-tête via das-page-header.
 */
@Component({
  selector: 'das-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}

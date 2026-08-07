import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'das-settings-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslocoModule],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent { }

import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';

@Component({
  selector: 'das-addressing-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslocoModule, PageHeaderComponent],
  templateUrl: './addressing-shell.component.html',
  styleUrl: './addressing-shell.component.scss',
})
export class AddressingShellComponent {}

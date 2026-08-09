import { Component, input } from '@angular/core';

@Component({
  selector: 'das-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>();
  readonly title = input.required<string>();
}

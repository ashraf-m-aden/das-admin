import { Component, input, output } from '@angular/core';

@Component({
  selector: 'das-date-range-button',
  standalone: true,
  templateUrl: './date-range-button.component.html',
  styleUrl: './date-range-button.component.scss',
})
export class DateRangeButtonComponent {
  /** Libellé déjà formaté (ex. « 25 avr – 25 mai 2025 » ou « 22 mai 2025 »). */
  readonly label = input.required<string>();
  readonly clicked = output<void>();
}

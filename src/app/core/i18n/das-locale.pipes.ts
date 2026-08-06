import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

@Pipe({ name: 'dasDate', standalone: true, pure: false })
export class DasDatePipe implements PipeTransform {
  private transloco = inject(TranslocoService);

  transform(value: string | Date | null | undefined, style: 'short' | 'long' = 'short'): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    const locale = this.transloco.getActiveLang() === 'en' ? 'en-US' : 'fr-FR';
    const options: Intl.DateTimeFormatOptions =
      style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
}

@Pipe({ name: 'dasNumber', standalone: true, pure: false })
export class DasNumberPipe implements PipeTransform {
  private transloco = inject(TranslocoService);

  transform(value: number | null | undefined, fractionDigits = 0): string {
    if (value === null || value === undefined) return '';
    const locale = this.transloco.getActiveLang() === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }
}

import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ToastService } from './toast.service';
import { ToastKind } from './toast.model';

@Component({
  selector: 'das-toast-container',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  private toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected readonly icons: Record<ToastKind, string> = {
    success: 'ti-circle-check',
    error: 'ti-alert-circle',
    info: 'ti-info-circle',
  };

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}

import { Component, inject } from '@angular/core';
import { AppConfigService } from '../../config/app-config.service';

@Component({
  selector: 'das-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private config = inject(AppConfigService);

  protected readonly environment = this.config.get('environment');
  protected readonly isMockMode = this.config.get('useMockApi');
  protected readonly currentYear = new Date().getFullYear();
}

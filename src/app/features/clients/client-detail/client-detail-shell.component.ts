import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientsFacade } from '../../../core/clients/store/clients.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';

@Component({
  selector: 'das-client-detail-shell',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet, TranslocoModule, PageHeaderComponent],
  templateUrl: './client-detail-shell.component.html',
  styleUrl: './client-detail-shell.component.scss',
})
export class ClientDetailShellComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private facade = inject(ClientsFacade);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly client$ = this.facade.getById$(this.clientId);

  ngOnInit(): void {
    this.facade.load();
  }
}

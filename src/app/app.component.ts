import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthFacade } from './core/auth/store/auth.facade';

@Component({
  selector: 'das-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private authFacade = inject(AuthFacade);

  ngOnInit(): void {
    this.authFacade.restoreSession();
  }
}

import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { SiteInfo } from '../../models/catalog.model';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  private catalog = inject(CatalogService);

  currentYear = new Date().getFullYear();
  site = signal<SiteInfo | null>(null);

  constructor() {
    this.catalog.getSite().subscribe({
      next: s => this.site.set(s),
      error: () => {},
    });
  }

  get whatsappLink(): string {
    const num = this.site()?.restaurant.whatsapp ?? '';
    return `https://wa.me/92${num.replace(/^0/, '').replace(/\D/g, '')}`;
  }
}

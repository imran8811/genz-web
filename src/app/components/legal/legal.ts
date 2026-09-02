import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { SiteInfo } from '../../models/catalog.model';

/**
 * Contact details Google Play requires on the privacy policy and the account
 * deletion page. Address and phone come live from `/site` (same source the
 * footer uses) so they can never drift.
 *
 * ⚠ PLACEHOLDER — this mailbox has not been confirmed to exist. Play requires a
 * working contact address, and the deletion page tells people to email it, so
 * confirm it receives mail (or replace it) BEFORE deploying these pages.
 */
export const SUPPORT_EMAIL = 'support@genzfoods.pk';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './legal.scss',
})
export class Privacy {
  private catalog = inject(CatalogService);

  supportEmail = SUPPORT_EMAIL;
  /** Last substantive revision — update whenever the wording changes. */
  updated = '2 September 2026';
  site = signal<SiteInfo | null>(null);

  constructor() {
    this.catalog.getSite().subscribe({ next: s => this.site.set(s), error: () => {} });
  }
}

@Component({
  selector: 'app-account-deletion',
  imports: [RouterLink],
  templateUrl: './account-deletion.html',
  styleUrl: './legal.scss',
})
export class AccountDeletion {
  private catalog = inject(CatalogService);

  supportEmail = SUPPORT_EMAIL;
  site = signal<SiteInfo | null>(null);

  constructor() {
    this.catalog.getSite().subscribe({ next: s => this.site.set(s), error: () => {} });
  }
}

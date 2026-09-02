import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit,
  PLATFORM_ID, computed, inject, signal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { Category, Deal, MenuItem, Variant } from '../../models/catalog.model';

interface Tab { slug: string; name: string; }

@Component({
  selector: 'app-menu',
  imports: [RouterLink, DecimalPipe, FormsModule],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu implements OnInit, AfterViewInit, OnDestroy {
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private route = inject(ActivatedRoute);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  categories = signal<Category[]>([]);
  deals = signal<Deal[]>([]);
  loading = signal(true);
  activeTab = signal<string>('');

  // item slug -> chosen size label ('' for single-price items)
  private chosenVariant = signal<Record<string, string>>({});
  toast = signal<string>('');

  activeDeal = signal<Deal | null>(null);
  dealPicks = signal<string[]>([]);

  cartCount = this.cart.itemCount;
  cartSubtotal = this.cart.subtotal;

  private observer: IntersectionObserver | null = null;
  private suppressSpy = false;
  private pendingFragment: string | null = null;

  tabs = computed<Tab[]>(() => {
    const cats = this.categories().map(c => ({ slug: c.slug, name: c.name }));
    return this.deals().length ? [...cats, { slug: 'deals', name: 'Deals' }] : cats;
  });

  dealGroups = computed(() => {
    const groups = new Map<string, Deal[]>();
    for (const d of this.deals()) {
      const g = d.group ?? 'Deals';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(d);
    }
    return Array.from(groups, ([name, items]) => ({ name, items }));
  });

  ngOnInit(): void {
    this.pendingFragment = this.route.snapshot.fragment;
    this.catalog.getMenu().subscribe({
      next: cats => {
        this.categories.set(cats);
        if (cats.length) this.activeTab.set(cats[0].slug);
        this.loading.set(false);
        this.scheduleSpy();
      },
      error: () => this.loading.set(false),
    });
    this.catalog.getDeals().subscribe({
      next: d => { this.deals.set(d); this.scheduleSpy(); },
      error: () => {},
    });
  }

  ngAfterViewInit(): void { this.scheduleSpy(); }

  ngOnDestroy(): void { this.observer?.disconnect(); }

  // ----- scroll-spy -----
  private scheduleSpy(): void {
    if (!this.isBrowser) return;
    setTimeout(() => {
      this.setupObserver();
      if (this.pendingFragment) {
        const frag = this.pendingFragment;
        this.pendingFragment = null;
        this.scrollToSection(frag, false);
      }
    });
  }

  private setupObserver(): void {
    this.observer?.disconnect();
    const sections = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[data-section]'),
    );
    if (!sections.length) return;

    this.observer = new IntersectionObserver(
      entries => {
        if (this.suppressSpy) return;
        // Pick the top-most section currently intersecting the trigger band.
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          const slug = (visible[0].target as HTMLElement).dataset['section'];
          if (slug) this.activeTab.set(slug);
        }
      },
      { rootMargin: '-150px 0px -65% 0px', threshold: 0 },
    );
    sections.forEach(s => this.observer!.observe(s));
  }

  setTab(slug: string): void {
    this.activeTab.set(slug);
    this.scrollToSection(slug, true);
  }

  private scrollToSection(slug: string, smooth: boolean): void {
    if (!this.isBrowser) return;
    const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-section="${slug}"]`);
    if (!el) return;
    this.suppressSpy = true;
    this.activeTab.set(slug);
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    this.ensureTabVisible(slug);
    setTimeout(() => (this.suppressSpy = false), smooth ? 700 : 200);
  }

  private ensureTabVisible(slug: string): void {
    const tab = this.host.nativeElement.querySelector<HTMLElement>(`[data-tab="${slug}"]`);
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  // ----- images -----
  // An image URL that 404s (or serves HTML — see the genz-admin ADMIN_PUBLIC_URL
  // note in CLAUDE.md) must fall back to the emoji, not a broken-image icon.
  private brokenImages = signal<ReadonlySet<string>>(new Set());

  hasImage(slug: string, url: string | null): boolean {
    return !!url && !this.brokenImages().has(slug);
  }
  imageFailed(slug: string): void {
    this.brokenImages.update(s => new Set(s).add(slug));
  }

  // ----- items -----
  variantOf(item: MenuItem): Variant | null {
    const label = this.chosenVariant()[item.slug];
    return item.variants.find(v => (v.label ?? '') === label) ?? item.variants[0] ?? null;
  }
  chooseVariant(item: MenuItem, variant: Variant): void {
    this.chosenVariant.update(m => ({ ...m, [item.slug]: variant.label ?? '' }));
  }
  isChosen(item: MenuItem, variant: Variant): boolean {
    return this.variantOf(item)?.label === variant.label;
  }
  addItem(item: MenuItem): void {
    const v = this.variantOf(item);
    if (!v) return;
    this.cart.add({
      key: `item:${item.slug}:${v.label ?? ''}`,
      kind: 'item',
      itemSlug: item.slug,
      size: v.label,
      name: item.name,
      variantLabel: v.label,
      image: this.catalog.imageFor(item),
      unitPrice: v.price,
    });
    this.flash(`${item.name}${v.label ? ' (' + v.label + ')' : ''} added`);
  }

  // ----- deals -----
  startDeal(deal: Deal): void {
    if (deal.requires_selection && deal.options.length) {
      const first = deal.options[0].name;
      this.dealPicks.set(Array.from({ length: deal.selection_count }, () => first));
      this.activeDeal.set(deal);
    } else {
      this.addDeal(deal, []);
    }
  }
  setPick(index: number, name: string): void {
    this.dealPicks.update(p => { const n = [...p]; n[index] = name; return n; });
  }
  confirmDeal(): void {
    const deal = this.activeDeal();
    if (deal) this.addDeal(deal, this.dealPicks());
    this.activeDeal.set(null);
  }
  closeDeal(): void { this.activeDeal.set(null); }

  private addDeal(deal: Deal, picks: string[]): void {
    this.cart.add({
      key: picks.length ? `deal:${deal.slug}:${picks.join('|')}` : `deal:${deal.slug}`,
      kind: 'deal',
      dealSlug: deal.slug,
      name: deal.name,
      variantLabel: deal.selection_size,
      image: this.catalog.imageFor({ image_url: deal.image_url, category_slug: deal.category_slug }),
      unitPrice: deal.price,
      selections: picks.length ? picks : undefined,
    });
    this.flash(`${deal.name} added`);
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    if (this.isBrowser) setTimeout(() => this.toast.set(''), 1600);
  }
}

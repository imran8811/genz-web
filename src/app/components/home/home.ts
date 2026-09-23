import { Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { Category, MenuItem } from '../../models/catalog.model';

/**
 * Home page.
 *
 * The category strip and "Popular right now" are built from the **genz-admin
 * public menu feed** (via `CatalogService`), the single source of truth for
 * items, deals and prices; the only static assets there are the fallback
 * photographs used when an item has no image uploaded in genz-admin
 * (`CatalogService.imageFor`).
 *
 * The hero carousel is the exception: it is marketing artwork, not menu data,
 * so it is the hand-kept `BANNER_SLIDES` list below.
 */

/** The banner artwork carries its own copy, so a slide is just the image. */
interface HeroSlide {
  image: string;
  alt: string;
}

/**
 * Home banner carousel, in display order.
 *
 * **To add a banner:** put the image in `public/images/home-banner-slider/` and
 * add an entry here. The `alt` should say what the artwork says, since the
 * price and contents are baked into the image and a screen reader can't read
 * them.
 */
const BANNER_SLIDES: HeroSlide[] = [
  {
    image: 'images/home-banner-slider/banner-1.png',
    alt: 'Large Pizza + Zinger deal, Rs 1650 — 1 large 13" pizza, 1 zinger burger, 1 litre Next Cola',
  },
  {
    image: 'images/home-banner-slider/banner-2.png',
    alt: 'Medium Pizza + Zinger deal, Rs 1099 — 1 medium 8" pizza, 1 zinger burger, 1 litre Next Cola',
  },
  {
    image: 'images/home-banner-slider/banner-3.png',
    alt: 'Small Pizza + Zinger deal, Rs 850 — 1 small 6" pizza, 1 zinger burger, 500ml Next Cola',
  },
  {
    image: 'images/home-banner-slider/banner-4.png',
    alt: 'Large Pizza Deal, Rs 1350 — 1 large 13" pizza and 1 litre Next Cola',
  },
  {
    image: 'images/home-banner-slider/banner-5.png',
    alt: 'Medium Pizza Deal, Rs 850 — 1 medium 8" pizza and 1 litre Next Cola',
  },
  {
    image: 'images/home-banner-slider/banner-6.png',
    alt: 'Small Pizza Deal, Rs 550 — 1 small 6" pizza and 345ml Next Cola',
  },
];

interface CategoryTile {
  name: string;
  slug: string;
  image: string;
}

interface ProductCard {
  item: MenuItem;
  name: string;
  description: string | null;
  price: number;
  /** Sized items (pizza, pasta, drinks) quote their cheapest variant. */
  from: boolean;
  image: string;
  badge: string | null;
}

const PLACEHOLDER = 'images/placeholder.svg';

const POPULAR_COUNT = 8;

@Component({
  selector: 'app-home',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private router = inject(Router);

  /** Static artwork, so the hero is on screen before the feed answers. */
  readonly slides = BANNER_SLIDES;
  categories = signal<CategoryTile[]>([]);
  products = signal<ProductCard[]>([]);
  loading = signal(true);
  failed = signal(false);
  toast = signal('');

  // ── Hero carousel ─────────────────────────────────────────────────────────
  /** How long a slide holds before advancing. */
  readonly slideMs = 6000;
  private readonly tickMs = 100;

  slideIndex = signal(0);
  /** 0→1 through the current slide; drives the progress bar under the hero. */
  progress = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    // The feed emits twice on a warm load: the cached menu, then the live one.
    this.catalog.getCatalog().subscribe({
      next: ({ categories, deals }) => {
        this.categories.set(this.buildTiles(categories, deals.length > 0));
        this.products.set(this.buildProducts(categories));
        this.loading.set(false);
        this.failed.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });

    // SSR has no timers to run and no carousel to animate.
    if (this.isBrowser) this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Building the page out of the feed ─────────────────────────────────────

  private buildTiles(categories: Category[], hasDeals: boolean): CategoryTile[] {
    const tiles = categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      image: this.catalog.imageFor({ image_url: c.image_url, category_slug: c.slug }),
    }));
    if (hasDeals) {
      tiles.push({
        name: 'Deals',
        slug: 'deals',
        image: this.catalog.imageFor({ image_url: null, category_slug: 'pizza-deals' }),
      });
    }
    return tiles;
  }

  /**
   * "Popular right now": items with a photo first (they are the ones worth a
   * card), then the menu's Signature items, then one from each category. The
   * spread comes before the Special flags, which are all pizzas today and
   * would otherwise fill the whole grid.
   */
  private buildProducts(categories: Category[]): ProductCard[] {
    const all = categories.flatMap((c) => c.items);
    const picked: MenuItem[] = [];
    const take = (it: MenuItem) => {
      if (picked.length < POPULAR_COUNT && !picked.some((p) => p.slug === it.slug)) picked.push(it);
    };

    all.filter((i) => i.image_url).forEach(take);
    all.filter((i) => i.is_signature).forEach(take);
    for (const c of categories) if (c.items[0]) take(c.items[0]);
    all.filter((i) => i.is_special).forEach(take);
    all.forEach(take);

    return picked.map((item) => ({
      item,
      name: item.name,
      description: item.description,
      price: item.price_from ?? 0,
      from: item.variants.length > 1,
      image: this.catalog.imageFor(item),
      badge: item.is_signature ? 'Signature' : item.is_special ? 'Special' : null,
    }));
  }

  // ── Adding to the cart ────────────────────────────────────────────────────

  /**
   * A single-price item goes straight in; a sized one has to be chosen on the
   * menu page, so the card takes you to its section rather than guessing a size.
   */
  add(card: ProductCard): void {
    const item = card.item;
    if (card.from) {
      this.router.navigate(['/menu'], { fragment: item.category_slug });
      return;
    }
    const variant = item.variants[0];
    if (!variant) return;
    this.cart.add({
      key: `item:${item.slug}:${variant.label ?? ''}`,
      kind: 'item',
      itemSlug: item.slug,
      size: variant.label,
      name: item.name,
      variantLabel: variant.label,
      image: card.image,
      unitPrice: variant.price,
    });
    this.toast.set(`${item.name} added`);
    if (this.isBrowser) setTimeout(() => this.toast.set(''), 1600);
  }

  // ── Hero carousel ─────────────────────────────────────────────────────────

  private tick(): void {
    // A backgrounded tab would otherwise come back having burned through every
    // slide, landing the visitor somewhere arbitrary.
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.slides.length < 2) return; // a single banner has nothing to advance to
    const next = this.progress() + this.tickMs / this.slideMs;
    if (next >= 1) this.go(1);
    else this.progress.set(next);
  }

  /** Step the carousel, wrapping at both ends. */
  go(step: number): void {
    const count = this.slides.length;
    if (!count) return;
    this.slideIndex.set((this.slideIndex() + step + count) % count);
    this.progress.set(0);
  }

  select(index: number): void {
    this.slideIndex.set(index);
    this.progress.set(0);
  }

  /** Anything missing falls back to the placeholder rather than a broken icon. */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(PLACEHOLDER)) img.src = PLACEHOLDER;
  }
}

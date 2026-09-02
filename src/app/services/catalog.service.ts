import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { Category, Deal, DealOption, MenuItem, SiteInfo, Variant } from '../models/catalog.model';

// ===== Admin public feed (menu.json shape) =====
interface FeedItem {
  id: string;
  name: string;
  description?: string | null;
  price?: number | string;
  prices?: Record<string, number | string | null>;
  special?: boolean;
  signature?: boolean;
  tag?: string;
  pizzaSelection?: { size: string; count: number; from: string[] };
  dealExtras?: string[];
  image?: string;
}
interface FeedCategory {
  id: string;
  name: string;
  type: 'single' | 'sized';
  sizes?: string[];
  image?: string;
  items: FeedItem[];
}
interface Feed {
  generated_at?: string;
  categories: FeedCategory[];
}

export interface ParsedMenu {
  categories: Category[];
  deals: Deal[];
}

const MENU_CACHE_KEY = 'genz_menu_cache_v2';

const isDeals = (slug: string) => slug.endsWith('deals');
const num = (v: unknown): number => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0;

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private api = inject(ApiService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Fallback imagery per category slug when an item has no photo of its own.
   * Every entry must be a plain product shot: art with a price or a deal number
   * printed on it (`images/menu/pizza.jpg`, `images/deals/deal-2..6.png`) would
   * contradict the live price beside it, so it is deliberately not used here.
   * The real fix for any of these is uploading the item's photo in genz-admin.
   */
  private readonly categoryImages: Record<string, string> = {
    pizza: 'images/menu/pizza.png',
    'pizza-deals': 'images/deals/deal-1.png',
    'pizza-burger-deals': 'images/deals/deal-1.png',
    burgers: 'images/menu/burgers.png',
    'burger-deals': 'images/menu/burgers.png',
    'beef-burger-deals': 'images/menu/burgers.png',
    'cold-drinks': 'images/menu/cold-drinks.png',
    starters: 'images/menu/starters.png',
  };
  private readonly fallbackImage = 'images/placeholder.svg';

  // One feed per app load, replayed to every subscriber: the cached copy is
  // pushed first (instant paint), then the live one from genz-admin replaces it.
  private feed$ = new ReplaySubject<ParsedMenu>(1);
  private started = false;
  private emitted = false;

  getSite(): Observable<SiteInfo> {
    return this.api.get<SiteInfo>('/site');
  }

  /** Categories from the genz-admin feed (cached in localStorage for instant loads). */
  getMenu(): Observable<Category[]> {
    return this.loadFeed().pipe(map((m) => m.categories));
  }

  /** Deals derived from the *-deals categories of the same feed. */
  getDeals(): Observable<Deal[]> {
    return this.loadFeed().pipe(map((m) => m.deals));
  }

  /** Categories and deals together, for pages that need both (home). */
  getCatalog(): Observable<ParsedMenu> {
    return this.loadFeed();
  }

  private loadFeed(): Observable<ParsedMenu> {
    if (!this.started) {
      this.started = true;
      const cached = this.readCache();
      if (cached) this.emit(cached); // paint instantly from the last known feed
      this.refresh();                // ...then correct it from genz-admin
    }
    return this.feed$;
  }

  private emit(menu: ParsedMenu): void {
    this.emitted = true;
    this.feed$.next(menu);
  }

  /**
   * Fetch the canonical feed. Subscribers that already painted a cached menu
   * get a second emission with the live names/prices, so an edit in genz-admin
   * shows up on this load rather than the next one.
   */
  private refresh(): void {
    fetch(environment.adminMenuUrl, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`Menu feed HTTP ${res.status}`);
        return res.json() as Promise<Feed>;
      })
      .then((feed) => {
        const parsed = this.parseFeed(feed);
        this.writeCache(parsed);
        this.emit(parsed);
        this.feed$.complete();
      })
      .catch((err) => {
        // A cached menu beats an empty page; only a cold start can fail.
        if (this.emitted) this.feed$.complete();
        else this.feed$.error(err);
      });
  }

  private parseFeed(feed: Feed): ParsedMenu {
    const cats = feed.categories ?? [];

    // slug -> name for every non-deal item, to label deal options.
    const nameBySlug: Record<string, string> = {};
    for (const c of cats) {
      if (isDeals(c.id)) continue;
      for (const it of c.items ?? []) nameBySlug[it.id] = it.name;
    }

    const categories: Category[] = [];
    const deals: Deal[] = [];

    for (const c of cats) {
      if (isDeals(c.id)) {
        for (const it of c.items ?? []) {
          const sel = it.pizzaSelection;
          deals.push({
            name: it.name,
            slug: it.id,
            group: c.name,
            category_slug: c.id,
            description: it.description ?? null,
            price: num(it.price),
            tag: it.tag ?? null,
            image_url: it.image ?? null,
            requires_selection: !!sel && (sel.from?.length ?? 0) > 0,
            selection_size: sel?.size ?? null,
            selection_count: sel?.count ?? 0,
            extras: it.dealExtras ?? [],
            options: (sel?.from ?? []).map(
              (slug): DealOption => ({ slug, name: nameBySlug[slug] ?? slug }),
            ),
          });
        }
        continue;
      }

      const items: MenuItem[] = (c.items ?? []).map((it) => {
        const variants: Variant[] = [];
        if (it.prices && typeof it.prices === 'object') {
          const order = c.sizes?.length ? c.sizes : Object.keys(it.prices);
          for (const label of order) {
            if (it.prices[label] == null) continue;
            variants.push({ label, price: num(it.prices[label]) });
          }
        } else {
          variants.push({ label: null, price: num(it.price) });
        }
        const prices = variants.map((v) => v.price);
        return {
          name: it.name,
          slug: it.id,
          description: it.description ?? null,
          image_url: it.image ?? null,
          is_special: !!it.special,
          is_signature: !!it.signature,
          is_available: true,
          category_slug: c.id,
          price_from: prices.length ? Math.min(...prices) : null,
          variants,
        };
      });

      categories.push({
        name: c.name,
        slug: c.id,
        type: c.type,
        sizes: c.sizes ?? null,
        image_url: c.image ?? null,
        items,
      });
    }

    return { categories, deals };
  }

  private readCache(): ParsedMenu | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(MENU_CACHE_KEY);
      return raw ? (JSON.parse(raw) as ParsedMenu) : null;
    } catch {
      return null;
    }
  }

  private writeCache(menu: ParsedMenu): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menu));
    } catch {
      /* ignore quota/private-mode errors */
    }
  }

  /** Resolve a display image for an item, falling back to category art. */
  imageFor(item: Pick<MenuItem, 'image_url' | 'category_slug'>, categorySlug?: string): string {
    if (item.image_url) return item.image_url;
    const slug = item.category_slug ?? categorySlug ?? '';
    return this.categoryImages[slug] ?? this.fallbackImage;
  }
}

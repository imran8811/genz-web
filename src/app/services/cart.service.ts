import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartLine } from '../models/catalog.model';

const STORAGE_KEY = 'genz_cart_v2';

/**
 * Local, browser-persisted cart that understands sized items and deals.
 * Backend sync is layered on in Phase 3 (checkout submits these lines).
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private linesSig = signal<CartLine[]>(this.load());

  lines = computed(() => this.linesSig());
  itemCount = computed(() => this.linesSig().reduce((n, l) => n + l.quantity, 0));
  subtotal = computed(() => this.linesSig().reduce((n, l) => n + l.unitPrice * l.quantity, 0));
  isEmpty = computed(() => this.linesSig().length === 0);

  /** Add a line; merges with an identical line (same key) by bumping quantity. */
  add(line: Omit<CartLine, 'quantity'>, quantity = 1): void {
    const lines = [...this.linesSig()];
    const existing = lines.find(l => l.key === line.key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      lines.push({ ...line, quantity });
    }
    this.commit(lines);
  }

  updateQuantity(key: string, quantity: number): void {
    if (quantity <= 0) return this.remove(key);
    const lines = this.linesSig().map(l => (l.key === key ? { ...l, quantity } : l));
    this.commit(lines);
  }

  increment(key: string): void {
    const l = this.linesSig().find(x => x.key === key);
    if (l) this.updateQuantity(key, l.quantity + 1);
  }

  decrement(key: string): void {
    const l = this.linesSig().find(x => x.key === key);
    if (l) this.updateQuantity(key, l.quantity - 1);
  }

  remove(key: string): void {
    this.commit(this.linesSig().filter(l => l.key !== key));
  }

  clear(): void {
    this.commit([]);
  }

  private commit(lines: CartLine[]): void {
    this.linesSig.set(lines);
    if (this.isBrowser) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* ignore */ }
    }
  }

  private load(): CartLine[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  }
}

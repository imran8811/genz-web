import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CartLine, DeliveryDetails, PlacedOrder } from '../models/catalog.model';

const LAST_ORDER_KEY = 'genz_last_order';

interface ApiOrderItem {
  name: string;
  variant_label: string | null;
  selections: string[] | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}
interface ApiOrder {
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: 'cod' | 'online';
  placed_at: string | null;
  shipping: {
    name: string; phone: string; address_line_1: string;
    area: string | null; city: string; landmark: string | null;
  };
  items: ApiOrderItem[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  /** Place a real order against the backend (requires auth token). */
  place(input: {
    delivery: DeliveryDetails;
    paymentMethod: 'cod' | 'online';
    lines: CartLine[];
  }): Observable<PlacedOrder> {
    const items = input.lines
      .filter(l => l.kind === 'item')
      .map(l => ({ item_slug: l.itemSlug, size: l.size ?? null, quantity: l.quantity }));
    const deals = input.lines
      .filter(l => l.kind === 'deal')
      .map(l => ({ deal_slug: l.dealSlug, quantity: l.quantity, selections: l.selections ?? [] }));

    const payload = {
      items,
      deals,
      delivery: input.delivery,
      payment_method: input.paymentMethod,
    };

    return this.api.post<{ order: ApiOrder }>('/checkout', payload, true).pipe(
      map(res => this.toPlacedOrder(res.order, input.delivery)),
    );
  }

  getLastOrder(): PlacedOrder | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      return raw ? (JSON.parse(raw) as PlacedOrder) : null;
    } catch {
      return null;
    }
  }

  /** Fetch one of the current user's orders by number (for the /order/:number page). */
  track(orderNumber: string): Observable<PlacedOrder> {
    return this.api.get<ApiOrder>(`/orders/track/${orderNumber}`, true).pipe(
      map((order) => {
        const s = order.shipping;
        const delivery: DeliveryDetails = {
          recipient_name: s?.name ?? '',
          phone: s?.phone ?? '',
          address_line_1: s?.address_line_1 ?? '',
          area: s?.area ?? '',
          city: s?.city ?? '',
          landmark: s?.landmark ?? '',
          notes: '',
        };
        return this.toPlacedOrder(order, delivery, false);
      }),
    );
  }

  private toPlacedOrder(order: ApiOrder, delivery: DeliveryDetails, persist = true): PlacedOrder {
    const lines: CartLine[] = order.items.map((it, i) => ({
      key: `o-${i}`,
      kind: it.selections && it.selections.length ? 'deal' : 'item',
      name: it.name,
      variantLabel: it.variant_label,
      image: null,
      unitPrice: it.unit_price,
      quantity: it.quantity,
      selections: it.selections ?? undefined,
    }));

    const placed: PlacedOrder = {
      orderNumber: order.order_number,
      lines,
      delivery,
      paymentMethod: order.payment_method,
      subtotal: order.subtotal,
      deliveryFee: order.delivery_fee,
      total: order.total_amount,
      placedAt: order.placed_at ?? new Date().toISOString(),
    };

    if (persist && this.isBrowser) {
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(placed)); } catch { /* ignore */ }
    }
    return placed;
  }
}

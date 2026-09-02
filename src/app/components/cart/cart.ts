import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CatalogService } from '../../services/catalog.service';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  private cart = inject(CartService);
  private catalog = inject(CatalogService);

  lines = this.cart.lines;
  subtotal = this.cart.subtotal;
  itemCount = this.cart.itemCount;
  isEmpty = this.cart.isEmpty;

  deliveryFee = signal(0);
  total = computed(() => this.subtotal() + this.deliveryFee());

  constructor() {
    this.catalog.getSite().subscribe({
      next: s => this.deliveryFee.set(s.delivery_fee ?? 0),
      error: () => {},
    });
  }

  inc(key: string): void { this.cart.increment(key); }
  dec(key: string): void { this.cart.decrement(key); }
  remove(key: string): void { this.cart.remove(key); }
  clear(): void { this.cart.clear(); }
}

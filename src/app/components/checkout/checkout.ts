import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { CatalogService } from '../../services/catalog.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { DeliveryDetails } from '../../models/catalog.model';

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private cart = inject(CartService);
  private catalog = inject(CatalogService);
  private orders = inject(OrderService);
  private auth = inject(AuthService);
  private apiSvc = inject(ApiService);
  private router = inject(Router);

  isAuthenticated = this.auth.isAuthenticated;

  lines = this.cart.lines;
  subtotal = this.cart.subtotal;
  itemCount = this.cart.itemCount;
  isEmpty = this.cart.isEmpty;

  deliveryFee = signal(0);
  total = computed(() => this.subtotal() + this.deliveryFee());

  // form model
  recipient_name = '';
  phone = '';
  address_line_1 = '';
  area = '';
  city = 'Multan';
  landmark = '';
  notes = '';
  paymentMethod: 'cod' | 'online' = 'cod';

  error = signal('');
  loading = signal(false);

  constructor() {
    this.catalog.getSite().subscribe({
      next: s => this.deliveryFee.set(s.delivery_fee ?? 0),
      error: () => {},
    });

    // Pre-fill name/phone from the logged-in account (without overwriting typed input).
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      if (!this.recipient_name) this.recipient_name = user.name ?? '';
      if (!this.phone && user.phone) this.phone = user.phone;
    });
  }

  submit(): void {
    this.error.set('');

    if (this.isEmpty()) {
      this.error.set('Your cart is empty.');
      return;
    }
    if (!this.recipient_name || !this.phone || !this.address_line_1 || !this.city) {
      this.error.set('Please fill in name, phone, address and city.');
      return;
    }
    if (!/^[\d\s\-+()]{10,15}$/.test(this.phone)) {
      this.error.set('Please enter a valid phone number.');
      return;
    }

    if (!this.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirect: '/checkout' } });
      return;
    }

    this.loading.set(true);

    const delivery: DeliveryDetails = {
      recipient_name: this.recipient_name,
      phone: this.phone,
      address_line_1: this.address_line_1,
      area: this.area,
      city: this.city,
      landmark: this.landmark,
      notes: this.notes,
    };

    this.orders
      .place({ delivery, paymentMethod: this.paymentMethod, lines: this.lines() })
      .subscribe({
        next: () => {
          this.cart.clear();
          this.loading.set(false);
          this.router.navigate(['/order-confirmation']);
        },
        error: err => {
          this.loading.set(false);
          this.error.set(this.apiSvc.getErrorMessage(err, 'Could not place your order. Please try again.'));
        },
      });
  }
}

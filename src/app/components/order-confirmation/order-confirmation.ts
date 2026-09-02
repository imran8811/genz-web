import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { PlacedOrder } from '../../models/catalog.model';

@Component({
  selector: 'app-order-confirmation',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './order-confirmation.html',
  styleUrl: './order-confirmation.scss',
})
export class OrderConfirmation implements OnInit {
  private orders = inject(OrderService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  order = signal<PlacedOrder | null>(null);
  loading = signal(false);
  notFound = signal(false);

  ngOnInit(): void {
    const number = this.route.snapshot.paramMap.get('number');

    // No number → the post-checkout confirmation (uses the last placed order).
    if (!number) {
      this.order.set(this.orders.getLastOrder());
      return;
    }

    // Deep-linked order view (e.g. from the confirmation email) → requires login.
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirect: `/order/${number}` } });
      return;
    }

    this.loading.set(true);
    this.orders.track(number).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  get paymentLabel(): string {
    return this.order()?.paymentMethod === 'online' ? 'Online Payment' : 'Cash on Delivery';
  }
}

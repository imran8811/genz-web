import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  name = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  errorMessage = signal('');
  loading = signal(false);

  private redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/';

  onSubmit() {
    this.errorMessage.set('');

    if (!this.name || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage.set('Please fill in all required fields.');
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.authService.signup(this.name, this.email, this.password, this.phone).subscribe(result => {
      if (result.success) {
        this.router.navigateByUrl(this.redirect);
      } else {
        this.errorMessage.set(result.message);
      }
      this.loading.set(false);
    });
  }
}

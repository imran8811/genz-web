import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) { }

  onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.email || !this.token || !this.newPassword || !this.confirmPassword) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.authService
      .resetPassword(this.token, this.email, this.newPassword, this.confirmPassword)
      .subscribe(result => {
        if (result.success) {
          this.successMessage.set(result.message);
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else {
          this.errorMessage.set(result.message);
        }
        this.loading.set(false);
      });
  }
}

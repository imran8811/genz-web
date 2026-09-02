import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  email = '';
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);

  constructor(private authService: AuthService) { }

  onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.email) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    this.loading.set(true);
    this.authService.requestPasswordReset(this.email).subscribe(result => {
      if (result.success) {
        this.successMessage.set(result.message);
      } else {
        this.errorMessage.set(result.message);
      }
      this.loading.set(false);
    });
  }
}

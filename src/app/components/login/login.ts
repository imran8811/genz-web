import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  errorMessage = signal('');
  loading = signal(false);

  private redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/';

  onSubmit() {
    this.errorMessage.set('');

    if (!this.email || !this.password) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    this.loading.set(true);
    this.authService.login(this.email, this.password).subscribe(result => {
      if (result.success) {
        this.router.navigateByUrl(this.redirect);
      } else {
        this.errorMessage.set(result.message);
      }
      this.loading.set(false);
    });
  }
}

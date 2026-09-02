import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Menu } from './components/menu/menu';
import { Signup } from './components/signup/signup';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';
import { Cart } from './components/cart/cart';
import { Checkout } from './components/checkout/checkout';
import { OrderConfirmation } from './components/order-confirmation/order-confirmation';
import { guestGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: "",
        component: Home
    },
    {
        path: "menu",
        component: Menu
    },
    {
        path: "cart",
        component: Cart
    },
    {
        path: "checkout",
        component: Checkout
    },
    {
        path: "order-confirmation",
        component: OrderConfirmation
    },
    {
        path: "order/:number",
        component: OrderConfirmation
    },
    {
        path: "login",
        component: Login,
        canActivate: [guestGuard]
    },
    {
        path: "signup",
        component: Signup,
        canActivate: [guestGuard]
    },
    {
        path: "forgot-password",
        component: ForgotPassword,
        canActivate: [guestGuard]
    },
    {
        path: "reset-password",
        component: ResetPassword,
        canActivate: [guestGuard]
    }
];

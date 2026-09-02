# genz-web — GEN Z Foods Public Website

The customer-facing ordering website (genzfoods.pk). Talks to
[`genz-web-apis`](../genz-web-apis) for all data.

- **Stack:** Angular 21 (standalone components, signals) + **SSR** (Angular SSR + Express 5), TypeScript 5.9, SCSS.
- **Runs on:** `http://localhost:4200` (`npm start`). API base from `src/environments/environment.ts` → `http://localhost:8000/api/v1` (prod swap via `environment.prod.ts`).
- **Brand:** name is **"GEN Z Foods"** (GEN all caps). Design = "Bold & Youthful": near-black bg, logo **red `--red:#ff1f2d`** + **lemon-yellow `--yellow:#ffe000`** accents, `Anton` display font + `Outfit` body. Single yellow token site-wide (tuned to the logo). Tokens + shared components in `src/styles.scss`.

## Run / build
```bash
npm install
npm start                    # ng serve → localhost:4200
npx ng build --configuration development   # fast build to typecheck (no budgets)
```
Component SCSS budget: 12kB max each — keep shared styles in global `styles.scss`.

## Structure that matters
- `services/`: `api.service` (env base URL + Bearer token `genz_api_token`), `catalog.service` (**the genz-admin menu feed** + `/site`), `cart.service` (**local, signal + localStorage** cart; supports sized items & deals), `order.service` (POSTs /checkout), `auth.service` (token auth, stores user under `genz_current_user`).
- `models/catalog.model.ts` — Category/MenuItem/Variant/Deal/CartLine/PlacedOrder.
- `components/`: home, menu, cart, checkout, order-confirmation, header, footer, login/signup/forgot/reset (auth). **No admin** (removed — the menu is managed in [`genz-admin`](../genz-admin)).
- **Menu page** = continuous scroll-spy (all categories stacked, sticky tabs highlight current section via IntersectionObserver), size selectors, deal-builder modal, sticky cart bar.
- **Home page** is built from the same feed — hero offers from real deals, the category strip from
  real categories, "Popular right now" from real items (photo → Signature → one per category, so the
  grid isn't eight pizzas). Nothing on it is hardcoded; it was static placeholder copy until Sept 2026.

## Flows
- Browse → add (size/deal) → local cart → checkout. Checkout **requires login** (redirects to `/login?redirect=/checkout`, param preserved across login↔signup). Logged-in checkout pre-fills name/phone from the account.
- Checkout posts to `/checkout`; backend re-prices and creates the order; confirmation shows the real order number.

## The menu comes from Gen Z Admin — directly

`catalog.service` fetches `environment.adminMenuUrl`
(`https://api.admin.genzfoods.pk/api/public/menu`) itself. **`genz-web-apis` is not in the menu
path at all** — it only re-prices at checkout (`item_slug` / `deal_slug`) and serves `/site` and
auth. Categories, items, sizes, prices, deals and images all come from the one feed; nothing about
the menu is hardcoded in this app.

- The feed is parsed once per app load into `{categories, deals}` and replayed to every subscriber.
  A cached copy (`genz_menu_cache_v2` in localStorage) is emitted first so the page paints instantly,
  then the live feed is emitted **again** over it — an edit in genz-admin lands on *this* load, not
  the next one. Any subscriber must therefore handle more than one emission.
- Deal categories are the ones whose slug ends in `deals`; they become `Deal`s, everything else a
  `Category`. Each carries its feed `category_slug`.
- **CORS is allowlisted per origin** in `genz-admin-apis/config/cors.php` — `localhost:4200` is on
  the list, so serving genz-web on any other port makes the whole menu fail to load.

### Images
Item/deal photos are uploaded in [`genz-admin`](../genz-admin) and arrive on the feed as absolute
`image` URLs, cache-busted with `?v=`. Cards fall back to the emoji placeholder (menu page) or
`CatalogService.imageFor` category art (home), and an image that fails to load falls back too
rather than showing a broken icon.
- `imageFor`'s fallbacks must be **plain product shots**. `images/menu/pizza.jpg` and
  `images/deals/deal-2..6.png` are marketing flyers with a price or a deal number printed on them —
  they are deliberately unused, because "Rs 1350" baked into the art beside a live "Rs 500" is the
  same bug as a hardcoded price. `images/menu/pizza.png` is the pizza cropped out of that flyer.
- ⚠ The feed currently publishes image URLs on `https://admin.genzfoods.pk` (the admin SPA host),
  which answers **200 with index.html** instead of the image, so every uploaded photo silently fails
  to render. The images are served correctly from `https://api.admin.genzfoods.pk` — fix is
  `ADMIN_PUBLIC_URL` in the deployed `genz-admin-apis` `.env` (see its `config/genz.php`).

## Build status
- ✅ Built: public site, home + menu both **driven by the genz-admin feed** (scroll-spy, sizes,
  deals, item/deal images), cart/checkout/orders, auth.
- ⏳ Pending: online-payment UI once the backend gateway stub lands (checkout already has COD/online radio).
- Possible add: "My Orders" page (backend `/orders` exists).

## Conventions
- Signals + standalone components. SSR-aware: guard `window`/`localStorage` (cart/auth/order services already do).
- Add pipes (`DecimalPipe` etc.) to each component's `imports`. Prettier: 100 col, single quotes.

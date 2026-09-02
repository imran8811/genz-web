// ===== Catalog (menu / deals / site) =====

export interface SiteInfo {
  restaurant: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    whatsapp: string;
    timing: string;
    features: string[];
  };
  currency: { code: string; symbol: string };
  delivery_fee: number;
}

export interface Variant {
  label: string | null; // size label; null = single-price item
  price: number;
}

export interface MenuItem {
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_special: boolean;
  is_signature: boolean;
  is_available: boolean;
  category_slug?: string;
  price_from: number | null;
  variants: Variant[];
}

export interface Category {
  name: string;
  slug: string;
  type: 'single' | 'sized';
  sizes: string[] | null;
  image_url: string | null;
  items: MenuItem[];
}

export interface DealOption {
  name: string;
  slug: string;
}

export interface Deal {
  name: string;
  slug: string;
  group: string | null;
  /** Feed category the deal came from (`pizza-deals`, …) — picks fallback art. */
  category_slug: string;
  description: string | null;
  price: number;
  tag: string | null;
  image_url: string | null;
  requires_selection: boolean;
  selection_size: string | null;
  selection_count: number;
  extras: string[];
  options: DealOption[];
}

// ===== Cart =====

export interface CartLine {
  key: string;                 // unique signature for merging
  kind: 'item' | 'deal';
  itemSlug?: string;           // when kind === 'item'
  size?: string | null;        // when kind === 'item' (variant/size label)
  dealSlug?: string;           // when kind === 'deal'
  name: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  selections?: string[];       // chosen pizza names for deals
}

// ===== Checkout / Orders =====

export interface DeliveryDetails {
  recipient_name: string;
  phone: string;
  address_line_1: string;
  area: string;
  city: string;
  landmark: string;
  notes: string;
}

export interface PlacedOrder {
  orderNumber: string;
  lines: CartLine[];
  delivery: DeliveryDetails;
  paymentMethod: 'cod' | 'online';
  subtotal: number;
  deliveryFee: number;
  total: number;
  placedAt: string;
}

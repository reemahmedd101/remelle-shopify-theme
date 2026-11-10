# Remelle Cart Sync

Persists logged-in customer carts to the `custom.remelle_saved_cart` customer metafield so desktop and mobile stay aligned.

## Why this exists

Shopify’s Online Store Ajax cart is **cookie / browser session based**. Logging into the same customer account on another device does **not** load that device’s cart. Remelle’s previous `localStorage` snapshot only worked on the same browser.

Shop account holders can get Shopify’s native Shop cart sync; everyone else needs account-scoped persistence like this proxy.

## Setup

1. Metafield `custom.remelle_saved_cart` (type JSON, owner Customer) — already created on the Remelle store.
2. Create a Custom / Dev app with scopes `read_customers`, `write_customers`.
3. Configure **App proxy**:
   - Proxy URL: your deployed host
   - Subpath prefix: `apps`
   - Subpath: `remelle-cart`
4. Deploy this service and set:
   - `SHOPIFY_API_SECRET` = app client secret
   - `SHOPIFY_ADMIN_API_TOKEN` = Admin API access token
   - `SHOPIFY_SHOP_DOMAIN` = `your-store.myshopify.com` (optional fallback)
5. Install the app on the shop.
6. Theme calls `/apps/remelle-cart/cart` automatically when a customer is signed in.

## Behaviour

- **Save** (debounced) after add / qty / remove while signed in
- **Load + merge** after login and on tab focus
- Guest carts keep working with no cloud calls
- Stale writes from older devices are ignored (`updatedAt` last-write-wins)

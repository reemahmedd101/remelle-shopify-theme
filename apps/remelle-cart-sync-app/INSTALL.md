# Remelle Cart Sync — install

Partner app **Remelle Cart Sync** (`client_id` `e32cff9ad00d401c0d0851a8fd0220e4`) is created under org Remelle and deployed with App Proxy:

- Storefront path: `/apps/remelle-cart/cart`
- Scopes: `read_customers`, `write_customers`, `write_app_proxy`
- Metafield: `custom.remelle_saved_cart` (JSON)

## Install on remelle.shop

1. Keep the app host running (tunnel or permanent host) with `SHOPIFY_APP_URL` matching `shopify.app.toml`.
2. Open install:
   `https://admin.shopify.com/store/0ck1c2-wi/oauth/install_custom_app?client_id=e32cff9ad00d401c0d0851a8fd0220e4`
3. Approve scopes.
4. Confirm `https://www.remelle.shop/apps/remelle-cart/cart` returns JSON (401 when logged out is fine; signed-in customers get `{ cart, customerId }`).

## Dev host

```bash
cd apps/remelle-cart-sync-app/remelle-cart-sync
npm run vite -- --port 3459 --host 127.0.0.1
# separate terminal:
cloudflared tunnel --url http://127.0.0.1:3459
# then update application_url + redirect_urls in shopify.app.toml and:
shopify app deploy --client-id e32cff9ad00d401c0d0851a8fd0220e4 --no-input --allow-updates
```

Theme already calls `/apps/remelle-cart/cart` when a customer is signed in.

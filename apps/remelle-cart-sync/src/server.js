/**
 * Remelle cart sync App Proxy.
 *
 * Expects Shopify App Proxy:
 *   Subpath prefix: apps
 *   Subpath:        remelle-cart
 *   Proxy URL:      https://YOUR_HOST
 *
 * Theme calls:
 *   GET  /apps/remelle-cart/cart
 *   POST /apps/remelle-cart/cart
 *
 * Env:
 *   SHOPIFY_API_SECRET          – app client secret (proxy signature)
 *   SHOPIFY_ADMIN_API_TOKEN     – Admin API access token (read/write customers)
 *   SHOPIFY_SHOP_DOMAIN         – optional fallback shop domain
 *   PORT                        – default 8080
 */
import express from 'express';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 8080);
const API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const META_NAMESPACE = 'custom';
const META_KEY = 'remelle_saved_cart';

app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const verifyAppProxy = (query) => {
  if (!API_SECRET) return { ok: false, error: 'missing_api_secret' };
  const params = { ...query };
  const signature = params.signature;
  delete params.signature;
  if (!signature) return { ok: false, error: 'missing_signature' };

  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${Array.isArray(params[key]) ? params[key].join(',') : params[key]}`)
    .join('');

  const digest = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');
  if (!timingSafeEqual(digest, signature)) {
    return { ok: false, error: 'invalid_signature' };
  }

  const customerId = params.logged_in_customer_id;
  if (!customerId) return { ok: false, error: 'not_signed_in' };

  const shop = String(params.shop || process.env.SHOPIFY_SHOP_DOMAIN || '').replace(/^https?:\/\//, '');
  if (!shop) return { ok: false, error: 'missing_shop' };

  return { ok: true, customerId: String(customerId), shop };
};

const adminGraphql = async (shop, query, variables = {}) => {
  const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const message =
      (payload.errors && payload.errors[0] && payload.errors[0].message) ||
      `admin_graphql_${response.status}`;
    throw new Error(message);
  }
  return payload.data;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  items.forEach((item) => {
    const id = Number(item && (item.id || item.variant_id));
    const quantity = Math.max(0, Math.min(99, Number(item && item.quantity) || 0));
    if (!id || quantity <= 0) return;
    map.set(id, (map.get(id) || 0) + quantity);
  });
  return [...map.entries()].map(([id, quantity]) => ({ id, quantity }));
};

const parseCartValue = (raw) => {
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || !Array.isArray(data.items)) return null;
    return {
      items: normalizeItems(data.items),
      updatedAt: Number(data.updatedAt) || 0,
      revision: Number(data.revision) || 0,
    };
  } catch (error) {
    return null;
  }
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'remelle-cart-sync' });
});

app.get(['/cart', '/apps/remelle-cart/cart'], async (req, res) => {
  try {
    if (!ADMIN_TOKEN) return res.status(503).json({ error: 'admin_token_missing' });
    const auth = verifyAppProxy(req.query);
    if (!auth.ok) return res.status(401).json({ error: auth.error });

    const data = await adminGraphql(
      auth.shop,
      `query CustomerCart($id: ID!) {
        customer(id: $id) {
          id
          metafield(namespace: "${META_NAMESPACE}", key: "${META_KEY}") {
            value
          }
        }
      }`,
      { id: `gid://shopify/Customer/${auth.customerId}` }
    );

    const saved = parseCartValue(data?.customer?.metafield?.value);
    res.json({ cart: saved, customerId: auth.customerId });
  } catch (error) {
    res.status(500).json({ error: error.message || 'load_failed' });
  }
});

app.post(['/cart', '/apps/remelle-cart/cart'], async (req, res) => {
  try {
    if (!ADMIN_TOKEN) return res.status(503).json({ error: 'admin_token_missing' });
    const auth = verifyAppProxy(req.query);
    if (!auth.ok) return res.status(401).json({ error: auth.error });

    const incoming = parseCartValue(req.body);
    if (!incoming) return res.status(400).json({ error: 'invalid_cart' });

    const existingData = await adminGraphql(
      auth.shop,
      `query CustomerCart($id: ID!) {
        customer(id: $id) {
          metafield(namespace: "${META_NAMESPACE}", key: "${META_KEY}") {
            value
            compareDigest
          }
        }
      }`,
      { id: `gid://shopify/Customer/${auth.customerId}` }
    );

    const existing = parseCartValue(existingData?.customer?.metafield?.value);
    // Last-write-wins by updatedAt; ignore stale device writes.
    if (existing && existing.updatedAt > incoming.updatedAt) {
      return res.json({ cart: existing, skipped: true, reason: 'stale_write' });
    }

    const next = {
      items: incoming.items,
      updatedAt: incoming.updatedAt || Date.now(),
      revision: (existing?.revision || 0) + 1,
    };

    const result = await adminGraphql(
      auth.shop,
      `mutation SetCart($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { key value }
          userErrors { field message code }
        }
      }`,
      {
        metafields: [
          {
            ownerId: `gid://shopify/Customer/${auth.customerId}`,
            namespace: META_NAMESPACE,
            key: META_KEY,
            type: 'json',
            value: JSON.stringify(next),
          },
        ],
      }
    );

    const errors = result?.metafieldsSet?.userErrors || [];
    if (errors.length) {
      return res.status(422).json({ error: errors[0].message || 'metafield_error' });
    }

    res.json({ cart: next, saved: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'save_failed' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`remelle-cart-sync listening on :${PORT}`);
});

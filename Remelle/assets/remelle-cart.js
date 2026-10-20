/**
 * Remelle cart helpers: AJAX add-to-cart and live cart count updates.
 * Uses Shopify Cart AJAX API only — no mocked product or price data.
 */
(() => {
  const CART_ADD = '/cart/add.js';
  const CART_GET = '/cart.js';

  const updateCartCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = String(count);
    });
    document.querySelectorAll('[data-cart-link]').forEach((link) => {
      const label = link.getAttribute('data-cart-label');
      const text = link.querySelector('[data-cart-text]');
      if (label && text) {
        text.innerHTML = `${label} (<span data-cart-count>${count}</span>)`;
      }
    });
  };

  const refreshCartCount = async () => {
    const response = await fetch(CART_GET, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('cart_fetch_failed');
    const cart = await response.json();
    updateCartCount(cart.item_count || 0);
    return cart;
  };

  const parseJsonSafe = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const setButtonState = (button, { busy, label }) => {
    if (!button) return;
    if (busy != null) {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (label != null) button.textContent = label;
  };

  const addFromForm = async (form, button) => {
    const formData = new FormData(form);
    const id = formData.get('id');
    if (!id) {
      throw new Error('missing_variant');
    }

    const response = await fetch(CART_ADD, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      const message =
        (payload && (payload.description || payload.message)) ||
        'Unable to add this item to your cart.';
      throw new Error(message);
    }

    await refreshCartCount();
    return payload;
  };

  const bindProductForms = () => {
    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (form.dataset.remelleCartBound === 'true') return;
      form.dataset.remelleCartBound = 'true';

      form.addEventListener('submit', async (event) => {
        // Native submit remains the fallback if fetch is unavailable.
        if (!window.fetch) return;
        event.preventDefault();

        const section = form.closest('.remelle-pdp, .remelle-card');
        const button =
          form.querySelector('[type="submit"][name="add"], [type="submit"].remelle-card__add, [data-add]') ||
          form.querySelector('[type="submit"]');
        const errorNode = section && section.querySelector('[data-cart-error]');
        const statusNode = section && section.querySelector('[data-cart-status]');
        const originalLabel = button
          ? button.dataset.label || button.getAttribute('aria-label') || button.textContent
          : '';

        if (errorNode) {
          errorNode.hidden = true;
          errorNode.textContent = '';
        }
        if (statusNode) {
          statusNode.hidden = true;
          statusNode.textContent = '';
        }

        try {
          setButtonState(button, {
            busy: true,
            label: button && button.dataset.addingLabel ? button.dataset.addingLabel : originalLabel,
          });
          await addFromForm(form, button);
          if (statusNode) {
            statusNode.hidden = false;
            statusNode.textContent =
              (button && button.dataset.addedLabel) || 'Added to cart';
          }
          if (button && button.classList.contains('remelle-pdp__add')) {
            setButtonState(button, {
              busy: false,
              label: button.dataset.addedLabel || 'Added to cart',
            });
            window.setTimeout(() => {
              if (!button.disabled) {
                setButtonState(button, { label: button.dataset.label || originalLabel });
              }
            }, 1600);
          } else {
            setButtonState(button, { busy: false, label: originalLabel });
          }
        } catch (error) {
          setButtonState(button, { busy: false, label: button && button.dataset.label ? button.dataset.label : originalLabel });
          const message = error && error.message ? error.message : 'Unable to add this item to your cart.';
          if (errorNode) {
            errorNode.hidden = false;
            errorNode.textContent = message;
          } else {
            window.alert(message);
          }
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindProductForms);
  } else {
    bindProductForms();
  }
  document.addEventListener('shopify:section:load', bindProductForms);

  window.RemelleCart = {
    refreshCartCount,
    updateCartCount,
    addFromForm,
  };
})();

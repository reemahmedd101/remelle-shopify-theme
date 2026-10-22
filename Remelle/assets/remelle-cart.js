/**
 * Remelle cart helpers: AJAX add-to-cart, live nav count, toasts, cart qty.
 * Uses Shopify Cart AJAX API only — no mocked product or price data.
 */
(() => {
  const CART_ADD = '/cart/add.js';
  const CART_GET = '/cart.js';

  const strings = (() => {
    const node = document.getElementById('RemelleCartStrings');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return {};
    }
  })();

  const ensurePopupHost = () => {
    let host = document.getElementById('RemellePopupHost');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'RemellePopupHost';
    host.className = 'remelle-popup-host';
    document.body.appendChild(host);
    return host;
  };

  const closePopup = (overlay) => {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    document.documentElement.classList.remove('popup-open');
    window.setTimeout(() => overlay.remove(), 220);
  };

  const showPopup = (message, options = {}) => {
    if (!message) return Promise.resolve();

    return new Promise((resolve) => {
      const host = ensurePopupHost();
      host.replaceChildren();

      const overlay = document.createElement('div');
      overlay.className = `remelle-popup remelle-popup--${options.type || 'success'}`;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-live', options.type === 'error' ? 'assertive' : 'polite');

      const panel = document.createElement('div');
      panel.className = 'remelle-popup__panel';

      const title = document.createElement('p');
      title.className = 'remelle-popup__eyebrow';
      title.textContent =
        options.title ||
        (options.type === 'error'
          ? strings.errorTitle || 'Something went wrong'
          : options.confirm
            ? strings.confirmTitle || 'Please confirm'
            : strings.successTitle || 'Success');

      const text = document.createElement('p');
      text.className = 'remelle-popup__message';
      text.textContent = message;

      const actions = document.createElement('div');
      actions.className = 'remelle-popup__actions';

      const finish = (value) => {
        closePopup(overlay);
        resolve(value);
      };

      if (options.confirm) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'remelle-popup__btn remelle-popup__btn--ghost';
        cancel.textContent = options.cancelLabel || strings.cancel || 'Cancel';
        cancel.addEventListener('click', () => finish(false));

        const ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'remelle-popup__btn';
        ok.textContent = options.confirmLabel || strings.confirm || 'Remove';
        ok.addEventListener('click', () => finish(true));

        actions.append(cancel, ok);
      } else {
        if (options.actionHref && options.actionLabel) {
          const action = document.createElement('a');
          action.className = 'remelle-popup__btn remelle-popup__btn--ghost';
          action.href = options.actionHref;
          action.textContent = options.actionLabel;
          actions.appendChild(action);
        }

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'remelle-popup__btn';
        close.textContent = options.closeLabel || strings.continueShopping || strings.close || 'Continue';
        close.addEventListener('click', () => finish(true));
        actions.appendChild(close);
      }

      panel.append(title, text, actions);
      overlay.appendChild(panel);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay && !options.confirm) finish(true);
      });

      const onKey = (event) => {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', onKey);
          finish(options.confirm ? false : true);
        }
      };
      document.addEventListener('keydown', onKey);

      host.appendChild(overlay);
      document.documentElement.classList.add('popup-open');
      requestAnimationFrame(() => overlay.classList.add('is-visible'));

      const timeout = options.duration == null ? (options.confirm ? 0 : 3800) : options.duration;
      if (timeout > 0 && !options.confirm) {
        window.setTimeout(() => finish(true), timeout);
      }
    });
  };

  const showToast = showPopup;

  const pulseCartLinks = () => {
    document.querySelectorAll('[data-cart-link]').forEach((link) => {
      link.classList.remove('is-cart-updated');
      // Force reflow so the animation can replay.
      void link.offsetWidth;
      link.classList.add('is-cart-updated');
    });
  };

  const updateCartCount = (count) => {
    const safeCount = Number(count) || 0;
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = String(safeCount);
    });
    document.querySelectorAll('[data-cart-link]').forEach((link) => {
      const label = link.getAttribute('data-cart-label') || strings.cartLabel || 'Cart';
      let text = link.querySelector('[data-cart-text]');
      if (!text) {
        text = document.createElement('span');
        text.setAttribute('data-cart-text', '');
        link.appendChild(text);
      }
      text.innerHTML = `${label} (<span data-cart-count>${safeCount}</span>)`;
    });
    pulseCartLinks();
  };

  const refreshCartCount = async () => {
    const response = await fetch(CART_GET, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
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

  const setButtonBusy = (button, busy) => {
    if (!button) return;
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  const setTextButtonLabel = (button, label) => {
    if (!button || !label) return;
    // Icon-only buttons (product cards) must keep their SVG contents.
    if (button.classList.contains('remelle-card__add')) return;
    button.textContent = label;
  };

  const addFromForm = async (form) => {
    const formData = new FormData(form);
    const id = formData.get('id');
    if (!id) {
      throw new Error(strings.missingVariant || 'Select a product option first.');
    }

    const response = await fetch(CART_ADD, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: formData,
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      const message =
        (payload && (payload.description || payload.message)) ||
        strings.addError ||
        'Unable to add this item to your cart.';
      throw new Error(message);
    }

    const cart = await refreshCartCount();
    return { item: payload, cart };
  };

  const bindProductForms = () => {
    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (form.dataset.remelleCartBound === 'true') return;
      form.dataset.remelleCartBound = 'true';

      form.addEventListener('submit', async (event) => {
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
          setButtonBusy(button, true);
          if (button && button.dataset.addingLabel) {
            setTextButtonLabel(button, button.dataset.addingLabel);
          }

          const result = await addFromForm(form);
          const title =
            (result.item && (result.item.product_title || result.item.title)) || '';
          const successMessage = title
            ? (strings.addedNamed || '“{{ title }}” was added to your cart.').replace(
                '{{ title }}',
                title
              )
            : strings.addedSuccess || strings.added || 'Added successfully';

          showToast(successMessage, {
            type: 'success',
            actionHref: strings.cartUrl || '/cart',
            actionLabel: strings.viewCart || 'View cart',
          });

          if (statusNode) {
            statusNode.hidden = false;
            statusNode.textContent = strings.added || 'Added to cart';
          }

          if (button && button.classList.contains('remelle-pdp__add')) {
            setTextButtonLabel(button, button.dataset.addedLabel || strings.added || 'Added to cart');
            window.setTimeout(() => {
              if (!button.disabled) {
                setTextButtonLabel(button, button.dataset.label || originalLabel);
              }
            }, 1600);
          }
        } catch (error) {
          const message =
            (error && error.message) || strings.addError || 'Unable to add this item to your cart.';
          showToast(message, { type: 'error', duration: 5000 });
          if (errorNode) {
            errorNode.hidden = false;
            errorNode.textContent = message;
          }
          if (button && button.classList.contains('remelle-pdp__add')) {
            setTextButtonLabel(button, button.dataset.label || originalLabel);
          }
        } finally {
          setButtonBusy(button, false);
        }
      });
    });
  };

  const confirmRemove = async (section) => {
    const message =
      (section && section.getAttribute('data-remove-confirm')) ||
      strings.removeConfirm ||
      'Remove this item from your cart?';
    return showPopup(message, {
      type: 'confirm',
      confirm: true,
      title: strings.confirmTitle || 'Please confirm',
      confirmLabel: strings.remove || 'Remove',
      cancelLabel: strings.cancel || 'Cancel',
      duration: 0,
    });
  };

  const changeLineQuantity = async (input, quantity, options = {}) => {
    const key = input.getAttribute('data-line-key');
    if (!key) return false;

    const previous = options.previous != null ? options.previous : Number(input.value || 1);
    const section = input.closest('.remelle-cart');
    let removed = false;

    if (quantity <= 0) {
      const confirmed = await confirmRemove(section);
      if (!confirmed) {
        input.value = String(Math.max(1, previous));
        return false;
      }
      quantity = 0;
      removed = true;
    }

    input.disabled = true;
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ id: key, quantity }),
      });
      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(
          (payload && (payload.description || payload.message)) ||
            strings.updateError ||
            'Unable to update quantity.'
        );
      }
      updateCartCount(payload.item_count || 0);

      // Only show a popup when an item is removed. Quiet qty +/- just refreshes.
      if (removed) {
        await showPopup(strings.removed || 'Item removed from your cart.', {
          type: 'success',
          duration: 2200,
          closeLabel: strings.close || 'Close',
        });
      }
      window.location.reload();
      return true;
    } catch (error) {
      input.value = String(Math.max(1, previous));
      showToast((error && error.message) || strings.updateError || 'Unable to update quantity.', {
        type: 'error',
      });
      return false;
    } finally {
      input.disabled = false;
    }
  };

  const bindCartQuantity = () => {
    document.querySelectorAll('.remelle-cart').forEach((section) => {
      if (section.dataset.remelleQtyBound === 'true') return;
      section.dataset.remelleQtyBound = 'true';

      section.querySelectorAll('[data-cart-qty]').forEach((button) => {
        button.addEventListener('click', () => {
          const line = button.closest('[data-cart-line]');
          const input = line && line.querySelector('[data-cart-qty-input]');
          if (!input) return;
          const previous = Number(input.value || 1);
          const delta = Number(button.getAttribute('data-cart-qty'));
          const max = input.max ? Number(input.max) : Infinity;
          const next = Math.max(0, Math.min(max, previous + delta));
          input.value = String(next === 0 ? previous : next);
          changeLineQuantity(input, next, { previous });
        });
      });

      section.querySelectorAll('[data-cart-qty-input]').forEach((input) => {
        input.addEventListener('focus', () => {
          input.dataset.previousQty = String(input.value || 1);
        });
        input.addEventListener('change', () => {
          const previous = Number(input.dataset.previousQty || input.value || 1);
          const max = input.max ? Number(input.max) : Infinity;
          const next = Math.max(0, Math.min(max, Number(input.value || 0)));
          if (next === 0) {
            input.value = String(previous);
          } else {
            input.value = String(next);
          }
          changeLineQuantity(input, next, { previous });
        });
      });
    });
  };

  const boot = () => {
    bindProductForms();
    bindCartQuantity();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  document.addEventListener('shopify:section:load', boot);

  window.RemelleCart = {
    refreshCartCount,
    updateCartCount,
    addFromForm,
    changeLineQuantity,
    showToast,
    showPopup,
  };
})();

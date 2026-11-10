/**
 * Remelle cart helpers: AJAX add-to-cart, live nav count, floating cart, cart qty.
 * Uses Shopify Cart AJAX API only — no mocked product or price data.
 */
(() => {
  const CART_ADD = '/cart/add.js';
  const CART_GET = '/cart.js';
  const CART_CLEAR = '/cart/clear.js';
  const SAVED_CART_KEY = 'remelle:saved-cart';

  const strings = (() => {
    const node = document.getElementById('RemelleCartStrings');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return {};
    }
  })();

  const customerState = (() => {
    const node = document.getElementById('RemelleCustomer');
    if (!node) return { id: null, cartSyncPath: '/apps/remelle-cart/cart', savedCart: null };
    try {
      const data = JSON.parse(node.textContent);
      return {
        id: data && data.id != null ? String(data.id) : null,
        cartSyncPath: (data && data.cartSyncPath) || '/apps/remelle-cart/cart',
        savedCart: data && data.savedCart ? data.savedCart : null,
      };
    } catch (error) {
      return { id: null, cartSyncPath: '/apps/remelle-cart/cart', savedCart: null };
    }
  })();
  const customerId = customerState.id;
  // Assigned after cloud-sync helpers are defined; safe no-op until then.
  let notifyCartMutated = () => {};

  const copy = (value, fallback) => {
    if (value == null || value === '' || String(value).indexOf('Translation missing') === 0) {
      return fallback;
    }
    return value;
  };

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

  const syncFloatCart = (count) => {
    const floatCart = document.querySelector('[data-float-cart]');
    if (!floatCart) return;
    const template = floatCart.getAttribute('data-count-template');
    if (template) {
      floatCart.setAttribute('aria-label', template.replace('__COUNT__', String(count)));
    }
    floatCart.hidden = count <= 0;
  };

  const pulseFloatCart = () => {
    const floatCart = document.querySelector('[data-float-cart]');
    if (!floatCart || floatCart.hidden) return;
    floatCart.classList.remove('is-pop');
    void floatCart.offsetWidth;
    floatCart.classList.add('is-pop');
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
    syncFloatCart(safeCount);
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

  const formatMoney = (cents) => {
    const value = Number(cents);
    if (!Number.isFinite(value)) return '';
    const format = strings.moneyFormat || '${{amount}}';
    const abs = Math.abs(value);
    const amount = (abs / 100).toFixed(2);
    const amountNoDecimals = String(Math.round(abs / 100));
    const withCommas = (num) =>
      String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const replacements = {
      amount: withCommas(amount),
      amount_no_decimals: withCommas(amountNoDecimals),
      amount_with_comma_separator: amount.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      amount_no_decimals_with_comma_separator: amountNoDecimals.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      amount_with_apostrophe_separator: amount.replace(/\B(?=(\d{3})+(?!\d))/g, "'"),
      amount_with_space_separator: amount.replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
      amount_with_period_and_space_separator: amount.replace('.', ' ').replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    };
    let output = format;
    Object.keys(replacements).forEach((key) => {
      output = output.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), replacements[key]);
    });
    return value < 0 ? `-${output}` : output;
  };

  const formatItemCount = (count) => {
    const safe = Number(count) || 0;
    const template =
      safe === 1
        ? copy(strings.itemCountOne, '__COUNT__ item')
        : copy(strings.itemCountOther, '__COUNT__ items');
    return template.replace('__COUNT__', String(safe));
  };

  let cartRequestChain = Promise.resolve();
  const enqueueCartRequest = (task) => {
    const next = cartRequestChain.then(task, task);
    cartRequestChain = next.catch(() => {});
    return next;
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

  const updateOfferBar = (cart) => {
    const bars = document.querySelectorAll('[data-free-shipping]');
    if (!bars.length || !cart) return;

    bars.forEach((bar) => {
      const mode = bar.getAttribute('data-offer-mode') || 'quantity';
      const goal = Number(bar.getAttribute('data-offer-goal') || 0);
      if (!goal) return;

      const copyNode = bar.querySelector('.remelle-cart__shipping-copy');
      const track = bar.querySelector('.remelle-cart__shipping-track');
      const fill = bar.querySelector('.remelle-cart__shipping-fill');
      if (!copyNode) return;

      const previousState = bar.getAttribute('data-offer-state') || 'progress';
      let unlocked = false;
      let progress = 0;
      let remainingLabel = '';

      if (mode === 'quantity') {
        const count = Number(cart.item_count) || 0;
        unlocked = count >= goal;
        progress = unlocked ? 100 : Math.min(100, Math.round((count * 100) / goal));
        const remaining = Math.max(0, goal - count);
        const unit =
          remaining === 1
            ? bar.getAttribute('data-offer-unit-one') || copy(strings.offerUnitOne, 'item')
            : bar.getAttribute('data-offer-unit-other') || copy(strings.offerUnitOther, 'items');
        remainingLabel = `${remaining} ${unit}`;
      } else {
        const total = Number(cart.total_price) || 0;
        const goalCents = goal * 100;
        unlocked = total >= goalCents;
        progress = unlocked ? 100 : Math.min(100, Math.round((total * 100) / goalCents));
        remainingLabel = formatMoney(Math.max(0, goalCents - total));
      }

      bar.classList.toggle('remelle-cart__shipping--unlocked', unlocked);
      bar.setAttribute('data-offer-state', unlocked ? 'unlocked' : 'progress');

      const successKicker = bar.getAttribute('data-offer-success-kicker') || '';
      const progressKicker = bar.getAttribute('data-offer-progress-kicker') || '';
      const successMsg = bar.getAttribute('data-offer-success') || '';
      const progressTemplate = bar.getAttribute('data-offer-progress-template') || '';

      let html = '';
      if (unlocked) {
        if (successKicker) {
          html += `<p class="remelle-cart__shipping-kicker">${successKicker}</p>`;
        }
        html += `<p class="remelle-cart__shipping-text">${successMsg}</p>`;
      } else {
        if (progressKicker) {
          html += `<p class="remelle-cart__shipping-kicker">${progressKicker}</p>`;
        }
        if (progressTemplate.includes('__HIGHLIGHT__')) {
          const parts = progressTemplate.split('__HIGHLIGHT__');
          html += `<p class="remelle-cart__shipping-text">${parts[0] || ''}<strong class="remelle-cart__shipping-count">${remainingLabel}</strong>${parts[1] || ''}</p>`;
        } else {
          const remainingCount =
            mode === 'quantity' ? String(Math.max(0, goal - (Number(cart.item_count) || 0))) : remainingLabel;
          const unitLabel = mode === 'quantity' ? remainingLabel.replace(/^\d+\s*/, '') : '';
          const text = progressTemplate
            .replace('__COUNT__', remainingCount)
            .replace('__UNIT__', unitLabel)
            .replace('__AMOUNT__', remainingLabel)
            .replace(/\s+/g, ' ')
            .trim();
          html += `<p class="remelle-cart__shipping-text">${text}</p>`;
        }
      }
      copyNode.innerHTML = html;

      if (track) track.setAttribute('aria-valuenow', String(progress));
      if (fill) fill.style.width = `${progress}%`;

      if (unlocked && previousState !== 'unlocked') {
        bar.classList.remove('is-unlock-pulse');
        void bar.offsetWidth;
        bar.classList.add('is-unlock-pulse');
      }
    });
  };

  const syncCartPageTotals = (cart) => {
    if (!cart) return;
    const countNode = document.querySelector('[data-cart-page-count]');
    if (countNode) {
      countNode.textContent = formatItemCount(cart.item_count || 0);
      countNode.setAttribute('data-item-count', String(cart.item_count || 0));
    }

    const subtotal = document.querySelector('[data-cart-subtotal]');
    if (subtotal) {
      subtotal.textContent = formatMoney(cart.total_price || 0);
      subtotal.setAttribute('data-subtotal-cents', String(cart.total_price || 0));
    }

    updateOfferBar(cart);
  };

  const applyOptimisticLine = (line, quantity, previousQtyHint) => {
    if (!line) return null;
    const input = line.querySelector('[data-cart-qty-input]');
    const unitNode = line.querySelector('[data-line-unit-price]');
    const linePrice = line.querySelector('[data-line-price]');
    const previousQty =
      previousQtyHint != null ? Number(previousQtyHint) : Number(input && input.value) || 1;
    let unitCents = Number(unitNode && unitNode.getAttribute('data-unit-cents'));
    if (!Number.isFinite(unitCents) || unitCents <= 0) {
      const lineCents = Number(linePrice && linePrice.getAttribute('data-line-cents')) || 0;
      unitCents = previousQty > 0 ? Math.round(lineCents / previousQty) : 0;
    }
    const storedLineCents = Number(linePrice && linePrice.getAttribute('data-line-cents'));
    const previousLineCents =
      Number.isFinite(storedLineCents) && previousQty > 0
        ? storedLineCents
        : unitCents * previousQty;
    // If the input was already flipped to the next qty before this runs, rebuild from unit price.
    const baselineLineCents =
      Math.abs(previousLineCents - unitCents * previousQty) < 1
        ? previousLineCents
        : unitCents * previousQty;
    const nextLineCents = unitCents * quantity;

    if (input) input.value = String(Math.max(0, quantity));
    if (linePrice && quantity > 0) {
      linePrice.textContent = formatMoney(nextLineCents);
      linePrice.setAttribute('data-line-cents', String(nextLineCents));
    }

    const subtotal = document.querySelector('[data-cart-subtotal]');
    const previousSubtotal = Number(subtotal && subtotal.getAttribute('data-subtotal-cents')) || 0;
    const nextSubtotal = Math.max(
      0,
      previousSubtotal - baselineLineCents + (quantity > 0 ? nextLineCents : 0)
    );
    if (subtotal) {
      subtotal.textContent = formatMoney(nextSubtotal);
      subtotal.setAttribute('data-subtotal-cents', String(nextSubtotal));
    }

    const pageCount = document.querySelector('[data-cart-page-count]');
    const previousCount = Number(pageCount && pageCount.getAttribute('data-item-count')) || 0;
    const nextCount = Math.max(0, previousCount - previousQty + Math.max(0, quantity));
    if (pageCount) {
      pageCount.textContent = formatItemCount(nextCount);
      pageCount.setAttribute('data-item-count', String(nextCount));
    }
    updateCartCount(nextCount);
    updateOfferBar({ item_count: nextCount, total_price: nextSubtotal });

    return {
      previousQty,
      previousLineCents: baselineLineCents,
      previousSubtotal,
      previousCount,
      unitCents,
    };
  };

  const revertOptimisticLine = (line, snapshot) => {
    if (!line || !snapshot) return;
    const input = line.querySelector('[data-cart-qty-input]');
    const linePrice = line.querySelector('[data-line-price]');
    if (input) input.value = String(snapshot.previousQty);
    if (linePrice) {
      linePrice.textContent = formatMoney(snapshot.previousLineCents);
      linePrice.setAttribute('data-line-cents', String(snapshot.previousLineCents));
    }
    const subtotal = document.querySelector('[data-cart-subtotal]');
    if (subtotal) {
      subtotal.textContent = formatMoney(snapshot.previousSubtotal);
      subtotal.setAttribute('data-subtotal-cents', String(snapshot.previousSubtotal));
    }
    const pageCount = document.querySelector('[data-cart-page-count]');
    if (pageCount) {
      pageCount.textContent = formatItemCount(snapshot.previousCount);
      pageCount.setAttribute('data-item-count', String(snapshot.previousCount));
    }
    updateCartCount(snapshot.previousCount);
    updateOfferBar({ item_count: snapshot.previousCount, total_price: snapshot.previousSubtotal });
  };

  const syncLineFromCart = (line, cart, key) => {
    if (!line || !cart) return;
    const item = (cart.items || []).find((entry) => entry.key === key);
    if (!item) return;
    const input = line.querySelector('[data-cart-qty-input]');
    const linePrice = line.querySelector('[data-line-price]');
    const unitNode = line.querySelector('[data-line-unit-price]');
    if (input) input.value = String(item.quantity);
    if (unitNode) {
      unitNode.textContent = formatMoney(item.final_price || item.price || 0);
      unitNode.setAttribute('data-unit-cents', String(item.final_price || item.price || 0));
    }
    if (linePrice) {
      linePrice.textContent = formatMoney(item.final_line_price || item.line_price || 0);
      linePrice.setAttribute('data-line-cents', String(item.final_line_price || item.line_price || 0));
    }
  };

  const addVariantToCart = async (variantId, quantity = 1) => {
    const response = await fetch(CART_ADD, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ id: Number(variantId), quantity: Number(quantity) || 1 }),
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
    if (document.querySelector('.remelle-cart')) {
      await refreshCartSection();
    }
    notifyCartMutated();
    return { item: payload, cart };
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
    notifyCartMutated();
    return { item: payload, cart };
  };

  const bindEmptyCartCards = () => {
    document.querySelectorAll('[data-empty-card]').forEach((card) => {
      if (card.dataset.emptyReady === 'true') return;
      card.dataset.emptyReady = 'true';

      const dataNode = card.querySelector('[data-empty-variants]');
      const idInput = card.querySelector('[data-empty-variant-id]');
      const price = card.querySelector('[data-empty-price]');
      const image = card.querySelector('[data-empty-image]');
      const button = card.querySelector('.remelle-cart-empty__add');
      if (!dataNode || !idInput) return;

      let variants = [];
      try {
        variants = JSON.parse(dataNode.textContent);
      } catch (error) {
        return;
      }

      const selectedOptions = () => {
        const chosen = [];
        card.querySelectorAll('[data-empty-option]:checked').forEach((input) => {
          chosen[Number(input.dataset.optionIndex)] = input.value;
        });
        return chosen;
      };

      const sync = () => {
        const chosen = selectedOptions();
        const variant = variants.find((item) =>
          item.options.every((option, index) => chosen[index] == null || option === chosen[index])
        );
        if (!variant) {
          if (button) button.disabled = true;
          return;
        }
        idInput.value = String(variant.id);
        if (price) price.textContent = variant.price;
        if (image && variant.image) {
          image.src = variant.image;
          image.removeAttribute('srcset');
        }
        if (button) button.disabled = !variant.available;
      };

      card.querySelectorAll('[data-empty-option]').forEach((input) => {
        input.addEventListener('change', sync);
      });
      sync();
    });
  };

  const bindProductForms = () => {
    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (form.dataset.remelleCartBound === 'true') return;
      form.dataset.remelleCartBound = 'true';

      form.addEventListener('submit', async (event) => {
        if (!window.fetch) return;
        event.preventDefault();

        const section = form.closest('.remelle-pdp, .remelle-card, .remelle-cart-empty__piece');
        const button =
          form.querySelector('[type="submit"][name="add"], [type="submit"].remelle-card__add, [type="submit"].remelle-cart-empty__add, [data-add]') ||
          form.querySelector('[type="submit"]');
        const errorNode = section && section.querySelector('[data-cart-error]');
        const statusNode = section && section.querySelector('[data-cart-status]');
        const originalLabel = button
          ? button.dataset.label || button.getAttribute('aria-label') || button.textContent
          : '';
        const shouldRefreshCart = Boolean(form.closest('.remelle-cart'));

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

          await addFromForm(form);
          pulseFloatCart();

          if (shouldRefreshCart) {
            await refreshCartSection();
            return;
          }

          if (button && button.classList.contains('remelle-pdp__add')) {
            setTextButtonLabel(button, button.dataset.label || originalLabel);
          }
        } catch (error) {
          const message =
            (error && error.message) || strings.addError || 'Unable to add this item to your cart.';
          showToast(message, { type: 'error', duration: 5000 });
          if (errorNode) {
            errorNode.hidden = false;
            errorNode.textContent = message;
          }
          if (button && (button.classList.contains('remelle-pdp__add') || button.classList.contains('remelle-cart-empty__add'))) {
            setTextButtonLabel(button, button.dataset.label || originalLabel);
          }
        } finally {
          if (!shouldRefreshCart) setButtonBusy(button, false);
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
    const line = input.closest('[data-cart-line]');
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

    const snapshot = applyOptimisticLine(line, quantity, previous);
    if (removed && line) {
      line.classList.add('is-removing');
    }

    input.disabled = true;
    if (section) {
      section.dataset.cartPending = 'true';
      section.classList.add('is-pending');
    }

    return enqueueCartRequest(async () => {
      if (!input.isConnected && !removed) return false;

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
        syncCartPageTotals(payload);
        notifyCartMutated();

        if (removed || (payload.item_count || 0) === 0) {
          if (line && line.isConnected) {
            await new Promise((resolve) => window.setTimeout(resolve, 220));
          }
          await refreshCartSection();
          return true;
        }

        syncLineFromCart(line, payload, key);
        return true;
      } catch (error) {
        if (line) line.classList.remove('is-removing');
        revertOptimisticLine(line, snapshot);
        if (input.isConnected) input.value = String(Math.max(1, previous));
        showToast((error && error.message) || strings.updateError || 'Unable to update quantity.', {
          type: 'error',
        });
        return false;
      } finally {
        if (section) {
          delete section.dataset.cartPending;
          section.classList.remove('is-pending');
        }
        if (input.isConnected) input.disabled = false;
      }
    });
  };

  const refreshCartSection = async () => {
    const current = document.querySelector('.remelle-cart');
    const wrapper = current && current.closest('[id^="shopify-section-"]');
    if (!wrapper) {
      window.location.reload();
      return;
    }

    if (current) current.classList.add('is-refreshing');

    const sectionId = wrapper.id.replace(/^shopify-section-/, '');
    const url = new URL(window.location.href);
    url.searchParams.set('section_id', sectionId);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'text/html' },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      window.location.reload();
      return;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const next = doc.getElementById(wrapper.id);
    if (!next) {
      window.location.reload();
      return;
    }

    const y = window.scrollY;
    const nextCart = next.querySelector('.remelle-cart');
    if (nextCart) nextCart.classList.add('is-entering');
    wrapper.replaceWith(next);
    window.scrollTo(0, y);
    bindProductForms();
    bindEmptyCartCards();
    bindCartQuantity();
    bindCartDiscount();
    window.requestAnimationFrame(() => {
      const fresh = document.querySelector('.remelle-cart');
      if (fresh) fresh.classList.remove('is-entering');
    });
  };

  const bindCartDiscount = () => {
    document.querySelectorAll('.remelle-cart').forEach((section) => {
      if (section.dataset.remelleDiscountBound === 'true') return;
      const discountInput = section.querySelector('[data-cart-discount]');
      const discountApply = section.querySelector('[data-cart-discount-apply]');
      if (!discountInput || !discountApply) return;
      section.dataset.remelleDiscountBound = 'true';

      const applyDiscount = () => {
        const code = discountInput.value.trim();
        if (!code) {
          discountInput.focus();
          return;
        }
        window.location.assign(
          `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent('/cart')}`
        );
      };

      discountApply.addEventListener('click', applyDiscount);
      discountInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyDiscount();
        }
      });
    });
  };

  const bindCartQuantity = () => {
    document.querySelectorAll('.remelle-cart').forEach((section) => {
      if (section.dataset.remelleQtyBound === 'true') return;
      section.dataset.remelleQtyBound = 'true';

      section.querySelectorAll('[data-cart-qty]').forEach((button) => {
        button.addEventListener('click', () => {
          if (section.dataset.cartPending === 'true') return;
          const line = button.closest('[data-cart-line]');
          const input = line && line.querySelector('[data-cart-qty-input]');
          if (!input || input.disabled) return;
          const previous = Number(input.value || 1);
          const delta = Number(button.getAttribute('data-cart-qty'));
          const max = input.max ? Number(input.max) : Infinity;
          const next = Math.max(0, Math.min(max, previous + delta));
          if (delta > 0 && next === previous && Number.isFinite(max)) {
            showToast(copy(strings.maxQuantity, 'That is the maximum available.'), {
              type: 'error',
              duration: 3200,
            });
            return;
          }
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

  const normalizeCartItems = (items) => {
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

  const cartItemsFromAjaxCart = (cart) =>
    normalizeCartItems(
      (cart && cart.items ? cart.items : []).map((item) => ({
        id: item.variant_id || item.id,
        quantity: item.quantity,
      }))
    );

  const parseSavedCart = (raw) => {
    if (!raw) return null;
    let data = raw;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }
    if (!data || !Array.isArray(data.items)) return null;
    return {
      items: normalizeCartItems(data.items),
      updatedAt: Number(data.updatedAt || data.savedAt) || 0,
      revision: Number(data.revision) || 0,
      customerId: data.customerId != null ? String(data.customerId) : null,
    };
  };

  const readLocalSavedCart = () => {
    try {
      return parseSavedCart(window.localStorage.getItem(SAVED_CART_KEY));
    } catch (error) {
      return null;
    }
  };

  const writeLocalSavedCart = (payload) => {
    try {
      if (!payload || !payload.items || !payload.items.length) {
        window.localStorage.removeItem(SAVED_CART_KEY);
        return;
      }
      window.localStorage.setItem(
        SAVED_CART_KEY,
        JSON.stringify({
          customerId: customerId || payload.customerId || null,
          items: normalizeCartItems(payload.items),
          updatedAt: payload.updatedAt || Date.now(),
          revision: payload.revision || 0,
        })
      );
    } catch (error) {
      // Ignore storage failures (private mode, quota, etc).
    }
  };

  let cloudSyncAvailable = null;
  let syncInFlight = null;
  let syncTimer = null;
  let lastSyncedAt = 0;
  let appliedCloudUpdatedAt = 0;

  const isAccountSignedIn = (account) => {
    const root = account && account.shadowRoot;
    if (!root) return false;
    const login = root.querySelector('.account__login-slot');
    const sheet = root.querySelector('.account');
    if (!login || !sheet) return false;
    return login.hasAttribute('hidden') && !sheet.classList.contains('loading');
  };

  const isSignedIn = () => {
    if (customerId) return true;
    return [...document.querySelectorAll('shopify-account')].some(isAccountSignedIn);
  };

  const mergeCartItems = (primary, secondary) => {
    const map = new Map();
    normalizeCartItems(primary).forEach((item) => map.set(item.id, item.quantity));
    normalizeCartItems(secondary).forEach((item) => {
      const current = map.get(item.id) || 0;
      map.set(item.id, Math.max(current, item.quantity));
    });
    return [...map.entries()].map(([id, quantity]) => ({ id, quantity }));
  };

  const replaceBrowserCart = async (items) => {
    const normalized = normalizeCartItems(items);
    await fetch(CART_CLEAR, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!normalized.length) {
      updateCartCount(0);
      return { item_count: 0, items: [] };
    }
    const response = await fetch(CART_ADD, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ items: normalized }),
    });
    if (!response.ok) throw new Error('cart_restore_failed');
    return refreshCartCount();
  };

  const fetchCloudCart = async () => {
    if (!isSignedIn() || !customerId) return null;
    try {
      const response = await fetch(customerState.cartSyncPath, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      // Soft-fail on missing proxy so we keep retrying after the sync app is installed.
      if (response.status === 404 || response.status === 501 || response.status === 503) {
        cloudSyncAvailable = null;
        return null;
      }
      if (response.status === 401) {
        // Signed-out / proxy rejected — keep trying on later signed-in visits.
        cloudSyncAvailable = null;
        return null;
      }
      if (!response.ok) return null;
      const payload = await response.json();
      cloudSyncAvailable = true;
      return parseSavedCart(payload.cart);
    } catch (error) {
      cloudSyncAvailable = null;
      return null;
    }
  };

  const pushCloudCart = async (items, updatedAt = Date.now()) => {
    if (!isSignedIn() || !customerId) return null;
    const body = {
      items: normalizeCartItems(items),
      updatedAt,
      revision: 0,
    };
    writeLocalSavedCart({ ...body, customerId });
    try {
      const response = await fetch(customerState.cartSyncPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (response.status === 404 || response.status === 501 || response.status === 503 || response.status === 401) {
        cloudSyncAvailable = null;
        return null;
      }
      if (!response.ok) return null;
      const payload = await response.json();
      cloudSyncAvailable = true;
      const saved = parseSavedCart(payload.cart) || body;
      writeLocalSavedCart({ ...saved, customerId });
      lastSyncedAt = saved.updatedAt || updatedAt;
      return saved;
    } catch (error) {
      cloudSyncAvailable = null;
      return null;
    }
  };

  const snapshotCartForCustomer = async () => {
    try {
      const response = await fetch(CART_GET, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!response.ok) return;
      const cart = await response.json();
      const items = cartItemsFromAjaxCart(cart);
      const updatedAt = Date.now();
      writeLocalSavedCart({ customerId, items, updatedAt });
      await pushCloudCart(items, updatedAt);
    } catch (error) {
      // Continue logout even if snapshot fails.
    }
  };

  const clearCart = async () => {
    try {
      await fetch(CART_CLEAR, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      updateCartCount(0);
    } catch (error) {
      // Still continue to sign-out even if clear fails.
    }
  };

  const scheduleCloudSave = () => {
    if (!isSignedIn() || !customerId) return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      enqueueCartRequest(async () => {
        const cart = await refreshCartCount();
        await pushCloudCart(cartItemsFromAjaxCart(cart), Date.now());
      });
    }, 700);
  };

  const syncAuthenticatedCart = async ({ force = false } = {}) => {
    if (!isSignedIn()) return;
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      try {
        const browserCart = await refreshCartCount();
        const browserItems = cartItemsFromAjaxCart(browserCart);
        const localSaved = readLocalSavedCart();
        const liquidSaved = parseSavedCart(customerState.savedCart);
        const cloudSaved = (await fetchCloudCart()) || liquidSaved;

        const accountCart =
          cloudSaved && (!localSaved || cloudSaved.updatedAt >= (localSaved.updatedAt || 0))
            ? cloudSaved
            : localSaved || cloudSaved;

        if (!accountCart || !accountCart.items.length) {
          if (browserItems.length && customerId) {
            await pushCloudCart(browserItems, Date.now());
          }
          return;
        }

        if (customerId && accountCart.customerId && String(accountCart.customerId) !== String(customerId)) {
          return;
        }

        if (!force && accountCart.updatedAt && accountCart.updatedAt <= appliedCloudUpdatedAt) {
          return;
        }

        const merged = mergeCartItems(accountCart.items, browserItems);
        const browserKey = JSON.stringify(browserItems);
        const mergedKey = JSON.stringify(merged);

        if (browserKey !== mergedKey) {
          const nextCart = await replaceBrowserCart(merged);
          if (document.querySelector('.remelle-cart')) {
            await refreshCartSection();
          } else {
            updateCartCount(nextCart.item_count || 0);
            syncCartPageTotals(nextCart);
          }
        }

        appliedCloudUpdatedAt = Math.max(accountCart.updatedAt || 0, Date.now());
        await pushCloudCart(merged, appliedCloudUpdatedAt);
      } catch (error) {
        // Keep browsing; sync retries on next focus / cart change.
      } finally {
        syncInFlight = null;
      }
    })();

    return syncInFlight;
  };

  const restoreSavedCartIfNeeded = () => syncAuthenticatedCart({ force: true });

  const watchAccountForCartRestore = () => {
    document.querySelectorAll('shopify-account').forEach((account) => {
      if (account.dataset.remelleCartRestoreWatch === 'true') return;
      account.dataset.remelleCartRestoreWatch = 'true';

      const attach = (tries = 0) => {
        if (!account.shadowRoot) {
          if (tries < 60) requestAnimationFrame(() => attach(tries + 1));
          return;
        }
        new MutationObserver(() => {
          if (isAccountSignedIn(account)) restoreSavedCartIfNeeded();
        }).observe(account.shadowRoot, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['hidden', 'class'],
        });
        if (isAccountSignedIn(account)) restoreSavedCartIfNeeded();
      };
      attach();
    });
  };

  const isLogoutLink = (el) => {
    if (!(el instanceof HTMLAnchorElement)) return false;
    if (el.dataset.remelleSignOut === 'true') return true;
    const href = el.getAttribute('href') || '';
    if (!href) return false;
    if (href.includes('/account/logout')) return true;
    if (href.includes('/customer_authentication/logout')) return true;
    if (el.classList.contains('remelle-customer__logout') && href.includes('logout')) return true;
    return false;
  };

  const bindClearCartOnLogout = () => {
    if (document.documentElement.dataset.remelleLogoutCartBound === 'true') return;
    document.documentElement.dataset.remelleLogoutCartBound = 'true';

    document.addEventListener(
      'click',
      (event) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const link = path.find((node) => isLogoutLink(node));
        if (!link) return;
        if (link.dataset.remelleLoggingOut === 'true') {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        link.dataset.remelleLoggingOut = 'true';

        const href = link.href;
        // Persist to cloud first so the next device can restore, then clear this browser cart.
        snapshotCartForCustomer()
          .then(() => clearCart())
          .finally(() => {
            window.top.location.href = href;
          });
      },
      true
    );
  };

  const bindCartSyncHooks = () => {
    if (document.documentElement.dataset.remelleCartSyncHooks === 'true') return;
    document.documentElement.dataset.remelleCartSyncHooks = 'true';

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isSignedIn()) {
        syncAuthenticatedCart({ force: false });
      }
    });
    window.addEventListener('focus', () => {
      if (isSignedIn()) syncAuthenticatedCart({ force: false });
    });
  };

  notifyCartMutated = () => {
    scheduleCloudSave();
  };

  let quickSheet = null;
  let quickSheetProduct = null;
  let quickSheetSelected = {};
  let quickSheetLastFocus = null;
  let quickSheetOnKey = null;
  let quickSheetDrag = null;
  const quickDesktopQuery = window.matchMedia('(min-width: 769px)');
  const quickReduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const readQuickProduct = (button) => {
    const card = button.closest('.remelle-card');
    const node =
      (card && card.querySelector('[data-quick-product]')) ||
      (button.parentElement && button.parentElement.querySelector('[data-quick-product]'));
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return null;
    }
  };

  const findQuickVariant = (product, selected) => {
    if (!product || !Array.isArray(product.variants)) return null;
    return product.variants.find((variant) =>
      (variant.options || []).every((option, index) => {
        const value = selected[index];
        return value == null || value === '' || option === value;
      })
    );
  };

  const syncQuickPresentation = () => {
    if (!quickSheet) return;
    const desktop = quickDesktopQuery.matches;
    quickSheet.classList.toggle('remelle-quick-sheet--modal', desktop);
    quickSheet.classList.toggle('remelle-quick-sheet--sheet', !desktop);
    const panel = quickSheet.querySelector('[data-quick-panel]');
    if (panel) {
      panel.style.transform = '';
      panel.style.transition = '';
    }
  };

  const closeQuickSheet = () => {
    if (!quickSheet) return;
    const panel = quickSheet.querySelector('[data-quick-panel]');
    if (panel) {
      panel.style.transform = '';
      panel.style.transition = '';
    }
    quickSheet.classList.remove('is-visible');
    document.documentElement.classList.remove('remelle-sheet-open');
    if (quickSheetOnKey) {
      document.removeEventListener('keydown', quickSheetOnKey);
      quickSheetOnKey = null;
    }
    window.setTimeout(() => {
      if (quickSheet && !quickSheet.classList.contains('is-visible')) {
        quickSheet.hidden = true;
      }
    }, 320);
    if (quickSheetLastFocus && typeof quickSheetLastFocus.focus === 'function') {
      quickSheetLastFocus.focus();
    }
    quickSheetLastFocus = null;
    quickSheetProduct = null;
    quickSheetSelected = {};
    quickSheetDrag = null;
  };

  const renderQuickSheetState = () => {
    if (!quickSheet || !quickSheetProduct) return;
    const product = quickSheetProduct;
    const image = quickSheet.querySelector('[data-quick-image]');
    const name = quickSheet.querySelector('[data-quick-name]');
    const price = quickSheet.querySelector('[data-quick-price]');
    const optionsHost = quickSheet.querySelector('[data-quick-options]');
    const error = quickSheet.querySelector('[data-quick-error]');
    const addBtn = quickSheet.querySelector('[data-quick-submit]');

    if (name) name.textContent = product.title || '';
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }

    if (optionsHost) {
      optionsHost.replaceChildren();
      (product.options || []).forEach((option, optionIndex) => {
        const fieldset = document.createElement('div');
        fieldset.className = 'remelle-quick-sheet__options';

        const legend = document.createElement('p');
        legend.className = 'remelle-quick-sheet__legend';
        legend.textContent =
          option.name ||
          copy(strings.sizeLabel, 'Size') ||
          `Option ${optionIndex + 1}`;
        fieldset.appendChild(legend);

        const choices = document.createElement('div');
        choices.className = 'remelle-quick-sheet__choices';
        choices.setAttribute('role', 'listbox');
        choices.setAttribute('aria-label', legend.textContent);

        (option.values || []).forEach((value) => {
          const valueName = typeof value === 'string' ? value : value && value.name;
          if (!valueName) return;
          const choice = document.createElement('button');
          choice.type = 'button';
          choice.className = 'remelle-quick-sheet__choice';
          choice.textContent = valueName;
          choice.setAttribute('role', 'option');
          choice.setAttribute('aria-selected', quickSheetSelected[optionIndex] === valueName ? 'true' : 'false');
          if (quickSheetSelected[optionIndex] === valueName) {
            choice.classList.add('is-selected');
          }

          const anyAvailable = product.variants.some(
            (variant) => variant.options && variant.options[optionIndex] === valueName && variant.available
          );
          if (!anyAvailable) {
            choice.classList.add('is-unavailable');
            choice.disabled = true;
          }

          choice.addEventListener('click', () => {
            quickSheetSelected[optionIndex] = valueName;
            renderQuickSheetState();
          });
          choices.appendChild(choice);
        });

        fieldset.appendChild(choices);
        optionsHost.appendChild(fieldset);
      });
    }

    const selectedComplete = (product.options || []).every((_, index) => Boolean(quickSheetSelected[index]));
    const variant = selectedComplete ? findQuickVariant(product, quickSheetSelected) : null;

    if (image) {
      const src = (variant && variant.image) || product.image;
      if (src) {
        image.src = src;
        image.alt = product.title || '';
        image.hidden = false;
        image.classList.remove('remelle-quick-sheet__image--empty');
      } else {
        image.removeAttribute('src');
        image.hidden = true;
        image.classList.add('remelle-quick-sheet__image--empty');
      }
    }

    if (price) {
      price.textContent = (variant && variant.price) || product.price || '';
    }

    if (addBtn) {
      const label = copy(strings.addToCart, 'Add to cart');
      addBtn.disabled = false;
      addBtn.textContent = label;
      addBtn.dataset.label = label;
      addBtn.dataset.variantId = variant && variant.available ? String(variant.id) : '';
    }
  };

  const bindQuickSheetSwipe = () => {
    if (!quickSheet || quickSheet.dataset.swipeBound === 'true') return;
    quickSheet.dataset.swipeBound = 'true';
    const panel = quickSheet.querySelector('[data-quick-panel]');
    if (!panel) return;

    const onStart = (event) => {
      if (quickDesktopQuery.matches || quickReduceQuery.matches) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const target = event.target;
      const fromHandle = target.closest && target.closest('[data-quick-handle]');
      const atTop = panel.scrollTop <= 0;
      if (!fromHandle && !atTop) return;
      quickSheetDrag = {
        startY: touch.clientY,
        currentY: touch.clientY,
        active: true,
      };
      panel.style.transition = 'none';
    };

    const onMove = (event) => {
      if (!quickSheetDrag || !quickSheetDrag.active) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const delta = Math.max(0, touch.clientY - quickSheetDrag.startY);
      quickSheetDrag.currentY = touch.clientY;
      if (delta > 0) {
        event.preventDefault();
        panel.style.transform = `translateY(${delta}px)`;
      }
    };

    const onEnd = () => {
      if (!quickSheetDrag || !quickSheetDrag.active) return;
      const delta = Math.max(0, quickSheetDrag.currentY - quickSheetDrag.startY);
      quickSheetDrag = null;
      if (delta > 90) {
        closeQuickSheet();
        return;
      }
      panel.style.transition = '';
      panel.style.transform = '';
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
  };

  const openQuickSheet = (product, trigger) => {
    if (!product) return;
    if (!quickSheet) {
      quickSheet = document.createElement('div');
      quickSheet.id = 'RemelleQuickSheet';
      quickSheet.className = 'remelle-quick-sheet remelle-quick-sheet--sheet';
      quickSheet.hidden = true;
      quickSheet.setAttribute('role', 'dialog');
      quickSheet.setAttribute('aria-modal', 'true');
      quickSheet.setAttribute('aria-label', copy(strings.selectOptions, 'Choose options'));
      quickSheet.innerHTML = `
        <div class="remelle-quick-sheet__panel" data-quick-panel>
          <div class="remelle-quick-sheet__handle" data-quick-handle aria-hidden="true"></div>
          <button class="remelle-quick-sheet__close" type="button" data-quick-close aria-label="${copy(strings.quickAddClose, 'Close')}">
            <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path d="M4 4l10 10M14 4L4 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="remelle-quick-sheet__product">
            <img class="remelle-quick-sheet__image" data-quick-image alt="" width="110" height="146">
            <div>
              <p class="remelle-quick-sheet__name" data-quick-name></p>
              <p class="remelle-quick-sheet__price" data-quick-price></p>
            </div>
          </div>
          <div data-quick-options></div>
          <p class="remelle-quick-sheet__error" data-quick-error hidden></p>
          <button class="remelle-quick-sheet__add" type="button" data-quick-submit>
            ${copy(strings.addToCart, 'Add to cart')}
          </button>
        </div>
      `;

      quickSheet.addEventListener('click', (event) => {
        if (event.target === quickSheet) closeQuickSheet();
      });
      quickSheet.querySelector('[data-quick-close]').addEventListener('click', closeQuickSheet);
      quickSheet.querySelector('[data-quick-submit]').addEventListener('click', async () => {
        const addBtn = quickSheet.querySelector('[data-quick-submit]');
        const error = quickSheet.querySelector('[data-quick-error]');
        const variantId = addBtn && addBtn.dataset.variantId;
        const needsSize = (quickSheetProduct.options || []).some((_, index) => !quickSheetSelected[index]);

        if (needsSize || !variantId) {
          if (error) {
            const missing = (quickSheetProduct.options || []).filter((_, index) => !quickSheetSelected[index]);
            const onlySizeMissing =
              missing.length > 0 &&
              missing.every((option) => /size/i.test(String(option.name || '')));
            error.hidden = false;
            error.textContent = onlySizeMissing
              ? copy(strings.selectSize, 'Please select a size')
              : copy(strings.selectOptions, 'Please select your options');
          }
          return;
        }

        const idleLabel = addBtn.dataset.label || copy(strings.addToCart, 'Add to cart');
        try {
          setButtonBusy(addBtn, true);
          addBtn.textContent = copy(strings.adding, 'Adding…');
          await enqueueCartRequest(() => addVariantToCart(variantId, 1));
          pulseFloatCart();
          closeQuickSheet();
        } catch (err) {
          if (error) {
            error.hidden = false;
            error.textContent =
              (err && err.message) || strings.addError || 'Unable to add this item to your cart.';
          }
          addBtn.textContent = idleLabel;
        } finally {
          setButtonBusy(addBtn, false);
          if (addBtn.isConnected && quickSheet && quickSheet.classList.contains('is-visible')) {
            addBtn.textContent = idleLabel;
          }
        }
      });

      bindQuickSheetSwipe();
      document.body.appendChild(quickSheet);

      if (typeof quickDesktopQuery.addEventListener === 'function') {
        quickDesktopQuery.addEventListener('change', syncQuickPresentation);
      } else if (typeof quickDesktopQuery.addListener === 'function') {
        quickDesktopQuery.addListener(syncQuickPresentation);
      }
    }

    syncQuickPresentation();
    quickSheetLastFocus = trigger || document.activeElement;
    quickSheetProduct = product;
    quickSheetSelected = {};
    (product.options || []).forEach((option, index) => {
      const values = (option.values || [])
        .map((value) => (typeof value === 'string' ? value : value && value.name))
        .filter(Boolean);
      if (values.length === 1) quickSheetSelected[index] = values[0];
    });

    renderQuickSheetState();
    quickSheet.hidden = false;
    document.documentElement.classList.add('remelle-sheet-open');
    requestAnimationFrame(() => {
      syncQuickPresentation();
      quickSheet.classList.add('is-visible');
    });

    quickSheetOnKey = (event) => {
      if (event.key === 'Escape') closeQuickSheet();
    };
    document.addEventListener('keydown', quickSheetOnKey);

    const firstChoice = quickSheet.querySelector('.remelle-quick-sheet__choice:not([disabled])');
    if (firstChoice) firstChoice.focus();
    else {
      const closeBtn = quickSheet.querySelector('[data-quick-close]');
      if (closeBtn) closeBtn.focus();
    }
  };

  const bindQuickAdd = () => {
    if (document.documentElement.dataset.remelleQuickAddBound === 'true') return;
    document.documentElement.dataset.remelleQuickAddBound = 'true';

    document.addEventListener(
      'click',
      (event) => {
        const button = event.target.closest('[data-quick-add]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const product = readQuickProduct(button);
        if (!product) return;
        openQuickSheet(product, button);
      },
      true
    );
  };

  const boot = () => {
    bindProductForms();
    bindEmptyCartCards();
    bindCartQuantity();
    bindCartDiscount();
    bindQuickAdd();
    bindClearCartOnLogout();
    bindCartSyncHooks();
    watchAccountForCartRestore();
    restoreSavedCartIfNeeded();
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
    pulseFloatCart,
    addFromForm,
    addVariantToCart,
    changeLineQuantity,
    clearCart,
    showToast,
    showPopup,
    openQuickSheet,
    closeQuickSheet,
    syncAuthenticatedCart,
  };
})();

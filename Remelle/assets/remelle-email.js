/**
 * Live email validation for theme forms and Shopify Account sign-in.
 */
(() => {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SHADOW_STYLE_ID = 'remelle-email-shadow-style';

  const message = (() => {
    const node = document.getElementById('RemelleEmailStrings');
    if (!node) return 'Please enter a valid email (name@example.com).';
    try {
      const data = JSON.parse(node.textContent);
      return data.invalid || 'Please enter a valid email (name@example.com).';
    } catch (error) {
      return 'Please enter a valid email (name@example.com).';
    }
  })();

  const isValidEmail = (value) => EMAIL_PATTERN.test(String(value || '').trim());

  const shouldShowError = (value) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (isValidEmail(text)) return false;
    if (/\s/.test(text)) return true;
    if (text.includes('@')) return true;
    return text.length >= 4;
  };

  const injectShadowStyles = (root) => {
    if (!root || root.getElementById(SHADOW_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SHADOW_STYLE_ID;
    style.textContent = `
      .remelle-email-error {
        margin: 8px 0 0;
        color: #670d0d;
        font-family: inherit;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.3;
      }
      .login-form__email-input.remelle-input--invalid,
      input[type="email"].remelle-input--invalid {
        outline: 1px solid #670d0d;
        outline-offset: 0;
      }
    `;
    root.appendChild(style);
  };

  const ensureErrorNode = (input) => {
    const id = input.id ? `${input.id}-error` : `RemelleEmailError-${Math.random().toString(36).slice(2, 9)}`;
    const root = input.getRootNode();
    let error = root.getElementById ? root.getElementById(id) : document.getElementById(id);
    if (error) return error;

    if (root instanceof ShadowRoot) injectShadowStyles(root);

    error = document.createElement('p');
    error.id = id;
    error.className = 'remelle-email-error';
    error.hidden = true;
    error.setAttribute('role', 'alert');

    const accountWrapper = input.closest('.login-form__email-input-wrapper, .login-form__email-form');
    if (accountWrapper) {
      accountWrapper.insertAdjacentElement('afterend', error);
      return error;
    }

    const field =
      input.closest('.remelle-contact__field, .remelle-customer__form, .newsletter, label') ||
      input.parentElement;
    if (field && field !== input) {
      if (input.parentElement && input.parentElement.classList.contains('newsletter__row')) {
        const newsletter = input.closest('.newsletter');
        const rule = newsletter && newsletter.querySelector('.newsletter__rule');
        if (rule && rule.parentNode) {
          rule.parentNode.insertBefore(error, rule.nextSibling);
        } else {
          input.parentElement.insertAdjacentElement('afterend', error);
        }
      } else {
        input.insertAdjacentElement('afterend', error);
      }
    } else {
      input.insertAdjacentElement('afterend', error);
    }

    return error;
  };

  const setInvalid = (input, invalid) => {
    const error = ensureErrorNode(input);
    const describedby = input.getAttribute('aria-describedby') || '';
    const ids = describedby.split(/\s+/).filter(Boolean);

    if (invalid) {
      input.classList.add('remelle-input--invalid');
      input.setAttribute('aria-invalid', 'true');
      error.hidden = false;
      error.textContent = message;
      if (!ids.includes(error.id)) {
        input.setAttribute('aria-describedby', [...ids, error.id].join(' '));
      }
    } else {
      input.classList.remove('remelle-input--invalid');
      input.removeAttribute('aria-invalid');
      error.hidden = true;
      error.textContent = '';
      const next = ids.filter((id) => id !== error.id);
      if (next.length) {
        input.setAttribute('aria-describedby', next.join(' '));
      } else {
        input.removeAttribute('aria-describedby');
      }
    }
  };

  const validate = (input, options = {}) => {
    const value = input.value;
    const force = Boolean(options.force);
    if (!value.trim()) {
      setInvalid(input, false);
      return true;
    }
    if (isValidEmail(value)) {
      setInvalid(input, false);
      return true;
    }
    if (force || shouldShowError(value)) {
      setInvalid(input, true);
      return false;
    }
    setInvalid(input, false);
    return true;
  };

  const bindInput = (input) => {
    if (!input || input.dataset.remelleEmailBound === 'true') return;
    input.dataset.remelleEmailBound = 'true';

    input.setAttribute('inputmode', 'email');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', input.getAttribute('autocomplete') || 'email');

    input.addEventListener('input', () => validate(input));
    input.addEventListener('blur', () => {
      if (input.value.trim()) validate(input, { force: true });
    });

    const form = input.closest('form') || input.form;
    if (form && form.dataset.remelleEmailFormBound !== 'true') {
      form.dataset.remelleEmailFormBound = 'true';
      form.addEventListener(
        'submit',
        (event) => {
          const emails = form.querySelectorAll('input[type="email"]');
          let ok = true;
          emails.forEach((field) => {
            if (!validate(field, { force: true })) ok = false;
          });
          if (!ok) {
            event.preventDefault();
            event.stopPropagation();
            const firstInvalid = form.querySelector('input[type="email"].remelle-input--invalid');
            if (firstInvalid) firstInvalid.focus();
          }
        },
        true
      );
    }
  };

  const collectEmailInputs = (root = document) => {
    const found = [];
    const walk = (node) => {
      if (!node) return;
      if (node instanceof Element && node.shadowRoot) walk(node.shadowRoot);
      if (!node.querySelectorAll) return;
      node.querySelectorAll('input[type="email"]').forEach((input) => found.push(input));
      node.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    };
    walk(root);
    return found;
  };

  const bindAll = () => {
    document
      .querySelectorAll(
        '.newsletter input[type="email"], .remelle-contact__form input[type="email"], .remelle-customer__form input[type="email"], .article input[type="email"]#email'
      )
      .forEach(bindInput);

    document.querySelectorAll('shopify-account').forEach((account) => {
      collectEmailInputs(account).forEach(bindInput);
    });
  };

  const observeAccounts = () => {
    document.querySelectorAll('shopify-account').forEach((account) => {
      if (account.dataset.remelleEmailWatch === 'true') return;
      account.dataset.remelleEmailWatch = 'true';

      const attach = (tries = 0) => {
        bindAll();
        const root = account.shadowRoot;
        if (!root) {
          if (tries < 60) requestAnimationFrame(() => attach(tries + 1));
          return;
        }

        const watchNested = () => {
          bindAll();
          root.querySelectorAll('shopify-login-form, shopify-login-form-loader').forEach((el) => {
            if (!el.shadowRoot || el.dataset.remelleEmailObserved === 'true') return;
            el.dataset.remelleEmailObserved = 'true';
            new MutationObserver(bindAll).observe(el.shadowRoot, {
              childList: true,
              subtree: true
            });
            bindAll();
          });
        };

        new MutationObserver(watchNested).observe(root, {
          childList: true,
          subtree: true
        });
        watchNested();
      };

      attach();
    });
  };

  const start = () => {
    bindAll();
    observeAccounts();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

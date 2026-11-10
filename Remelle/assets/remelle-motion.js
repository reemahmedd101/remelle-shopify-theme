/**
 * Quiet scroll reveals. Elements stay visible when motion is reduced
 * or IntersectionObserver is unavailable.
 */
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('js-motion')) return;
  if (!('IntersectionObserver' in window)) {
    root.classList.remove('js-motion');
    return;
  }

  const selector = [
    '.remelle-hero__eyebrow',
    '.remelle-hero__heading',
    '.remelle-hero__description',
    '.remelle-hero__button',
    '.remelle-house__eyebrow',
    '.remelle-house__heading',
    '.remelle-house__body',
    '.remelle-products__header',
    '.remelle-products .remelle-card',
    '.remelle-editorial__copy',
    '.remelle-story__heading',
    '.remelle-story__media',
    '.remelle-story__statement',
    '.remelle-story__body',
    '.remelle-story__button',
    '.remelle-about-story__media',
    '.remelle-about-story__copy',
    '.remelle-about-values__heading',
    '.remelle-about-values__item',
    '.remelle-about-faq__intro',
    '.remelle-about-faq__row',
    '.remelle-about-invite__inner > *',
    '.remelle-contact__intro',
    '.remelle-contact__form-wrap',
    '.remelle-listing__header',
    '.remelle-listing .remelle-card',
    '.remelle-pdp__gallery',
    '.remelle-pdp__buy',
    '.remelle-recs__header',
    '.remelle-recs .remelle-card',
    '.remelle-cart-empty__hero',
    '.remelle-cart-empty__intro',
    '.remelle-cart-empty__item',
    '.remelle-page__heading',
    '.remelle-page__content',
    '.site-footer__columns > div',
    '.site-footer .newsletter',
    '.site-footer__brand',
  ].join(',');

  const prepare = (scope) => {
    const nodes = [...scope.querySelectorAll(selector)].filter((node) => !node.classList.contains('remelle-reveal'));
    const groups = new Map();

    nodes.forEach((node) => {
      node.classList.add('remelle-reveal');
      const parent = node.parentElement;
      const list = groups.get(parent) || [];
      list.push(node);
      groups.set(parent, list);
    });

    groups.forEach((list) => {
      list.forEach((node, index) => {
        node.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 80}ms`);
      });
    });

    const visible = [];
    const waiting = [];

    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
      const passed = rect.bottom <= 0;
      if (inView || passed) {
        visible.push(node);
      } else {
        waiting.push(node);
      }
    });

    requestAnimationFrame(() => {
      visible.forEach((node) => node.classList.add('is-in'));
      waiting.forEach((node) => observer.observe(node));
    });
  };

  const revealIfReached = () => {
    document.querySelectorAll('.remelle-reveal:not(.is-in)').forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.94) node.classList.add('is-in');
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  window.addEventListener('scroll', revealIfReached, { passive: true });

  const watch = (scope) => prepare(scope);

  const boot = () => watch(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', (event) => {
    if (event.target) watch(event.target);
  });
})();

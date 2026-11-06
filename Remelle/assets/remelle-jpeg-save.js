(() => {
  const MIN_SIZE = 80;
  const SELECTOR = [
    '.remelle-pdp__image',
    '.remelle-card__image',
    '.remelle-hero__image',
    '.remelle-story img',
    '.remelle-editorial img',
    '.remelle-about-story img',
    '.remelle-cart img',
    'main img'
  ].join(', ');

  function shopSrc(img) {
    const src = img.currentSrc || img.src || '';
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) return '';
    if (!/\/cdn\/shop\//.test(src)) return '';
    return src;
  }

  function isConvertible(img) {
    if (!img || img.dataset.remelleJpeg === '1') return false;
    if ((img.naturalWidth || 0) > 0 && img.naturalWidth < MIN_SIZE) return false;
    if ((img.naturalHeight || 0) > 0 && img.naturalHeight < MIN_SIZE) return false;
    return Boolean(shopSrc(img));
  }

  function jpegRequestUrl(src) {
    try {
      const url = new URL(src, window.location.href);
      url.searchParams.set('format', 'jpg');
      url.searchParams.delete('width');
      // Keep a large width so saves stay useful
      url.searchParams.set('width', '2000');
      return url.href;
    } catch (_) {
      return src;
    }
  }

  function fileBaseName(img, src) {
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt) {
      return alt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'remelle-image';
    }
    try {
      const path = new URL(src, window.location.href).pathname;
      const leaf = path.split('/').pop() || 'remelle-image';
      return leaf.replace(/\.[a-z0-9]+$/i, '') || 'remelle-image';
    } catch (_) {
      return 'remelle-image';
    }
  }

  async function blobToJpeg(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve) => {
      canvas.toBlob((jpeg) => resolve(jpeg), 'image/jpeg', 0.92);
    });
  }

  async function prepareJpeg(img) {
    if (!isConvertible(img)) return img.dataset.remelleBlob || '';
    if (img.dataset.remelleJpegPending === '1') {
      await new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
          if (img.dataset.remelleJpeg === '1' || Date.now() - start > 8000) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
      return img.dataset.remelleBlob || '';
    }

    img.dataset.remelleJpegPending = '1';

    try {
      const original = shopSrc(img);
      const source = jpegRequestUrl(original);
      const response = await fetch(source, {
        mode: 'cors',
        credentials: 'omit',
        headers: { Accept: 'image/jpeg,image/*,*/*;q=0.8' }
      });
      if (!response.ok) return '';

      const raw = await response.blob();
      const jpeg = await blobToJpeg(raw);
      if (!jpeg) return '';

      const objectUrl = URL.createObjectURL(jpeg);
      const previous = img.dataset.remelleBlob;
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = objectUrl;
      img.dataset.remelleJpeg = '1';
      img.dataset.remelleBlob = objectUrl;
      img.dataset.remelleJpegName = `${fileBaseName(img, original)}.jpg`;
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    } catch (_) {
      return '';
    } finally {
      delete img.dataset.remelleJpegPending;
    }
  }

  function downloadJpeg(objectUrl, filename) {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || 'remelle-image.jpg';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function resolveImage(event) {
    const gallery = event.target && event.target.closest
      ? event.target.closest('.remelle-pdp__gallery, .remelle-pdp__stage')
      : null;
    if (gallery) {
      return (
        gallery.querySelector('.remelle-pdp__slide.is-active .remelle-pdp__image') ||
        gallery.querySelector('.remelle-pdp__image')
      );
    }
    return event.target && event.target.closest ? event.target.closest('img') : null;
  }

  async function onContextMenu(event) {
    const img = resolveImage(event);
    if (!img) return;
    if (!(isConvertible(img) || img.dataset.remelleJpeg === '1')) return;

    event.preventDefault();
    event.stopPropagation();

    const objectUrl = img.dataset.remelleBlob || (await prepareJpeg(img));
    if (!objectUrl) return;
    downloadJpeg(objectUrl, img.dataset.remelleJpegName || 'remelle-image.jpg');
  }

  function watch(img) {
    if (!img || img.dataset.remelleJpegWatch === '1') return;
    img.dataset.remelleJpegWatch = '1';
    const run = () => {
      prepareJpeg(img);
    };
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }

  function scan(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(watch);
  }

  document.addEventListener('contextmenu', onContextMenu, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
  } else {
    scan(document);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches && node.matches(SELECTOR)) watch(node);
        scan(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

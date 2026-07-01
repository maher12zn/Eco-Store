
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     0. Helpers
  --------------------------------------------------------------- */
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const fmtMoney = (n) => '$' + n.toFixed(2);

  function showToast(message, icon = '\u2713') {
    const stack = $('#toastStack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 220);
    }, 2200);
  }

  /* ---------------------------------------------------------------
     1. Mobile search toggle
     Icon button shows/hides a collapsible search row using Bootstrap's
     Collapse component, swaps the icon to a close glyph, and focuses
     the input automatically. Escape or clicking outside closes it.
  --------------------------------------------------------------- */
  function initSearchToggle() {
    const btn = $('#searchToggleBtn');
    const row = $('#mobileSearchRow');
    if (!btn || !row || !window.bootstrap) return;

    const collapse = new bootstrap.Collapse(row, { toggle: false });
    const iconEl = $('.search-toggle-ic', btn);

    function setOpenState(isOpen) {
      btn.setAttribute('aria-expanded', String(isOpen));
      iconEl.innerHTML = isOpen ? '&#10005;' : '&#128269;';
    }

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        collapse.hide();
      } else {
        collapse.show();
      }
    });

    row.addEventListener('shown.bs.collapse', () => {
      setOpenState(true);
      const input = $('#mobileSearchInput');
      if (input) input.focus();
    });
    row.addEventListener('hidden.bs.collapse', () => setOpenState(false));

    // Close on outside click
    document.addEventListener('click', (e) => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (!isOpen) return;
      if (!row.contains(e.target) && !btn.contains(e.target)) {
        collapse.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        collapse.hide();
        btn.focus();
      }
    });

    // If the viewport grows past the breakpoint where the toggle is
    // hidden (md+), make sure the collapsible row is reset/closed.
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && btn.getAttribute('aria-expanded') === 'true') {
        collapse.hide();
      }
    });
  }

  /* ---------------------------------------------------------------
     2. Wishlist toggling
  --------------------------------------------------------------- */
  function initWishlist() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.wish-btn');
      if (!btn) return;
      btn.classList.toggle('active');
      const isActive = btn.classList.contains('active');
      btn.innerHTML = isActive ? '&#10084;' : '&#9825;';
      showToast(isActive ? 'Added to wishlist' : 'Removed from wishlist', isActive ? '\u2764' : '\u2026');
    });

    // Topbar wishlist icon buttons just give quick feedback
    $$('.topbar [aria-label="Wishlist mobile"], .topbar .btn-icon-text').forEach((btn) => {
      btn.addEventListener('click', () => showToast('Opening your wishlist'));
    });
  }

  /* ---------------------------------------------------------------
     3 & 4. Cart: quantity controls, removal, live totals
     Cart state lives in a single JS object keyed by data-cart-id.
     Both the desktop panel and the mobile offcanvas render the same
     ids, so any change re-renders quantities/totals into *all*
     matching nodes (document-wide) to keep them in sync.
  --------------------------------------------------------------- */
  const cart = {}; // { id: { price, qty } }
  const DISCOUNT_RATE = 0.10; // matches the ~10% shown in the design (45.50 / 458.97)

  function collectCartItems() {
    // Seed cart state once from the first occurrence of each item.
    const seen = new Set();
    $$('.cart-item[data-cart-id]').forEach((el) => {
      const id = el.dataset.cartId;
      if (seen.has(id)) return;
      seen.add(id);
      cart[id] = {
        price: parseFloat(el.dataset.price),
        qty: 1,
      };
    });
  }

  function renderCart() {
    const ids = Object.keys(cart);
    let subtotal = 0;
    let count = 0;

    ids.forEach((id) => {
      const item = cart[id];
      if (!item) return;
      subtotal += item.price * item.qty;
      count += item.qty;

      $$(`.cart-item[data-cart-id="${id}"]`).forEach((el) => {
        const qtyVal = $('.qty-val', el);
        const minusBtn = $('[data-qty="minus"]', el);
        if (qtyVal) qtyVal.textContent = item.qty;
        if (minusBtn) minusBtn.disabled = item.qty <= 1;
      });
    });

    const discount = subtotal * DISCOUNT_RATE;
    const total = subtotal - discount;

    $$('.js-subtotal').forEach((el) => (el.textContent = fmtMoney(subtotal)));
    $$('.js-discount').forEach((el) => (el.textContent = subtotal > 0 ? '-' + fmtMoney(discount) : '$0.00'));
    $$('.js-total').forEach((el) => (el.textContent = fmtMoney(total)));
    $$('.js-cart-count').forEach((el) => (el.textContent = count));

    // Empty-cart state
    $$('.cart-items-list').forEach((list) => {
      let emptyMsg = $('.cart-empty-msg', list);
      if (count === 0 || list.children.length === 0) {
        if (!emptyMsg) {
          emptyMsg = document.createElement('div');
          emptyMsg.className = 'cart-empty-msg';
          emptyMsg.textContent = 'Your cart is empty.';
          list.appendChild(emptyMsg);
        }
      } else if (emptyMsg) {
        emptyMsg.remove();
      }
    });
  }

  function removeCartItem(id) {
    delete cart[id];
    $$(`.cart-item[data-cart-id="${id}"]`).forEach((el) => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 180);
    });
    renderCart();
  }

  function initCart() {
    collectCartItems();
    renderCart();

    document.addEventListener('click', (e) => {
      const qtyBtn = e.target.closest('.qty-btn');
      const delBtn = e.target.closest('.del-btn');

      if (qtyBtn) {
        const itemEl = qtyBtn.closest('.cart-item');
        const id = itemEl?.dataset.cartId;
        if (!id || !cart[id]) return;
        if (qtyBtn.dataset.qty === 'plus') {
          cart[id].qty += 1;
        } else if (cart[id].qty > 1) {
          cart[id].qty -= 1;
        }
        renderCart();
        return;
      }

      if (delBtn) {
        const itemEl = delBtn.closest('.cart-item');
        const id = itemEl?.dataset.cartId;
        if (!id) return;
        removeCartItem(id);
        showToast('Item removed from cart');
        return;
      }

      if (e.target.closest('.checkout-btn')) {
        showToast('Heading to checkout');
      }
    });
  }

  /* ---------------------------------------------------------------
     5. Promo code apply
  --------------------------------------------------------------- */
  const VALID_PROMO = 'NOVA10';

  function initPromo() {
    $$('.apply-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.promo-input-row');
        const input = $('.promo-input', row);
        const code = (input.value || '').trim().toUpperCase();

        // remove any previous message in this row
        const existingMsg = row.nextElementSibling?.classList?.contains('promo-msg')
          ? row.nextElementSibling
          : null;
        if (existingMsg) existingMsg.remove();

        const msg = document.createElement('div');
        msg.className = 'promo-msg';

        if (!code) {
          input.classList.add('is-invalid');
          input.classList.remove('is-valid');
          msg.classList.add('text-danger');
          msg.textContent = 'Enter a promo code first.';
        } else if (code === VALID_PROMO) {
          input.classList.add('is-valid');
          input.classList.remove('is-invalid');
          msg.classList.add('text-success');
          msg.textContent = 'Promo applied! Extra 10% off.';
          showToast('Promo code applied');
        } else {
          input.classList.add('is-invalid');
          input.classList.remove('is-valid');
          msg.classList.add('text-danger');
          msg.textContent = 'That code is not valid.';
        }
        row.insertAdjacentElement('afterend', msg);
      });
    });
  }

  /* ---------------------------------------------------------------
     6. Add-to-cart buttons in the product grid (".add-btn", ".add-circle")
     These are demo product cards (not already in the cart object), so
     clicking them gives toast feedback and bumps the cart count badge
     without inventing fake line items in the real cart panel.
  --------------------------------------------------------------- */
  function initAddToCartButtons() {
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.add-btn, .add-circle');
      if (!addBtn) return;
      const card = addBtn.closest('.product-card, .suggest-item');
      const name = $('.product-name, .suggest-name', card)?.textContent?.trim() || 'Item';
      showToast(`${name} added to cart`, '\uD83D\uDED2');
    });
  }

  /* ---------------------------------------------------------------
     7. Carousel dot navigation (hero banner + best deals)
     Click any dot to activate it; hero banner also autoplays.
  --------------------------------------------------------------- */
  function initDotCarousel(containerSel, { autoplay = false, interval = 4000 } = {}) {
    const container = $(containerSel);
    if (!container) return;
    const dots = $$('.dot', container);
    if (!dots.length) return;
    let activeIndex = dots.findIndex((d) => d.classList.contains('active'));
    if (activeIndex < 0) activeIndex = 0;

    function activate(i) {
      dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
      activeIndex = i;
    }

    dots.forEach((dot, i) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => activate(i));
    });

    if (autoplay) {
      setInterval(() => activate((activeIndex + 1) % dots.length), interval);
    }
  }

  /* ---------------------------------------------------------------
     8. Flash sale countdown timer
  --------------------------------------------------------------- */
  function initFlashTimer() {
    const el = $('#flashTimer');
    if (!el) return;
    let seconds = parseInt(el.dataset.seconds, 10) || 0;

    function render() {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      el.textContent = `${pad(h)} : ${pad(m)} : ${pad(s)}`;
    }

    render();
    setInterval(() => {
      seconds = seconds > 0 ? seconds - 1 : 0;
      render();
    }, 1000);
  }

  /* ---------------------------------------------------------------
     9. Light / dark mode toggle
  --------------------------------------------------------------- */
  function initThemeToggle() {
    const btn = $('#themeToggle');
    if (!btn) return;
    const textEl = $('.mode-text', btn);
    const iconEl = $('.mode-ic', btn);

    function applyTheme(isDark) {
      document.body.classList.toggle('dark-mode', isDark);
      if (textEl) textEl.textContent = isDark ? 'Dark Mode' : 'Light Mode';
      if (iconEl) iconEl.innerHTML = isDark ? '&#127769;' : '&#9728;&#65039;';
    }

    let isDark = sessionStorage ? sessionStorage.getItem('novashop-theme') === 'dark' : false;
    applyTheme(isDark);

    btn.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme(isDark);
      try { sessionStorage.setItem('novashop-theme', isDark ? 'dark' : 'light'); } catch (err) { /* ignore */ }
    });
  }

  /* ---------------------------------------------------------------
     10. AI assistant fab + notification bell
     Neither has a real backend in this static build, so clicking
     gives clear, honest feedback instead of doing nothing.
  --------------------------------------------------------------- */
  function initFabAndBell() {
    const fab = $('.ai-fab');
    if (fab) {
      fab.addEventListener('click', () => showToast('AI assistant is not connected yet', '\u2728'));
    }
    const bell = $('[aria-label="Notifications"]');
    if (bell) {
      bell.addEventListener('click', () => showToast('3 new notifications', '\uD83D\uDD14'));
    }
  }

  /* ---------------------------------------------------------------
     Init
  --------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initSearchToggle();
    initWishlist();
    initCart();
    initPromo();
    initAddToCartButtons();
    initDotCarousel('.hero-dots', { autoplay: true, interval: 5000 });
    initDotCarousel('.carousel-dots');
    initFlashTimer();
    initThemeToggle();
    initFabAndBell();
  });
})();

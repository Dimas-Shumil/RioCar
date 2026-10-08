// Общая мобильная навигация для всех страниц админки RioCar.
(() => {
  'use strict';

  const openButton = document.querySelector('[data-admin-mobile-open]');
  const menu = document.querySelector('[data-admin-mobile-menu]');
  const backdrop = document.querySelector('[data-admin-mobile-backdrop]');
  const closeButton = document.querySelector('[data-admin-mobile-close]');
  const breakpoint = window.matchMedia('(max-width: 760px)');

  if (!openButton || !menu || !backdrop || !closeButton) return;

  let returnFocus = null;
  const focusableSelector = 'a[href], button:not([disabled])';

  function closeMenu(restoreFocus = true) {
    if (menu.hidden) return;
    menu.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('is-admin-mobile-menu-open');
    openButton.setAttribute('aria-expanded', 'false');
    openButton.classList.remove('is-menu-open');
    if (restoreFocus && breakpoint.matches) (returnFocus || openButton).focus();
    returnFocus = null;
  }

  function openMenu() {
    if (!breakpoint.matches || !menu.hidden) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    menu.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('is-admin-mobile-menu-open');
    openButton.setAttribute('aria-expanded', 'true');
    openButton.classList.add('is-menu-open');
    closeButton.focus();
  }

  openButton.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
  closeButton.addEventListener('click', () => closeMenu());
  backdrop.addEventListener('click', () => closeMenu());
  menu.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => closeMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
    if (event.key !== 'Tab') return;
    const elements = [...menu.querySelectorAll(focusableSelector)].filter(el => el.getClientRects().length);
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const onBreakpointChange = () => closeMenu(false);
  if (breakpoint.addEventListener) breakpoint.addEventListener('change', onBreakpointChange);
  else breakpoint.addListener(onBreakpointChange);
})();

function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const burger = header.querySelector('.header__burger');
  const mobileMenu = header.querySelector('.mobile-menu');
  const overlay = header.querySelector('.mobile-menu-overlay');
  const body = document.body;

  const setMenuState = (isOpen) => {
    burger?.classList.toggle('active', isOpen);
    mobileMenu?.classList.toggle('active', isOpen);
    overlay?.classList.toggle('active', isOpen);
    body.classList.toggle('menu-open', isOpen);
    burger?.setAttribute('aria-expanded', String(isOpen));
  };

  const closeMenu = () => setMenuState(false);

  burger?.addEventListener('click', () => {
    setMenuState(!burger.classList.contains('active'));
  });

  overlay?.addEventListener('click', closeMenu);

  mobileMenu?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  let lastScroll = window.scrollY;
  let ticking = false;

  const updateHeader = () => {
    const currentScroll = window.scrollY;
    const isScrollingDown = currentScroll > lastScroll;
    const menuOpen = body.classList.contains('menu-open');

    header.classList.toggle('scrolled', currentScroll > 20);
    header.classList.toggle(
      'header--hidden',
      isScrollingDown && currentScroll > 120 && !menuOpen,
    );

    lastScroll = currentScroll;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;

    window.requestAnimationFrame(updateHeader);
    ticking = true;
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeMenu();
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      if (!selector || selector === '#') return;

      const target = document.querySelector(selector);
      if (!target) return;

      event.preventDefault();

      const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        20;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

function initCarsFilter() {
  const filters = [...document.querySelectorAll('.cars-filter')];
  const cards = [...document.querySelectorAll('.cars-card')];

  if (!filters.length || !cards.length) return;

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter || 'all';

      filters.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });

      cards.forEach((card) => {
        card.hidden =
          filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothScroll();
  initCarsFilter();
});

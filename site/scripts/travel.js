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

    if (burger && mobileMenu && overlay) {
        burger.addEventListener('click', () => {
            setMenuState(!burger.classList.contains('active'));
        });

        overlay.addEventListener('click', closeMenu);

        mobileMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });
    }

    let lastScroll = window.scrollY;
    let ticking = false;

    const updateHeaderOnScroll = () => {
        const currentScroll = window.scrollY;
        const menuOpen = body.classList.contains('menu-open');
        const isScrollingDown = currentScroll > lastScroll;
        const shouldHide = isScrollingDown && currentScroll > 120 && !menuOpen;

        header.classList.toggle('scrolled', currentScroll > 20);
        header.classList.toggle('header--hidden', shouldHide);

        lastScroll = currentScroll;
        ticking = false;
    };

    updateHeaderOnScroll();

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateHeaderOnScroll);
            ticking = true;
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 992) {
            closeMenu();
        }
    });
}

function initSmoothScroll() {
    const body = document.body;

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            event.preventDefault();

            const header = document.querySelector('.header');
            const burger = document.querySelector('.header__burger');
            const mobileMenu = document.querySelector('.mobile-menu');
            const overlay = document.querySelector('.mobile-menu-overlay');

            const headerHeight = header?.offsetHeight || 0;
            const topOffset = headerHeight + 20;
            const topPosition = target.getBoundingClientRect().top + window.pageYOffset - topOffset;

            window.scrollTo({
                top: topPosition,
                behavior: 'smooth'
            });

            if (burger?.classList.contains('active')) {
                burger.classList.remove('active');
                mobileMenu?.classList.remove('active');
                overlay?.classList.remove('active');
                body.classList.remove('menu-open');
                burger.setAttribute('aria-expanded', 'false');
            }
        });
    });
}

function initTravelFilters() {
    const filters = document.querySelectorAll('.travel-filter');
    const cards = document.querySelectorAll('.travel-card');

    if (!filters.length || !cards.length) return;

    filters.forEach((btn) => {
        btn.addEventListener('click', () => {
            filters.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            cards.forEach((card) => {
                const categories = (card.dataset.category || '').split(' ');

                if (filter === 'all' || categories.includes(filter)) {
                    card.hidden = false;
                } else {
                    card.hidden = true;
                }
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initSmoothScroll();
    initTravelFilters();
});
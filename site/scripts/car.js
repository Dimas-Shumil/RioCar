(() => {
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
      const menuOpen = body.classList.contains('menu-open');
      const scrollingDown = currentScroll > lastScroll;

      header.classList.toggle('scrolled', currentScroll > 20);
      header.classList.toggle(
        'header--hidden',
        scrollingDown && currentScroll > 120 && !menuOpen,
      );

      lastScroll = currentScroll;
      ticking = false;
    };

    updateHeader();

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
          18;

        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  function initGallery() {
    const gallery = document.querySelector('[data-car-gallery]');
    if (!gallery) return;

    const stage = gallery.querySelector('.car-gallery__stage');
    const mainImage = gallery.querySelector('[data-gallery-main]');
    const thumbs = [...gallery.querySelectorAll('[data-gallery-thumb]')];
    const prevButton = gallery.querySelector('[data-gallery-prev]');
    const nextButton = gallery.querySelector('[data-gallery-next]');

    if (!mainImage || !thumbs.length) return;

    let currentIndex = Math.max(
      0,
      thumbs.findIndex((thumb) => thumb.classList.contains('is-active')),
    );

    const showImage = (index) => {
      const normalizedIndex = (index + thumbs.length) % thumbs.length;
      const thumb = thumbs[normalizedIndex];
      const nextSrc = thumb.dataset.gallerySrc;
      const nextAlt = thumb.dataset.galleryAlt || 'Автомобиль RioCar';

      if (!nextSrc) return;

      currentIndex = normalizedIndex;
      stage?.classList.add('is-changing');

      const preloader = new Image();
      preloader.onload = () => {
        mainImage.src = nextSrc;
        mainImage.alt = nextAlt;

        thumbs.forEach((item, itemIndex) => {
          const active = itemIndex === currentIndex;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });

        window.setTimeout(() => {
          stage?.classList.remove('is-changing');
        }, 70);
      };

      preloader.onerror = () => {
        stage?.classList.remove('is-changing');
      };

      preloader.src = nextSrc;
    };

    thumbs.forEach((thumb, index) => {
      thumb.addEventListener('click', () => showImage(index));
    });

    prevButton?.addEventListener('click', () => showImage(currentIndex - 1));
    nextButton?.addEventListener('click', () => showImage(currentIndex + 1));

    let touchStartX = 0;

    stage?.addEventListener(
      'touchstart',
      (event) => {
        touchStartX = event.changedTouches[0]?.clientX || 0;
      },
      { passive: true },
    );

    stage?.addEventListener(
      'touchend',
      (event) => {
        const touchEndX = event.changedTouches[0]?.clientX || 0;
        const distance = touchEndX - touchStartX;

        if (Math.abs(distance) < 48) return;
        showImage(distance > 0 ? currentIndex - 1 : currentIndex + 1);
      },
      { passive: true },
    );
  }

  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function formatDateForMessage(value) {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function initDates() {
    const startInput = document.querySelector('[data-start-date]');
    const endInput = document.querySelector('[data-end-date]');

    if (!startInput || !endInput) return;

    const today = formatDateForInput(new Date());
    startInput.min = today;
    endInput.min = today;

    startInput.addEventListener('change', () => {
      endInput.min = startInput.value || today;

      if (endInput.value && endInput.value < endInput.min) {
        endInput.value = startInput.value;
      }
    });
  }

  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('8')) {
      return `7${digits.slice(1)}`;
    }

    if (digits.length === 11 && digits.startsWith('7')) {
      return digits;
    }

    if (digits.length === 10) {
      return `7${digits}`;
    }

    return '';
  }

  function formatPhone(value) {
    const normalized = normalizePhone(value);
    if (!normalized) return '';

    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }

  function initPhoneMask() {
    document.querySelectorAll('input[type="tel"]').forEach((input) => {
      input.addEventListener('input', () => {
        let digits = input.value.replace(/\D/g, '');

        if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
        if (!digits.startsWith('7')) digits = `7${digits}`;

        digits = digits.slice(0, 11);

        let result = '+7';
        if (digits.length > 1) result += ` (${digits.slice(1, 4)}`;
        if (digits.length >= 5) result += `) ${digits.slice(4, 7)}`;
        if (digits.length >= 8) result += `-${digits.slice(7, 9)}`;
        if (digits.length >= 10) result += `-${digits.slice(9, 11)}`;

        input.value = result;
      });

      input.addEventListener('focus', () => {
        if (!input.value) input.value = '+7 ';
      });

      input.addEventListener('blur', () => {
        if (!normalizePhone(input.value)) input.value = '';
      });
    });
  }

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle('is-error', isError);
  }

  function initBookingForm() {
    const form = document.querySelector('[data-car-booking-form]');
    if (!form) return;

    const submitButton = form.querySelector('[data-booking-submit]');
    const submitText = submitButton?.querySelector('span');
    const status = form.querySelector('[data-booking-status]');
    const formTimeInput = form.querySelector('[data-form-time]');
    const formStartTime = Date.now();

    if (formTimeInput) formTimeInput.value = String(formStartTime);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!submitButton || !status) return;

      status.hidden = true;
      status.classList.remove('is-error');

      const formData = new FormData(form);
      const name = String(formData.get('name') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      const startDate = String(formData.get('start_date') || '').trim();
      const endDate = String(formData.get('end_date') || '').trim();
      const comment = String(formData.get('comment') || '').trim();
      const car = String(formData.get('car') || '').trim();
      const carYear = String(formData.get('car_year') || '').trim();
      const carPrice = String(formData.get('car_price') || '').trim();
      const website = String(formData.get('website') || '').trim();
      const personalDataConsent =
        String(formData.get('personal_data_consent') || '') === 'yes';
      const privacyPolicyAccepted =
        String(formData.get('privacy_policy_accepted') || '') === 'yes';
      const consentVersion = String(
        formData.get('consent_version') || '',
      ).trim();
      const privacyPolicyVersion = String(
        formData.get('privacy_policy_version') || '',
      ).trim();
      const formType = String(formData.get('form_type') || '').trim();

      if (website) return;

      if (Date.now() - formStartTime < 2500) {
        showStatus(status, 'Попробуйте отправить форму через несколько секунд.', true);
        return;
      }

      if (!personalDataConsent || !privacyPolicyAccepted) {
        showStatus(status, 'Поставьте две галочки под формой.', true);

        const uncheckedConsent = !personalDataConsent
          ? form.querySelector('[data-personal-data-consent]')
          : form.querySelector('[data-privacy-policy-accepted]');

        uncheckedConsent?.focus();
        return;
      }

      if (name.length < 2 || name.length > 60) {
        showStatus(status, 'Введите имя от 2 до 60 символов.', true);
        return;
      }

      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone || !/^79\d{9}$/.test(normalizedPhone)) {
        showStatus(status, 'Введите корректный российский номер телефона.', true);
        return;
      }

      if (!startDate || !endDate) {
        showStatus(status, 'Выберите даты начала и окончания аренды.', true);
        return;
      }

      if (endDate < startDate) {
        showStatus(status, 'Дата окончания не может быть раньше даты начала.', true);
        return;
      }

      const tripDate = `${formatDateForMessage(startDate)} — ${formatDateForMessage(endDate)}`;
      const messageParts = [];
      if (comment) messageParts.push(comment);

      const payload = {
        name,
        phone: formatPhone(phone),
        car,
        date: tripDate,
        car_year: carYear || '—',
        car_price: carPrice || '—',
        message: messageParts.join(' ') || 'Заявка на бронирование автомобиля.',
        website,
        page: window.location.pathname,
        form_time: Number(formTimeInput?.value || formStartTime),
        form_type: formType,
        personal_data_consent: personalDataConsent,
        privacy_policy_accepted: privacyPolicyAccepted,
        consent_version: consentVersion,
        privacy_policy_version: privacyPolicyVersion,
      };

      submitButton.disabled = true;
      if (submitText) submitText.textContent = 'Отправляем…';

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch('/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Не удалось отправить заявку.');
        }

        showStatus(
          status,
          'Заявка отправлена. Менеджер RioCar скоро свяжется с вами.',
        );

        const preservedCar = formData.get('car');
        const preservedYear = formData.get('car_year');
        const preservedPrice = formData.get('car_price');

        form.reset();
        form.elements.car.value = preservedCar;
        form.elements.car_year.value = preservedYear;
        form.elements.car_price.value = preservedPrice;

        if (formTimeInput) formTimeInput.value = String(Date.now());

        const startInput = form.querySelector('[data-start-date]');
        const endInput = form.querySelector('[data-end-date]');
        const today = formatDateForInput(new Date());

        if (startInput) startInput.min = today;
        if (endInput) endInput.min = today;
      } catch (error) {
        const message =
          error.name === 'AbortError'
            ? 'Сервер долго не отвечает. Позвоните нам или попробуйте позже.'
            : error.message || 'Ошибка отправки. Попробуйте позже.';

        showStatus(status, message, true);
      } finally {
        window.clearTimeout(timeoutId);
        submitButton.disabled = false;
        if (submitText) submitText.textContent = 'Забронировать автомобиль';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initSmoothScroll();
    initGallery();
    initDates();
    initPhoneMask();
    initBookingForm();
  });
})();

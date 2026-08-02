(() => {
  const CARS_URL = '/api/admin/cars';

  const categoryLabels = {
    ECONOM: 'Эконом',
    COMFORT: 'Комфорт',
    PREMIUM: 'Премиум',
  };

  const state = {
    search: '',
    category: 'ALL',
    visibility: 'ALL',
    page: 1,
    pages: 1,
    total: 0,
    limit: 20,
    searchTimer: null,
  };

  const elements = {
    refresh: document.querySelector('[data-cars-refresh]'),
    message: document.querySelector('[data-cars-message]'),
    search: document.querySelector('[data-cars-search]'),
    category: document.querySelector('[data-cars-category]'),
    visibility: document.querySelector('[data-cars-visibility]'),
    loading: document.querySelector('[data-cars-loading]'),
    content: document.querySelector('[data-cars-content]'),
    table: document.querySelector('[data-cars-table]'),
    list: document.querySelector('[data-cars-list]'),
    empty: document.querySelector('[data-cars-empty]'),
    pagination: document.querySelector('[data-cars-pagination]'),
    pageLabel: document.querySelector('[data-cars-page-label]'),
    prev: document.querySelector('[data-cars-page="prev"]'),
    next: document.querySelector('[data-cars-page="next"]'),
    stats: document.querySelectorAll('[data-cars-stat]'),
  };

  function redirectToLogin() {
    window.location.replace('/admin/login');
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    return { response, data };
  }

  async function requestWithCsrf(url, options = {}, forceRefresh = false) {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard?.getCsrfToken) {
      throw new Error('Не удалось получить токен безопасности.');
    }

    const csrfToken = await sessionGuard.getCsrfToken(forceRefresh);

    const result = await requestJson(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-CSRF-Token': csrfToken,
      },
    });

    if (result.response.status === 403 && !forceRefresh) {
      return requestWithCsrf(url, options, true);
    }

    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === '') {
      return 'Не указана';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 'Не указана';
    }

    return `${new Intl.NumberFormat('ru-RU').format(number)} ₽ / сутки`;
  }

  function showMessage(text, success = false) {
    elements.message.textContent = text;
    elements.message.hidden = false;
    elements.message.classList.toggle('admin-cars__message--success', success);
  }

  function hideMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
    elements.message.classList.remove('admin-cars__message--success');
  }

  function setLoading(isLoading) {
    elements.loading.hidden = !isLoading;
    elements.refresh.disabled = isLoading;

    if (isLoading) {
      elements.content.hidden = true;
    }
  }

  function renderStats(stats = {}) {
    const values = {
      total: Number(stats.total) || 0,
      active: Number(stats.active) || 0,
      hidden: Number(stats.hidden) || 0,
    };

    elements.stats.forEach((element) => {
      const name = element.dataset.carsStat;
      element.textContent = String(values[name] ?? 0);
    });
  }

  function renderCars(cars = []) {
    const hasCars = Array.isArray(cars) && cars.length > 0;

    elements.table.hidden = !hasCars;
    elements.empty.hidden = hasCars;

    if (!hasCars) {
      elements.list.innerHTML = '';
      return;
    }

    elements.list.innerHTML = cars
      .map((car) => {
        const image =
          car.primaryImage?.imagePath || '/site/image/logo-mini.png';
        const category = categoryLabels[car.category] || car.category || '—';
        const statusText = car.isActive ? 'На сайте' : 'Скрыт';
        const toggleText = car.isActive ? 'Скрыть' : 'Опубликовать';

        return `
          <tr>
            <td data-label="Автомобиль">
              <div class="admin-car-row__main">
                <img
                  src="${escapeHtml(image)}"
                  alt=""
                  loading="lazy"
                />

                <div>
                  <strong>${escapeHtml(car.title || 'Без названия')}</strong>
                  <span>${escapeHtml(car.year || 'Год не указан')} · ${escapeHtml(car.slug || '—')}</span>
                </div>
              </div>
            </td>

            <td data-label="Класс">
              <span class="admin-car-row__category" data-category="${escapeHtml(car.category || '')}">
                ${escapeHtml(category)}
              </span>
            </td>

            <td data-label="Цена">
              <strong class="admin-car-row__price">
                ${escapeHtml(formatPrice(car.pricePerDay))}
              </strong>
            </td>

            <td data-label="Порядок">
              <span>${escapeHtml(car.sortOrder ?? 0)}</span>
            </td>

            <td data-label="Статус">
              <span class="admin-car-row__status" data-active="${car.isActive ? 'true' : 'false'}">
                ${statusText}
              </span>
            </td>

            <td data-label="Действия">
              <div class="admin-car-row__actions">
                <button
                  type="button"
                  data-car-visibility="${escapeHtml(car.id)}"
                  data-car-active="${car.isActive ? 'true' : 'false'}"
                >
                  ${toggleText}
                </button>

                <a href="/admin/cars/${escapeHtml(car.id)}/edit">
                  Редактировать
                </a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderPagination(pagination = {}) {
    state.page = Number(pagination.page) || 1;
    state.pages = Math.max(Number(pagination.pages) || 1, 1);
    state.total = Number(pagination.total) || 0;

    elements.pagination.hidden = state.total === 0;
    elements.pageLabel.textContent = `Страница ${state.page} из ${state.pages}`;
    elements.prev.disabled = state.page <= 1;
    elements.next.disabled = state.page >= state.pages;
  }

  async function loadCars() {
    setLoading(true);
    hideMessage();

    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      category: state.category,
      visibility: state.visibility,
    });

    if (state.search) {
      params.set('search', state.search);
    }

    try {
      const { response, data } = await requestJson(
        `${CARS_URL}?${params.toString()}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось загрузить автомобили.');
      }

      renderStats(data.stats);
      renderCars(data.cars);
      renderPagination(data.pagination);
      elements.content.hidden = false;
    } catch (error) {
      showMessage(error.message || 'Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(button) {
    const carId = Number(button.dataset.carVisibility);
    const isActive = button.dataset.carActive === 'true';

    if (!Number.isInteger(carId) || carId < 1) {
      return;
    }

    button.disabled = true;
    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${CARS_URL}/${carId}/visibility`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось изменить публикацию.');
      }

      await loadCars();
      showMessage(data.message || 'Статус обновлён.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось изменить публикацию.');
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    elements.refresh?.addEventListener('click', () => {
      void loadCars();
    });

    elements.search?.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);

      state.searchTimer = window.setTimeout(() => {
        state.search = elements.search.value.trim();
        state.page = 1;
        void loadCars();
      }, 300);
    });

    elements.category?.addEventListener('change', () => {
      state.category = elements.category.value;
      state.page = 1;
      void loadCars();
    });

    elements.visibility?.addEventListener('change', () => {
      state.visibility = elements.visibility.value;
      state.page = 1;
      void loadCars();
    });

    elements.prev?.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        void loadCars();
      }
    });

    elements.next?.addEventListener('click', () => {
      if (state.page < state.pages) {
        state.page += 1;
        void loadCars();
      }
    });

    elements.list?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-car-visibility]');

      if (button) {
        void toggleVisibility(button);
      }
    });
  }

  async function init() {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard) {
      redirectToLogin();
      return;
    }

    const sessionReady = await sessionGuard.ready;

    if (!sessionReady) {
      return;
    }

    bindEvents();
    await loadCars();
  }

  void init();
})();

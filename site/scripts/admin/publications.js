(() => {
  const PUBLICATIONS_URL = '/api/admin/publications';

  const typeLabels = {
    NEWS: 'Новость',
    PROMOTION: 'Акция',
    OFFER: 'Предложение',
  };

  const state = {
    search: '',
    type: 'ALL',
    visibility: 'ALL',
    page: 1,
    pages: 1,
    total: 0,
    limit: 20,
    searchTimer: null,
  };

  const elements = {
    refresh: document.querySelector('[data-publications-refresh]'),
    message: document.querySelector('[data-publications-message]'),
    search: document.querySelector('[data-publications-search]'),
    type: document.querySelector('[data-publications-type]'),
    visibility: document.querySelector('[data-publications-visibility]'),
    loading: document.querySelector('[data-publications-loading]'),
    content: document.querySelector('[data-publications-content]'),
    table: document.querySelector('[data-publications-table]'),
    list: document.querySelector('[data-publications-list]'),
    empty: document.querySelector('[data-publications-empty]'),
    pagination: document.querySelector('[data-publications-pagination]'),
    pageLabel: document.querySelector('[data-publications-page-label]'),
    prev: document.querySelector('[data-publications-page="prev"]'),
    next: document.querySelector('[data-publications-page="next"]'),
    stats: document.querySelectorAll('[data-publications-stat]'),
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

  function formatDate(value) {
    if (!value) return 'Без срока';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Без срока';

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  function formatPeriod(publication) {
    if (publication.startsAt && publication.endsAt) {
      return `${formatDate(publication.startsAt)} — ${formatDate(publication.endsAt)}`;
    }

    if (publication.endsAt) {
      return `До ${formatDate(publication.endsAt)}`;
    }

    if (publication.publishedAt) {
      return formatDate(publication.publishedAt);
    }

    return 'Без срока';
  }

  function showMessage(text, success = false) {
    elements.message.textContent = text;
    elements.message.hidden = false;
    elements.message.classList.toggle(
      'admin-publications__message--success',
      success,
    );
  }

  function hideMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
    elements.message.classList.remove('admin-publications__message--success');
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
      onHome: Number(stats.onHome) || 0,
    };

    elements.stats.forEach((element) => {
      const name = element.dataset.publicationsStat;
      element.textContent = String(values[name] ?? 0);
    });
  }

  function renderPublications(publications = []) {
    const hasPublications =
      Array.isArray(publications) && publications.length > 0;

    elements.table.hidden = !hasPublications;
    elements.empty.hidden = hasPublications;

    if (!hasPublications) {
      elements.list.innerHTML = '';
      return;
    }

    elements.list.innerHTML = publications
      .map((publication) => {
        const image =
          publication.coverImage || '/site/image/black-lexus.webp';
        const type = typeLabels[publication.type] || 'Публикация';
        const statusText = publication.isActive ? 'На сайте' : 'Скрыта';
        const toggleText = publication.isActive ? 'Скрыть' : 'Опубликовать';
        const homeText = publication.showOnHome ? 'В слайдере' : 'Не показывается';

        return `
          <tr>
            <td data-label="Публикация">
              <div class="admin-publication-row__main">
                <img
                  src="${escapeHtml(image)}"
                  alt=""
                  loading="lazy"
                />
                <div>
                  <strong>${escapeHtml(publication.title || 'Без заголовка')}</strong>
                  <span>${escapeHtml(publication.slug || '—')}</span>
                </div>
              </div>
            </td>

            <td data-label="Тип">
              <span
                class="admin-publication-row__type"
                data-type="${escapeHtml(publication.type || '')}"
              >
                ${escapeHtml(type)}
              </span>
            </td>

            <td data-label="Срок">
              <span class="admin-publication-row__period">
                ${escapeHtml(formatPeriod(publication))}
              </span>
            </td>

            <td data-label="Главная">
              <span
                class="admin-publication-row__home"
                data-home="${publication.showOnHome ? 'true' : 'false'}"
              >
                ${homeText}
              </span>
            </td>

            <td data-label="Статус">
              <span
                class="admin-publication-row__status"
                data-active="${publication.isActive ? 'true' : 'false'}"
              >
                ${statusText}
              </span>
            </td>

            <td data-label="Действия">
              <div class="admin-publication-row__actions">
                <button
                  type="button"
                  data-publication-visibility="${escapeHtml(publication.id)}"
                  data-publication-active="${publication.isActive ? 'true' : 'false'}"
                >
                  ${toggleText}
                </button>
                <a href="/admin/publications/${escapeHtml(publication.id)}/edit">
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

  async function loadPublications() {
    setLoading(true);
    hideMessage();

    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      type: state.type,
      visibility: state.visibility,
    });

    if (state.search) {
      params.set('search', state.search);
    }

    try {
      const { response, data } = await requestJson(
        `${PUBLICATIONS_URL}?${params.toString()}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось загрузить публикации.');
      }

      renderStats(data.stats);
      renderPublications(data.publications);
      renderPagination(data.pagination);
      elements.content.hidden = false;
    } catch (error) {
      showMessage(error.message || 'Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(button) {
    const publicationId = Number(button.dataset.publicationVisibility);
    const isActive = button.dataset.publicationActive === 'true';

    if (!Number.isInteger(publicationId) || publicationId < 1) return;

    button.disabled = true;
    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${PUBLICATIONS_URL}/${publicationId}/visibility`,
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

      await loadPublications();
      showMessage(data.message || 'Статус обновлён.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось изменить публикацию.');
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    elements.refresh?.addEventListener('click', () => {
      void loadPublications();
    });

    elements.search?.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        state.search = elements.search.value.trim();
        state.page = 1;
        void loadPublications();
      }, 300);
    });

    elements.type?.addEventListener('change', () => {
      state.type = elements.type.value;
      state.page = 1;
      void loadPublications();
    });

    elements.visibility?.addEventListener('change', () => {
      state.visibility = elements.visibility.value;
      state.page = 1;
      void loadPublications();
    });

    elements.prev?.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        void loadPublications();
      }
    });

    elements.next?.addEventListener('click', () => {
      if (state.page < state.pages) {
        state.page += 1;
        void loadPublications();
      }
    });

    elements.list?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-publication-visibility]');
      if (button) void toggleVisibility(button);
    });
  }

  async function init() {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard) {
      redirectToLogin();
      return;
    }

    const sessionReady = await sessionGuard.ready;
    if (!sessionReady) return;

    bindEvents();
    await loadPublications();
  }

  void init();
})();

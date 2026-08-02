(() => {
  const REQUESTS_URL = '/api/admin/requests';

  const statusLabels = {
    NEW: 'Новая',
    IN_PROGRESS: 'В работе',
    CONTACTED: 'Связались',
    COMPLETED: 'Завершена',
  };

  const state = {
    search: '',
    status: 'ALL',
    page: 1,
    limit: 20,
    pages: 1,
    total: 0,
    selectedRequestId: null,
    searchTimer: null,
  };

  const elements = {
    refresh: document.querySelector('[data-requests-refresh]'),

    message: document.querySelector('[data-requests-message]'),

    search: document.querySelector('[data-requests-search]'),

    loading: document.querySelector('[data-requests-loading]'),

    content: document.querySelector('[data-requests-content]'),

    list: document.querySelector('[data-requests-list]'),

    empty: document.querySelector('[data-requests-empty]'),

    pagination: document.querySelector('[data-requests-pagination]'),

    pageLabel: document.querySelector('[data-requests-page-label]'),

    prevPage: document.querySelector('[data-requests-page="prev"]'),

    nextPage: document.querySelector('[data-requests-page="next"]'),

    modal: document.querySelector('[data-request-modal]'),

    modalLoading: document.querySelector('[data-request-modal-loading]'),

    modalContent: document.querySelector('[data-request-modal-content]'),

    modalNumber: document.querySelector('[data-request-modal-number]'),

    modalName: document.querySelector('[data-request-modal-name]'),

    modalPhone: document.querySelector('[data-request-modal-phone]'),

    modalCar: document.querySelector('[data-request-modal-car]'),

    modalYear: document.querySelector('[data-request-modal-year]'),

    modalPrice: document.querySelector('[data-request-modal-price]'),

    modalTripDate: document.querySelector('[data-request-modal-trip-date]'),

    modalPage: document.querySelector('[data-request-modal-page]'),

    modalMessage: document.querySelector('[data-request-modal-message]'),

    modalStatus: document.querySelector('[data-request-modal-status]'),

    modalCreated: document.querySelector('[data-request-modal-created]'),

    modalSave: document.querySelector('[data-request-modal-save]'),

    modalError: document.querySelector('[data-request-modal-error]'),
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

    return {
      response,
      data,
    };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeTelephone(value) {
    const digits = String(value || '').replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7${digits.slice(1)}`;
    }

    if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits}`;
    }

    if (digits.length === 10) {
      return `+7${digits}`;
    }

    return '';
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Krasnoyarsk',
    }).format(date);
  }

  function setLoading(isLoading) {
    elements.loading.hidden = !isLoading;
    elements.refresh.disabled = isLoading;

    if (isLoading) {
      elements.content.hidden = true;
    }
  }

  function showMessage(text) {
    elements.message.textContent = text;
    elements.message.hidden = false;
  }

  function hideMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
  }

  function showModalError(text) {
    elements.modalError.textContent = text;
    elements.modalError.hidden = false;
  }

  function hideModalError() {
    elements.modalError.textContent = '';
    elements.modalError.hidden = true;
  }

  function renderStatusCounts(counts = {}) {
    document.querySelectorAll('[data-requests-count]').forEach((element) => {
      const status = element.dataset.requestsCount;

      element.textContent = String(Number(counts[status]) || 0);
    });
  }

  function renderActiveStatus() {
    document.querySelectorAll('[data-requests-status]').forEach((button) => {
      const active = button.dataset.requestsStatus === state.status;

      button.classList.toggle('admin-requests__status-button--active', active);

      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderRequests(requests = []) {
    if (!Array.isArray(requests) || requests.length === 0) {
      elements.list.innerHTML = '';
      elements.empty.hidden = false;

      return;
    }

    elements.empty.hidden = true;

    elements.list.innerHTML = requests
      .map((request) => {
        const status = statusLabels[request.status] || 'Без статуса';

        const telephone = normalizeTelephone(request.phone);

        const phoneMarkup = telephone
          ? `
            <a href="tel:${escapeHtml(telephone)}">
              ${escapeHtml(request.phone)}
            </a>
          `
          : escapeHtml(request.phone || '—');

        return `
          <tr data-request-row="${escapeHtml(request.id)}">
            <td data-label="Заявка">
              <span class="admin-request-row__number">
                №${escapeHtml(request.id)}
              </span>
            </td>

            <td data-label="Клиент">
              <strong class="admin-request-row__name">
                ${escapeHtml(request.name || 'Без имени')}
              </strong>
            </td>

            <td data-label="Автомобиль">
              <span class="admin-request-row__car">
                ${escapeHtml(request.car || '—')}
              </span>

              ${
                request.carYear
                  ? `
                    <small>
                      ${escapeHtml(request.carYear)}
                    </small>
                  `
                  : ''
              }
            </td>

            <td data-label="Телефон">
              ${phoneMarkup}
            </td>

            <td data-label="Дата поездки">
              ${escapeHtml(request.tripDate || '—')}
            </td>

            <td data-label="Статус">
              <span
                class="admin-request-row__status"
                data-status="${escapeHtml(request.status || '')}"
              >
                ${escapeHtml(status)}
              </span>
            </td>

            <td data-label="Создана">
              <time
                datetime="${escapeHtml(request.createdAt || '')}"
              >
                ${escapeHtml(formatDate(request.createdAt))}
              </time>
            </td>

            <td data-label="Действия">
              <button
                class="admin-request-row__open"
                type="button"
                data-request-open="${escapeHtml(request.id)}"
              >
                Открыть
              </button>
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

    elements.prevPage.disabled = state.page <= 1;

    elements.nextPage.disabled = state.page >= state.pages;
  }

  async function loadRequests() {
    setLoading(true);
    hideMessage();

    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      status: state.status,
    });

    if (state.search) {
      params.set('search', state.search);
    }

    try {
      const { response, data } = await requestJson(
        `${REQUESTS_URL}?${params.toString()}`,
      );

      if (response.status === 401) {
        redirectToLogin();

        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось загрузить заявки.');
      }

      renderStatusCounts(data.filters?.statusCounts);

      renderActiveStatus();

      renderRequests(data.requests);

      renderPagination(data.pagination);

      elements.content.hidden = false;
    } catch (error) {
      showMessage(error.message || 'Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  }

  function openModalShell() {
    elements.modal.hidden = false;

    elements.modal.setAttribute('aria-hidden', 'false');

    elements.modalLoading.hidden = false;
    elements.modalContent.hidden = true;

    hideModalError();

    document.body.classList.add('is-admin-modal-open');
  }

  function closeModal() {
    state.selectedRequestId = null;

    elements.modal.hidden = true;

    elements.modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('is-admin-modal-open');
  }

  function setModalValue(element, value) {
    if (!element) {
      return;
    }

    element.textContent =
      value === null || value === undefined || value === ''
        ? '—'
        : String(value);
  }

  function renderModal(request) {
    state.selectedRequestId = request.id;

    setModalValue(elements.modalNumber, `Заявка №${request.id}`);

    setModalValue(elements.modalName, request.name || 'Без имени');

    setModalValue(elements.modalCar, request.car);

    setModalValue(elements.modalYear, request.carYear);

    setModalValue(elements.modalPrice, request.carPrice);

    setModalValue(elements.modalTripDate, request.tripDate);

    setModalValue(elements.modalPage, request.page);

    setModalValue(elements.modalMessage, request.message);

    setModalValue(elements.modalCreated, formatDate(request.createdAt));

    const telephone = normalizeTelephone(request.phone);

    elements.modalPhone.textContent = request.phone || '—';

    if (telephone) {
      elements.modalPhone.href = `tel:${telephone}`;

      elements.modalPhone.removeAttribute('aria-disabled');
    } else {
      elements.modalPhone.href = '#';

      elements.modalPhone.setAttribute('aria-disabled', 'true');
    }

    elements.modalStatus.value = request.status || 'NEW';

    elements.modalLoading.hidden = true;
    elements.modalContent.hidden = false;
  }

  async function openRequest(requestId) {
    openModalShell();

    try {
      const { response, data } = await requestJson(
        `${REQUESTS_URL}/${requestId}`,
      );

      if (response.status === 401) {
        redirectToLogin();

        return;
      }

      if (!response.ok || !data.request) {
        throw new Error(data.message || 'Не удалось загрузить заявку.');
      }

      renderModal(data.request);
    } catch (error) {
      closeModal();

      showMessage(error.message || 'Не удалось открыть заявку.');
    }
  }

  async function updateRequestStatus(forceRefreshToken = false) {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard?.getCsrfToken) {
      throw new Error('Не удалось получить токен безопасности.');
    }

    const csrfToken = await sessionGuard.getCsrfToken(forceRefreshToken);

    return requestJson(`${REQUESTS_URL}/${state.selectedRequestId}/status`, {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },

      body: JSON.stringify({
        status: elements.modalStatus.value,
      }),
    });
  }

  async function saveRequestStatus() {
    if (!state.selectedRequestId) {
      return;
    }

    elements.modalSave.disabled = true;
    hideModalError();

    try {
      let result = await updateRequestStatus(false);

      if (result.response.status === 403) {
        result = await updateRequestStatus(true);
      }

      const { response, data } = result;

      if (response.status === 401) {
        redirectToLogin();

        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось изменить статус.');
      }

      closeModal();

      await loadRequests();
    } catch (error) {
      showModalError(error.message || 'Не удалось изменить статус.');
    } finally {
      elements.modalSave.disabled = false;
    }
  }

  function bindEvents() {
    elements.refresh.addEventListener('click', () => {
      void loadRequests();
    });

    elements.search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);

      state.searchTimer = window.setTimeout(() => {
        state.search = elements.search.value.trim();

        state.page = 1;

        void loadRequests();
      }, 350);
    });

    document.querySelectorAll('[data-requests-status]').forEach((button) => {
      button.addEventListener('click', () => {
        state.status = button.dataset.requestsStatus || 'ALL';

        state.page = 1;

        void loadRequests();
      });
    });

    elements.prevPage.addEventListener('click', () => {
      if (state.page <= 1) {
        return;
      }

      state.page -= 1;

      void loadRequests();
    });

    elements.nextPage.addEventListener('click', () => {
      if (state.page >= state.pages) {
        return;
      }

      state.page += 1;

      void loadRequests();
    });

    elements.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-request-open]');

      if (!button) {
        return;
      }

      void openRequest(button.dataset.requestOpen);
    });

    document
      .querySelectorAll('[data-request-modal-close]')
      .forEach((button) => {
        button.addEventListener('click', closeModal);
      });

    elements.modalSave.addEventListener('click', () => {
      void saveRequestStatus();
    });

    elements.modalPhone.addEventListener('click', (event) => {
      if (elements.modalPhone.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.modal.hidden) {
        closeModal();
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

    await loadRequests();
  }

  void init();
})();

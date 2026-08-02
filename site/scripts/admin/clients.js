(() => {
  const CLIENTS_URL = '/api/admin/clients';

  const statusLabels = {
    NEW: 'Новая',
    IN_PROGRESS: 'В работе',
    CONTACTED: 'Связались',
    COMPLETED: 'Завершена',
  };

  const state = {
    search: '',
    page: 1,
    pages: 1,
    limit: 20,
    total: 0,

    mode: 'edit',
    selectedClientId: null,

    searchTimer: null,
  };

  const elements = {
    refresh: document.querySelector('[data-clients-refresh]'),

    create: document.querySelector('[data-client-create]'),

    message: document.querySelector('[data-clients-message]'),

    search: document.querySelector('[data-clients-search]'),

    loading: document.querySelector('[data-clients-loading]'),

    content: document.querySelector('[data-clients-content]'),

    list: document.querySelector('[data-clients-list]'),

    empty: document.querySelector('[data-clients-empty]'),

    pagination: document.querySelector('[data-clients-pagination]'),

    pageLabel: document.querySelector('[data-clients-page-label]'),

    prevPage: document.querySelector('[data-clients-page="prev"]'),

    nextPage: document.querySelector('[data-clients-page="next"]'),

    modal: document.querySelector('[data-client-modal]'),

    modalLoading: document.querySelector('[data-client-modal-loading]'),

    modalContent: document.querySelector('[data-client-modal-content]'),

    modalNumber: document.querySelector('[data-client-modal-number]'),

    modalTitle: document.querySelector('[data-client-modal-title]'),

    modalCreated: document.querySelector('[data-client-modal-created]'),

    modalLeadsCount: document.querySelector('[data-client-modal-leads-count]'),

    form: document.querySelector('[data-client-form]'),

    name: document.querySelector('[data-client-modal-name]'),

    phone: document.querySelector('[data-client-modal-phone]'),

    comment: document.querySelector('[data-client-modal-comment]'),

    call: document.querySelector('[data-client-modal-call]'),

    save: document.querySelector('[data-client-modal-save]'),

    delete: document.querySelector('[data-client-modal-delete]'),

    editOnly: document.querySelectorAll('[data-client-edit-only]'),

    error: document.querySelector('[data-client-modal-error]'),

    history: document.querySelector('[data-client-modal-history]'),

    historyEmpty: document.querySelector('[data-client-modal-history-empty]'),
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

  function phoneToTel(value) {
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

  function shortText(value, length = 52) {
    const text = String(value || '').trim();

    if (!text) {
      return '—';
    }

    if (text.length <= length) {
      return text;
    }

    return `${text.slice(0, length).trim()}…`;
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
    elements.error.textContent = text;
    elements.error.hidden = false;
  }

  function hideModalError() {
    elements.error.textContent = '';
    elements.error.hidden = true;
  }

  function setEditOnlyVisible(isVisible) {
    elements.editOnly.forEach((element) => {
      element.hidden = !isVisible;
    });
  }

  function resetClientForm() {
    elements.form.reset();

    elements.name.value = '';
    elements.phone.value = '';
    elements.comment.value = '';

    elements.call.href = '#';
    elements.call.setAttribute('aria-disabled', 'true');

    elements.history.innerHTML = '';
    elements.historyEmpty.hidden = true;

    hideModalError();
  }

  function setLoading(isLoading) {
    elements.loading.hidden = !isLoading;
    elements.refresh.disabled = isLoading;

    if (isLoading) {
      elements.content.hidden = true;
    }
  }

  function renderClients(clients = []) {
    if (!Array.isArray(clients) || clients.length === 0) {
      elements.list.innerHTML = '';
      elements.empty.hidden = false;

      return;
    }

    elements.empty.hidden = true;

    elements.list.innerHTML = clients
      .map((client) => {
        const latestLead = Array.isArray(client.leads) ? client.leads[0] : null;

        const telephone = phoneToTel(client.phone);

        const phoneMarkup = telephone
          ? `
            <a href="tel:${escapeHtml(telephone)}">
              ${escapeHtml(client.phone)}
            </a>
          `
          : escapeHtml(client.phone || '—');

        return `
          <tr>
            <td data-label="Клиент">
              <strong class="admin-request-row__name">
                ${escapeHtml(client.name || 'Без имени')}
              </strong>

              <small>Клиент №${escapeHtml(client.id)}</small>
            </td>

            <td data-label="Телефон">
              ${phoneMarkup}
            </td>

            <td data-label="Заявок">
              <span class="admin-client-row__count">
                ${escapeHtml(client._count?.leads || 0)}
              </span>
            </td>

            <td data-label="Последний автомобиль">
              <span class="admin-request-row__car">
                ${escapeHtml(latestLead?.car || '—')}
              </span>
            </td>

            <td data-label="Последняя заявка">
              ${
                latestLead
                  ? `
                    <span
                      class="admin-request-row__status"
                      data-status="${escapeHtml(latestLead.status)}"
                    >
                      ${escapeHtml(
                        statusLabels[latestLead.status] || latestLead.status,
                      )}
                    </span>

                    <small>
                      ${escapeHtml(formatDate(latestLead.createdAt))}
                    </small>
                  `
                  : '—'
              }
            </td>

            <td data-label="Комментарий">
              ${escapeHtml(shortText(client.comment))}
            </td>

            <td data-label="Добавлен">
              <time datetime="${escapeHtml(client.createdAt || '')}">
                ${escapeHtml(formatDate(client.createdAt))}
              </time>
            </td>

            <td data-label="Действия">
              <button
                class="admin-request-row__open"
                type="button"
                data-client-open="${escapeHtml(client.id)}"
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

  async function loadClients() {
    setLoading(true);
    hideMessage();

    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
    });

    if (state.search) {
      params.set('search', state.search);
    }

    try {
      const { response, data } = await requestJson(
        `${CLIENTS_URL}?${params.toString()}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || 'Не удалось загрузить список клиентов.',
        );
      }

      renderClients(data.clients);
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

  function openCreateClient() {
    state.mode = 'create';
    state.selectedClientId = null;

    openModalShell();
    resetClientForm();
    setEditOnlyVisible(false);

    elements.modalLoading.hidden = true;
    elements.modalContent.hidden = false;

    elements.modalNumber.textContent = 'Новый клиент';
    elements.modalTitle.textContent = 'Добавление клиента';

    elements.save.textContent = 'Добавить клиента';
    elements.delete.disabled = false;
    elements.delete.removeAttribute('title');

    window.setTimeout(() => {
      elements.name.focus();
    }, 50);
  }

  function closeModal() {
    state.mode = 'edit';
    state.selectedClientId = null;

    resetClientForm();
    setEditOnlyVisible(true);

    elements.modal.hidden = true;

    elements.modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('is-admin-modal-open');
  }

  function renderHistory(leads = []) {
    if (!Array.isArray(leads) || leads.length === 0) {
      elements.history.innerHTML = '';
      elements.historyEmpty.hidden = false;

      return;
    }

    elements.historyEmpty.hidden = true;

    elements.history.innerHTML = leads
      .map((lead) => {
        return `
          <article class="admin-client-history-card">
            <div class="admin-client-history-card__top">
              <strong>
                Заявка №${escapeHtml(lead.id)}
              </strong>

              <span
                class="admin-request-row__status"
                data-status="${escapeHtml(lead.status)}"
              >
                ${escapeHtml(statusLabels[lead.status] || lead.status)}
              </span>
            </div>

            <div class="admin-client-history-card__grid">
              <div>
                <span>Автомобиль</span>
                <strong>${escapeHtml(lead.car || '—')}</strong>
              </div>

              <div>
                <span>Дата поездки</span>
                <strong>${escapeHtml(lead.tripDate || '—')}</strong>
              </div>

              <div>
                <span>Стоимость</span>
                <strong>${escapeHtml(lead.carPrice || '—')}</strong>
              </div>

              <div>
                <span>Создана</span>
                <strong>${escapeHtml(formatDate(lead.createdAt))}</strong>
              </div>
            </div>

            ${
              lead.message
                ? `
                  <p class="admin-client-history-card__message">
                    ${escapeHtml(lead.message)}
                  </p>
                `
                : ''
            }
          </article>
        `;
      })
      .join('');
  }

  function renderClient(client) {
    state.mode = 'edit';
    state.selectedClientId = client.id;

    setEditOnlyVisible(true);

    elements.save.textContent = 'Сохранить данные';

    elements.modalNumber.textContent = `Клиент №${client.id}`;
    elements.modalTitle.textContent = client.name || 'Клиент RioCar';

    elements.modalCreated.textContent = formatDate(client.createdAt);

    elements.modalLeadsCount.textContent = String(
      Array.isArray(client.leads) ? client.leads.length : 0,
    );

    const leadsCount = Array.isArray(client.leads) ? client.leads.length : 0;

    elements.delete.disabled = leadsCount > 0;

    if (leadsCount > 0) {
      elements.delete.title = 'Нельзя удалить клиента, у которого есть заявки';
    } else {
      elements.delete.removeAttribute('title');
    }

    elements.name.value = client.name || '';
    elements.phone.value = client.phone || '';
    elements.comment.value = client.comment || '';

    const telephone = phoneToTel(client.phone);

    if (telephone) {
      elements.call.href = `tel:${telephone}`;
      elements.call.removeAttribute('aria-disabled');
    } else {
      elements.call.href = '#';
      elements.call.setAttribute('aria-disabled', 'true');
    }

    renderHistory(client.leads);

    elements.modalLoading.hidden = true;
    elements.modalContent.hidden = false;
  }

  async function openClient(clientId) {
    openModalShell();

    try {
      const { response, data } = await requestJson(
        `${CLIENTS_URL}/${clientId}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.client) {
        throw new Error(data.message || 'Не удалось загрузить клиента.');
      }

      renderClient(data.client);
    } catch (error) {
      closeModal();

      showMessage(error.message || 'Не удалось открыть карточку клиента.');
    }
  }

  async function submitClient(forceRefreshToken = false) {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard?.getCsrfToken) {
      throw new Error('Не удалось получить токен безопасности.');
    }

    const csrfToken = await sessionGuard.getCsrfToken(forceRefreshToken);

    const isCreate = state.mode === 'create';

    const url = isCreate
      ? CLIENTS_URL
      : `${CLIENTS_URL}/${state.selectedClientId}`;

    return requestJson(url, {
      method: isCreate ? 'POST' : 'PATCH',

      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },

      body: JSON.stringify({
        name: elements.name.value,
        phone: elements.phone.value,
        comment: elements.comment.value,
      }),
    });
  }

  async function saveClient() {
    const isCreate = state.mode === 'create';

    if (!isCreate && !state.selectedClientId) {
      return;
    }

    elements.save.disabled = true;
    hideModalError();

    try {
      let result = await submitClient(false);

      if (result.response.status === 403) {
        result = await submitClient(true);
      }

      const { response, data } = result;

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            (isCreate
              ? 'Не удалось добавить клиента.'
              : 'Не удалось сохранить клиента.'),
        );
      }

      const clientId = isCreate ? data.client?.id : state.selectedClientId;

      closeModal();

      /*
       * После создания убираем активный поиск,
       * чтобы новый клиент точно появился в списке.
       */
      if (isCreate) {
        state.search = '';
        state.page = 1;
        elements.search.value = '';
      }

      await loadClients();

      if (clientId) {
        await openClient(clientId);
      }
    } catch (error) {
      showModalError(error.message || 'Не удалось сохранить данные клиента.');
    } finally {
      elements.save.disabled = false;
    }
  }

  async function requestClientDeletion(forceRefreshToken = false) {
    const sessionGuard = window.RioCarAdminSession;

    if (!sessionGuard?.getCsrfToken) {
      throw new Error('Не удалось получить токен безопасности.');
    }

    const csrfToken = await sessionGuard.getCsrfToken(forceRefreshToken);

    return requestJson(`${CLIENTS_URL}/${state.selectedClientId}`, {
      method: 'DELETE',

      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
  }

  async function deleteClient() {
    if (state.mode !== 'edit' || !state.selectedClientId) {
      return;
    }

    const clientName = elements.name.value.trim() || 'этого клиента';

    const confirmed = window.confirm(
      `Удалить клиента «${clientName}»?\n\nЭто действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    elements.delete.disabled = true;
    hideModalError();

    try {
      let result = await requestClientDeletion(false);

      if (result.response.status === 403) {
        result = await requestClientDeletion(true);
      }

      const { response, data } = result;

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось удалить клиента.');
      }

      closeModal();

      /*
       * После удаления текущая страница может стать пустой.
       */
      if (state.page > 1 && state.total % state.limit === 1) {
        state.page -= 1;
      }

      await loadClients();
    } catch (error) {
      showModalError(error.message || 'Не удалось удалить клиента.');

      elements.delete.disabled = false;
    }
  }

  function bindEvents() {
    elements.create.addEventListener('click', () => {
      openCreateClient();
    });

    elements.refresh.addEventListener('click', () => {
      void loadClients();
    });

    elements.search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);

      state.searchTimer = window.setTimeout(() => {
        state.search = elements.search.value.trim();
        state.page = 1;

        void loadClients();
      }, 350);
    });

    elements.prevPage.addEventListener('click', () => {
      if (state.page <= 1) {
        return;
      }

      state.page -= 1;

      void loadClients();
    });

    elements.nextPage.addEventListener('click', () => {
      if (state.page >= state.pages) {
        return;
      }

      state.page += 1;

      void loadClients();
    });

    elements.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-client-open]');

      if (!button) {
        return;
      }

      void openClient(button.dataset.clientOpen);
    });

    document.querySelectorAll('[data-client-modal-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });

    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();

      void saveClient();
    });

    elements.delete.addEventListener('click', () => {
      void deleteClient();
    });

    elements.call.addEventListener('click', (event) => {
      if (elements.call.getAttribute('aria-disabled') === 'true') {
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

    await loadClients();
  }

  void init();
})();

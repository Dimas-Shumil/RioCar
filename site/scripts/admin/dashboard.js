(() => {
  const SESSION_URL = '/api/admin/auth/session';
  const CSRF_URL = '/api/admin/auth/csrf';
  const LOGOUT_URL = '/api/admin/auth/logout';
  const DASHBOARD_URL = '/api/admin/dashboard';

  const statusLabels = {
    NEW: 'Новая',
    IN_PROGRESS: 'В работе',
    CONTACTED: 'Связались',
    COMPLETED: 'Завершена',
  };

  let csrfToken = '';

  const loading = document.querySelector('[data-dashboard-loading]');
  const content = document.querySelector('[data-dashboard-content]');
  const message = document.querySelector('[data-dashboard-message]');
  const refreshButton = document.querySelector('[data-dashboard-refresh]');
  const latestList = document.querySelector('[data-dashboard-latest]');
  const emptyState = document.querySelector('[data-dashboard-empty]');
  const logoutButtons = document.querySelectorAll('[data-admin-logout]');

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
    }).format(date);
  }

  function setLoading(isLoading) {
    loading.hidden = !isLoading;
    refreshButton.disabled = isLoading;

    if (isLoading) {
      content.hidden = true;
    }
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.textContent = '';
    message.hidden = true;
  }

  function renderStats(stats = {}) {
    const values = {
      leads: Number(stats.leads) || 0,
      cars: Number(stats.cars) || 0,
      hiddenCars: Number(stats.hiddenCars) || 0,
      activePromotions: Number(stats.activePromotions) || 0,
    };

    Object.entries(values).forEach(([name, value]) => {
      const element = document.querySelector(
        `[data-dashboard-stat="${name}"]`,
      );

      if (element) {
        element.textContent = String(value);
      }
    });
  }

  function renderLatestLeads(leads = []) {
    if (!Array.isArray(leads) || leads.length === 0) {
      latestList.innerHTML = '';
      latestList.hidden = true;
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    latestList.hidden = false;

    latestList.innerHTML = leads
      .map((lead) => {
        const status = statusLabels[lead.status] || 'Без статуса';
        const car = lead.car || 'Автомобиль не указан';
        const tripDate = lead.tripDate || 'Дата не указана';

        return `
          <article class="admin-latest-lead">
            <div class="admin-latest-lead__main">
              <span class="admin-latest-lead__number">
                Заявка №${escapeHtml(lead.id)}
              </span>

              <strong class="admin-latest-lead__name">
                ${escapeHtml(lead.name || 'Без имени')}
              </strong>

              <span class="admin-latest-lead__car">
                ${escapeHtml(car)}
              </span>
            </div>

            <div class="admin-latest-lead__contact">
              <a href="tel:${escapeHtml(lead.phone || '')}">
                ${escapeHtml(lead.phone || 'Телефон не указан')}
              </a>

              <span>${escapeHtml(tripDate)}</span>
            </div>

            <div class="admin-latest-lead__state">
              <span
                class="admin-latest-lead__status"
                data-status="${escapeHtml(lead.status || '')}"
              >
                ${escapeHtml(status)}
              </span>

              <time datetime="${escapeHtml(lead.createdAt || '')}">
                ${escapeHtml(formatDate(lead.createdAt))}
              </time>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function loadDashboard() {
    setLoading(true);
    hideMessage();

    try {
      const { response, data } = await requestJson(DASHBOARD_URL);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось загрузить данные.');
      }

      renderStats(data.stats);
      renderLatestLeads(data.latestLeads);
      content.hidden = false;
    } catch (error) {
      showMessage(
        error.message || 'Ошибка соединения с сервером.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    const { response, data } = await requestJson(SESSION_URL);

    if (!response.ok || !data.authenticated || !data.admin) {
      redirectToLogin();
      return false;
    }

    document.querySelectorAll('[data-admin-login]').forEach((element) => {
      element.textContent = data.admin.login || 'admin';
    });

    return true;
  }

  async function loadCsrfToken() {
    const { response, data } = await requestJson(CSRF_URL, {
      method: 'POST',
    });

    if (!response.ok || typeof data.csrfToken !== 'string') {
      throw new Error('Не удалось получить токен безопасности.');
    }

    csrfToken = data.csrfToken;
    sessionStorage.setItem('riocarAdminCsrfToken', csrfToken);
  }

  function bindLogout() {
    logoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;

        try {
          if (!csrfToken) {
            await loadCsrfToken();
          }

          const { response } = await requestJson(LOGOUT_URL, {
            method: 'POST',
            headers: {
              'X-CSRF-Token': csrfToken,
            },
          });

          if (response.ok || response.status === 401) {
            sessionStorage.removeItem('riocarAdminCsrfToken');
            redirectToLogin();
            return;
          }

          throw new Error('Сервер отклонил выход.');
        } catch (error) {
          showMessage(error.message || 'Не удалось выйти из панели.');
          button.disabled = false;
        }
      });
    });
  }

  async function init() {
    try {
      const authenticated = await loadSession();

      if (!authenticated) {
        return;
      }

      await loadCsrfToken();
      bindLogout();
      await loadDashboard();
    } catch (error) {
      console.error('Ошибка инициализации dashboard:', error);
      redirectToLogin();
    }
  }

  refreshButton.addEventListener('click', loadDashboard);

  init();
})();

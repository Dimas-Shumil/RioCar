(() => {
  const SESSION_URL = '/api/admin/auth/session';
  const CSRF_URL = '/api/admin/auth/csrf';
  const LOGOUT_URL = '/api/admin/auth/logout';
  const HEARTBEAT_URL = '/api/admin/session/heartbeat';

  const HEARTBEAT_INTERVAL_MS = 30 * 1000;
  const CSRF_STORAGE_KEY = 'riocarAdminCsrfToken';

  let csrfToken = sessionStorage.getItem(CSRF_STORAGE_KEY) || '';
  let heartbeatTimer = null;
  let heartbeatInFlight = false;
  let sessionEnding = false;

  function redirectToLogin() {
    window.location.replace('/admin/login');
  }

  function showMessage(text) {
    const message = document.querySelector(
      '[data-dashboard-message]',
    );

    if (!message) {
      return;
    }

    message.textContent = text;
    message.hidden = false;
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

  async function loadSession() {
    const { response, data } = await requestJson(SESSION_URL);

    if (
      !response.ok ||
      !data.authenticated ||
      !data.admin
    ) {
      redirectToLogin();
      return false;
    }

    document
      .querySelectorAll('[data-admin-login]')
      .forEach((element) => {
        element.textContent = data.admin.login || 'admin';
      });

    return true;
  }

  async function loadCsrfToken(forceRefresh = false) {
    if (csrfToken && !forceRefresh) {
      return csrfToken;
    }

    const { response, data } = await requestJson(CSRF_URL, {
      method: 'POST',
    });

    if (response.status === 401) {
      redirectToLogin();
      return '';
    }

    if (
      !response.ok ||
      typeof data.csrfToken !== 'string' ||
      !data.csrfToken
    ) {
      throw new Error('Не удалось получить токен безопасности.');
    }

    csrfToken = data.csrfToken;
    sessionStorage.setItem(CSRF_STORAGE_KEY, csrfToken);

    return csrfToken;
  }

  async function sendHeartbeat(allowCsrfRetry = true) {
    if (
      sessionEnding ||
      heartbeatInFlight ||
      document.visibilityState === 'prerender'
    ) {
      return;
    }

    heartbeatInFlight = true;

    try {
      const token = await loadCsrfToken();

      if (!token) {
        return;
      }

      const response = await fetch(HEARTBEAT_URL, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'X-CSRF-Token': token,
        },
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (response.status === 403 && allowCsrfRetry) {
        csrfToken = '';
        sessionStorage.removeItem(CSRF_STORAGE_KEY);
        await loadCsrfToken(true);
        heartbeatInFlight = false;
        await sendHeartbeat(false);
      }
    } catch (error) {
      // Никаких окон и уведомлений: следующий heartbeat повторит запрос.
      console.debug('RioCar heartbeat временно недоступен:', error);
    } finally {
      heartbeatInFlight = false;
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    void sendHeartbeat();

    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  function setSessionButtonsDisabled(disabled) {
    document
      .querySelectorAll(
        '[data-admin-logout], [data-admin-open-site]',
      )
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  async function endSession(redirectUrl) {
    if (sessionEnding) {
      return;
    }

    sessionEnding = true;
    setSessionButtonsDisabled(true);

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    try {
      const token = await loadCsrfToken();

      const { response, data } = await requestJson(LOGOUT_URL, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token,
        },
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(
          data.message || 'Сервер отклонил завершение сессии.',
        );
      }

      csrfToken = '';
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
      window.location.replace(redirectUrl);
    } catch (error) {
      sessionEnding = false;
      setSessionButtonsDisabled(false);
      startHeartbeat();
      showMessage(
        error.message || 'Не удалось завершить сессию.',
      );
    }
  }

  function bindSessionButtons() {
    document
      .querySelectorAll('[data-admin-logout]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          void endSession('/admin/login');
        });
      });

    document
      .querySelector('[data-admin-open-site]')
      ?.addEventListener('click', () => {
        void endSession('/');
      });
  }

  function bindVisibilityHeartbeat() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    });

    window.addEventListener('online', () => {
      void sendHeartbeat();
    });
  }

  async function init() {
    const authenticated = await loadSession();

    if (!authenticated) {
      return false;
    }

    await loadCsrfToken();
    bindSessionButtons();
    bindVisibilityHeartbeat();
    startHeartbeat();

    return true;
  }

  const ready = init().catch((error) => {
    console.error('Ошибка защиты админ-сессии:', error);
    redirectToLogin();
    return false;
  });

  window.RioCarAdminSession = {
    ready,
    endSession,
    sendHeartbeat,
    getCsrfToken: loadCsrfToken,
  };
})();

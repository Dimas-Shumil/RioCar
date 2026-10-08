(() => {
  const statusElement = document.querySelector('[data-push-status]');
  const enableButton = document.querySelector('[data-push-enable]');
  const disableButton = document.querySelector('[data-push-disable]');
  const testButton = document.querySelector('[data-push-test]');
  const apiBase = '/api/admin/push';

  function supported() {
    return window.isSecureContext && 'serviceWorker' in navigator &&
      'PushManager' in window && 'Notification' in window;
  }

  function info(message, isError = false) {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.dataset.state = isError ? 'error' : 'ok';
  }

  function busy(value) {
    for (const button of [enableButton, disableButton, testButton]) {
      if (button) button.disabled = value;
    }
  }

  function base64ToBytes(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    const decoded = atob(padded);
    return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  }

  async function json(url, options = {}, csrfRefresh = false) {
    const guard = window.RioCarAdminSession;
    const headers = { ...(options.headers || {}) };
    if (options.method && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = await guard.getCsrfToken(csrfRefresh);
    }
    const response = await fetch(url, {
      ...options, headers, credentials: 'same-origin', cache: 'no-store',
    });
    if (response.status === 403 && !csrfRefresh && options.method && options.method !== 'GET') {
      return json(url, options, true);
    }
    if (response.status === 401) {
      location.replace('/admin/login');
      throw new Error('Сессия администратора завершилась.');
    }
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Ошибка сервера.');
    return data;
  }

  async function getRegistration() {
    // Регистрация не требует разрешения и может происходить без нажатия на кнопку.
    return navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  }

  async function refresh() {
    if (!supported()) {
      info('Браузер не поддерживает Web Push. На iPhone откройте приложение с экрана «Домой».', true);
      enableButton?.setAttribute('hidden', '');
      testButton?.setAttribute('hidden', '');
      disableButton?.setAttribute('hidden', '');
      return;
    }
    const status = await json(`${apiBase}/status`);
    if (!status.configured) {
      info('В .env сервера не указаны VAPID-ключи. Уведомления пока отключены.', true);
      enableButton?.setAttribute('hidden', '');
      testButton?.setAttribute('hidden', '');
      disableButton?.setAttribute('hidden', '');
      return;
    }
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    const active = Notification.permission === 'granted' && Boolean(subscription);
    info(active
      ? 'Уведомления на этом устройстве включены. Повторное включение обновит подписку.'
      : Notification.permission === 'denied'
        ? 'Уведомления заблокированы в настройках браузера.'
        : 'Включите уведомления, чтобы получать новые заявки, даже если вкладка закрыта.');
    enableButton?.removeAttribute('hidden');
    if (active) {
      disableButton?.removeAttribute('hidden');
      testButton?.removeAttribute('hidden');
    } else {
      disableButton?.setAttribute('hidden', '');
      testButton?.setAttribute('hidden', '');
    }
  }

  async function enable() {
    if (!supported()) throw new Error('Этот браузер не поддерживает Web Push.');
    // iOS/Safari требуют, чтобы запрос разрешения начинался непосредственно
    // из клика по кнопке, без предварительного сетевого await.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера.');
    const status = await json(`${apiBase}/status`);
    if (!status.configured || !status.publicKey) throw new Error('На сервере нет VAPID-ключей.');
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    const expected = base64ToBytes(status.publicKey);
    const existingKey = subscription?.options?.applicationServerKey;
    if (subscription && existingKey &&
      (existingKey.byteLength !== expected.byteLength ||
        !new Uint8Array(existingKey).every((byte, index) => byte === expected[index]))) {
      // При смене VAPID-ключей браузер требует новую подписку.
      await json(`${apiBase}/subscribe`, {
        method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: expected,
      });
    }
    await json(`${apiBase}/subscribe`, {
      method: 'POST', body: JSON.stringify(subscription.toJSON()),
    });
    info('Уведомления подключены на этом устройстве!');
    await refresh();
  }

  async function disable() {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await json(`${apiBase}/subscribe`, {
        method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    await refresh();
    info('Уведомления отключены на этом устройстве.');
  }

  async function action(fn) {
    busy(true);
    try { await fn(); } catch (error) { info(error.message, true); } finally { busy(false); }
  }

  enableButton?.addEventListener('click', () => action(enable));
  disableButton?.addEventListener('click', () => action(disable));
  testButton?.addEventListener('click', () => action(async () => {
    const result = await json(`${apiBase}/test`, { method: 'POST', body: '{}' });
    info(`Тестовое уведомление отправлено. Устройств: ${result.sent}.`);
  }));

  (async () => {
    if (!await window.RioCarAdminSession?.ready) return;
    try { await refresh(); } catch (error) { info(error.message, true); }
  })();
})();

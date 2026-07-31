const form = document.querySelector('[data-admin-login-form]');
const loginInput = document.querySelector('[data-admin-login]');
const passwordInput = document.querySelector('[data-admin-password]');
const passwordToggle = document.querySelector('[data-password-toggle]');
const passwordToggleText = document.querySelector(
  '[data-password-toggle-text]',
);
const message = document.querySelector('[data-admin-login-message]');
const submitButton = document.querySelector('[data-admin-login-submit]');
const submitText = document.querySelector('[data-admin-login-submit-text]');
const loader = document.querySelector('[data-admin-login-loader]');

function showMessage(text, type = 'error') {
  message.textContent = text;
  message.hidden = false;

  message.classList.toggle('admin-login__message--success', type === 'success');
}

function hideMessage() {
  message.textContent = '';
  message.hidden = true;
  message.classList.remove('admin-login__message--success');
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  loginInput.disabled = isLoading;
  passwordInput.disabled = isLoading;

  loader.hidden = !isLoading;

  submitText.textContent = isLoading ? 'Проверяем данные' : 'Войти в панель';
}

async function checkExistingSession() {
  try {
    const response = await fetch('/api/admin/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (response.ok) {
      window.location.replace('/admin/dashboard');
    }
  } catch {
    // Форма входа останется доступной.
  }
}

passwordToggle.addEventListener('click', () => {
  const passwordIsVisible = passwordInput.type === 'text';

  passwordInput.type = passwordIsVisible ? 'password' : 'text';

  passwordToggle.setAttribute('aria-pressed', String(!passwordIsVisible));

  passwordToggle.setAttribute(
    'aria-label',
    passwordIsVisible ? 'Показать пароль' : 'Скрыть пароль',
  );

  passwordToggleText.textContent = passwordIsVisible ? 'Показать' : 'Скрыть';

  passwordInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();

  const login = loginInput.value.trim();
  const password = passwordInput.value;

  if (login.length < 3) {
    showMessage('Введите корректный логин.');
    loginInput.focus();
    return;
  }

  if (!password) {
    showMessage('Введите пароль.');
    passwordInput.focus();
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      credentials: 'same-origin',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        login,
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось выполнить вход.');
    }

    if (typeof data.csrfToken === 'string') {
      sessionStorage.setItem('riocarAdminCsrfToken', data.csrfToken);
    }

    showMessage('Авторизация выполнена. Открываем панель.', 'success');

    window.setTimeout(() => {
      window.location.replace('/admin/dashboard');
    }, 350);
  } catch (error) {
    passwordInput.value = '';

    showMessage(error.message || 'Ошибка соединения с сервером.');

    passwordInput.focus();
    setLoading(false);
  }
});

checkExistingSession();

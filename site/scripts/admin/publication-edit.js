(() => {
  const PUBLICATIONS_URL = '/api/admin/publications';
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  const state = {
    mode: 'create',
    publicationId: null,
    publication: null,
    slugTouched: false,
    saving: false,
    uploading: false,
  };

  const fields = Object.fromEntries(
    [...document.querySelectorAll('[data-publication-field]')].map(
      (element) => [element.dataset.publicationField, element],
    ),
  );

  const elements = {
    form: document.querySelector('[data-publication-form]'),
    loading: document.querySelector('[data-publication-edit-loading]'),
    message: document.querySelector('[data-publication-edit-message]'),
    eyebrow: document.querySelector('[data-publication-edit-eyebrow]'),
    title: document.querySelector('[data-publication-edit-title]'),
    save: document.querySelector('[data-publication-save]'),
    delete: document.querySelector('[data-publication-delete]'),
    publicLink: document.querySelector('[data-publication-public-link]'),
    coverPreview: document.querySelector('[data-publication-cover-preview]'),
    coverEmpty: document.querySelector('[data-publication-cover-empty]'),
    coverInput: document.querySelector('[data-publication-cover-input]'),
    coverSelect: document.querySelector('[data-publication-cover-select]'),
    coverDelete: document.querySelector('[data-publication-cover-delete]'),
  };

  const transliterationMap = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  function redirectToLogin() {
    window.location.replace('/admin/login');
  }

  function parsePublicationId() {
    const match = window.location.pathname.match(
      /^\/admin\/publications\/(\d+)\/edit\/?$/,
    );

    if (!match) return null;

    const id = Number.parseInt(match[1], 10);
    return Number.isInteger(id) && id > 0 ? id : null;
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

  function slugify(value) {
    const source = String(value || '')
      .trim()
      .toLocaleLowerCase('ru-RU');
    const transliterated = [...source]
      .map((character) => transliterationMap[character] ?? character)
      .join('');

    return transliterated
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  function showMessage(text, success = false) {
    elements.message.textContent = text;
    elements.message.hidden = false;
    elements.message.classList.toggle(
      'admin-publication-edit__message--success',
      success,
    );
    elements.message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
    elements.message.classList.remove(
      'admin-publication-edit__message--success',
    );
  }

  function setLoading(isLoading) {
    elements.loading.hidden = !isLoading;
    elements.form.hidden = isLoading;
  }

  function setSaveState(isSaving) {
    state.saving = isSaving;
    elements.save.disabled = isSaving || state.uploading;
    elements.save.textContent = isSaving
      ? 'Сохраняем…'
      : state.mode === 'create'
        ? 'Создать публикацию'
        : 'Сохранить публикацию';
  }

  function setUploadState(isUploading) {
    state.uploading = isUploading;

    if (elements.coverInput) {
      elements.coverInput.disabled = isUploading;
    }

    if (elements.coverSelect) {
      elements.coverSelect.disabled = isUploading;
    }

    if (elements.coverDelete) {
      elements.coverDelete.disabled =
        isUploading || !state.publication?.coverImage;
    }

    elements.save.disabled = isUploading || state.saving;
  }

  function numberOrZero(element) {
    const number = Number.parseInt(element?.value || '0', 10);
    return Number.isInteger(number) && number >= 0 ? number : 0;
  }

  function dateValueToIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function isoToLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function collectPayload() {
    return {
      title: fields.title.value.trim(),
      slug: fields.slug.value.trim(),
      type: fields.type.value,
      excerpt: fields.excerpt.value.trim(),
      content: fields.content.value.trim(),
      coverAlt: fields.coverAlt.value.trim(),
      isActive: fields.isActive.checked,
      showOnHome: fields.showOnHome.checked,
      isPinned: fields.isPinned.checked,
      sortOrder: numberOrZero(fields.sortOrder),
      publishedAt: dateValueToIso(fields.publishedAt.value),
      startsAt: dateValueToIso(fields.startsAt.value),
      endsAt: dateValueToIso(fields.endsAt.value),
    };
  }

  function setFieldValue(name, value) {
    const element = fields[name];
    if (!element) return;

    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
      return;
    }

    if (element.type === 'datetime-local') {
      element.value = isoToLocalInput(value);
      return;
    }

    element.value = value ?? '';
  }

  function updatePublicLink() {
    const slug = fields.slug.value.trim();

    if (state.mode === 'edit' && slug) {
      elements.publicLink.href = `/publications/${encodeURIComponent(slug)}`;
      elements.publicLink.hidden = false;
    } else {
      elements.publicLink.hidden = true;
      elements.publicLink.href = '#';
    }
  }

  function renderCover() {
    const coverImage = state.publication?.coverImage || '';

    if (coverImage) {
      elements.coverPreview.src = coverImage;
      elements.coverPreview.alt =
        fields.coverAlt.value.trim() || fields.title.value.trim();
      elements.coverEmpty.hidden = true;
      elements.coverDelete.hidden = false;
    } else {
      elements.coverPreview.src = '/site/image/black-lexus.webp';
      elements.coverPreview.alt = '';
      elements.coverEmpty.hidden = false;
      elements.coverDelete.hidden = true;
    }
  }

  function configureMode() {
    state.publicationId = parsePublicationId();
    state.mode = state.publicationId ? 'edit' : 'create';

    if (state.mode === 'create') {
      elements.eyebrow.textContent = 'Новая публикация';
      elements.title.textContent = 'Добавление публикации';
      elements.delete.hidden = true;
      elements.coverInput.disabled = false;
      elements.coverSelect.disabled = false;
      elements.coverDelete.hidden = true;
      setSaveState(false);
      renderCover();
    }
  }

  function fillPublication(publication) {
    state.publication = publication;
    state.slugTouched = true;

    setFieldValue('title', publication.title);
    setFieldValue('slug', publication.slug);
    setFieldValue('type', publication.type);
    setFieldValue('excerpt', publication.excerpt);
    setFieldValue('content', publication.content);
    setFieldValue('coverAlt', publication.coverAlt);
    setFieldValue('isActive', publication.isActive);
    setFieldValue('showOnHome', publication.showOnHome);
    setFieldValue('isPinned', publication.isPinned);
    setFieldValue('sortOrder', publication.sortOrder || 0);
    setFieldValue('publishedAt', publication.publishedAt);
    setFieldValue('startsAt', publication.startsAt);
    setFieldValue('endsAt', publication.endsAt);

    elements.eyebrow.textContent = `Публикация №${publication.id}`;
    elements.title.textContent =
      publication.title || 'Редактирование публикации';
    elements.delete.hidden = false;
    elements.coverInput.disabled = false;
    elements.coverSelect.disabled = false;

    updatePublicLink();
    renderCover();
    setSaveState(false);
  }

  async function loadPublication() {
    if (state.mode === 'create') {
      setLoading(false);
      elements.form.hidden = false;
      return;
    }

    setLoading(true);

    try {
      const { response, data } = await requestJson(
        `${PUBLICATIONS_URL}/${state.publicationId}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.publication) {
        throw new Error(data.message || 'Не удалось загрузить публикацию.');
      }

      fillPublication(data.publication);
      setLoading(false);
    } catch (error) {
      elements.loading.textContent = error.message || 'Публикация не найдена.';
      showMessage(error.message || 'Не удалось загрузить публикацию.');
    }
  }

  async function savePublication() {
    if (state.saving || state.uploading) return;

    hideMessage();

    if (!fields.title.value.trim()) {
      showMessage('Введите заголовок публикации.');
      fields.title.focus();
      return;
    }

    if (fields.content.value.trim().length < 10) {
      showMessage('Добавьте описание публикации.');
      fields.content.focus();
      return;
    }

    setSaveState(true);

    try {
      const isCreate = state.mode === 'create';
      const url = isCreate
        ? PUBLICATIONS_URL
        : `${PUBLICATIONS_URL}/${state.publicationId}`;

      const { response, data } = await requestWithCsrf(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload()),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.publication) {
        throw new Error(data.message || 'Не удалось сохранить публикацию.');
      }

      if (isCreate) {
        window.location.replace(
          `/admin/publications/${data.publication.id}/edit?created=1`,
        );
        return;
      }

      fillPublication(data.publication);
      showMessage(data.message || 'Публикация сохранена.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось сохранить публикацию.');
    } finally {
      setSaveState(false);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () =>
        reject(new Error('Не удалось прочитать изображение.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadCover(file) {
    if (state.uploading) {
      return;
    }

    if (state.mode !== 'edit' || !state.publicationId) {
      showMessage('Сначала сохрани публикацию, затем загрузи изображение.');

      elements.coverInput.value = '';
      return;
    }

    if (!SUPPORTED_TYPES.has(file.type)) {
      showMessage('Разрешены изображения JPG, PNG и WebP.');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      showMessage('Размер изображения должен быть не больше 8 МБ.');
      return;
    }

    hideMessage();
    setUploadState(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { response, data } = await requestWithCsrf(
        `${PUBLICATIONS_URL}/${state.publicationId}/cover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            coverAlt: fields.coverAlt.value.trim(),
          }),
        },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.publication) {
        throw new Error(data.message || 'Не удалось загрузить обложку.');
      }

      fillPublication(data.publication);
      showMessage(data.message || 'Обложка загружена.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось загрузить обложку.');
    } finally {
      elements.coverInput.value = '';
      setUploadState(false);
    }
  }

  async function deleteCover() {
    if (state.uploading) {
      return;
    }

    if (state.mode !== 'edit' || !state.publicationId) {
      showMessage('Не удалось определить публикацию для удаления обложки.');
      return;
    }

    if (!state.publication?.coverImage) {
      showMessage('У этой публикации сейчас нет загруженной обложки.');
      return;
    }

    if (!window.confirm('Удалить обложку публикации?')) return;

    setUploadState(true);
    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${PUBLICATIONS_URL}/${state.publicationId}/cover`,
        { method: 'DELETE' },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.publication) {
        throw new Error(data.message || 'Не удалось удалить обложку.');
      }

      fillPublication(data.publication);
      showMessage(data.message || 'Обложка удалена.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось удалить обложку.');
    } finally {
      setUploadState(false);
    }
  }

  async function deletePublication() {
    if (state.mode !== 'edit' || !state.publicationId) return;

    const confirmed = window.confirm(
      `Удалить публикацию «${fields.title.value.trim() || 'Без заголовка'}»? Это действие нельзя отменить.`,
    );

    if (!confirmed) return;

    elements.delete.disabled = true;
    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${PUBLICATIONS_URL}/${state.publicationId}`,
        { method: 'DELETE' },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось удалить публикацию.');
      }

      window.location.replace('/admin/publications');
    } catch (error) {
      showMessage(error.message || 'Не удалось удалить публикацию.');
      elements.delete.disabled = false;
    }
  }

  function bindEvents() {
    elements.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void savePublication();
    });

    fields.title?.addEventListener('input', () => {
      if (!state.slugTouched) {
        fields.slug.value = slugify(fields.title.value);
        updatePublicLink();
      }
    });

    fields.slug?.addEventListener('input', () => {
      state.slugTouched = fields.slug.value.trim().length > 0;
      updatePublicLink();
    });

    fields.coverAlt?.addEventListener('input', renderCover);

    elements.coverSelect?.addEventListener('click', (event) => {
      event.preventDefault();

      if (state.uploading) {
        return;
      }

      elements.coverInput.value = '';
      elements.coverInput.click();
    });

    elements.coverInput?.addEventListener('change', () => {
      const file = elements.coverInput.files?.[0];

      if (!file) {
        return;
      }

      void uploadCover(file);
    });

    elements.coverDelete?.addEventListener('click', (event) => {
      event.preventDefault();
      void deleteCover();
    });

    elements.delete?.addEventListener('click', () => {
      void deletePublication();
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

    configureMode();
    bindEvents();
    await loadPublication();

    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      showMessage('Публикация создана. Теперь можно загрузить обложку.', true);
    }
  }

  void init();
})();

(() => {
  const CARS_URL = '/api/admin/cars';
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  const state = {
    mode: 'create',
    carId: null,
    car: null,
    images: [],
    slugTouched: false,
    saving: false,
    uploading: false,
  };

  const fields = Object.fromEntries(
    [...document.querySelectorAll('[data-car-field]')].map((element) => [
      element.dataset.carField,
      element,
    ]),
  );

  const elements = {
    form: document.querySelector('[data-car-form]'),
    loading: document.querySelector('[data-car-edit-loading]'),
    message: document.querySelector('[data-car-edit-message]'),
    eyebrow: document.querySelector('[data-car-edit-eyebrow]'),
    title: document.querySelector('[data-car-edit-title]'),
    save: document.querySelector('[data-car-save]'),
    delete: document.querySelector('[data-car-delete]'),
    publicLink: document.querySelector('[data-car-public-link]'),
    imagesSection: document.querySelector('[data-car-images-section]'),
    uploadLabel: document.querySelector('[data-car-upload-label]'),
    imagesInput: document.querySelector('[data-car-images-input]'),
    imagesHint: document.querySelector('[data-car-images-hint]'),
    imagesProgress: document.querySelector('[data-car-images-progress]'),
    imagesList: document.querySelector('[data-car-images-list]'),
    imagesEmpty: document.querySelector('[data-car-images-empty]'),
  };

  const transliterationMap = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
  };

  function redirectToLogin() {
    window.location.replace('/admin/login');
  }

  function parseCarId() {
    const match = window.location.pathname.match(/^\/admin\/cars\/(\d+)\/edit\/?$/);

    if (!match) {
      return null;
    }

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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function slugify(value) {
    const source = String(value || '').trim().toLocaleLowerCase('ru-RU');

    const transliterated = [...source]
      .map((character) => transliterationMap[character] ?? character)
      .join('');

    return transliterated
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }

  function showMessage(text, success = false) {
    elements.message.textContent = text;
    elements.message.hidden = false;
    elements.message.classList.toggle('admin-car-edit__message--success', success);
    elements.message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
    elements.message.classList.remove('admin-car-edit__message--success');
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
        ? 'Создать автомобиль'
        : 'Сохранить автомобиль';
  }

  function numberOrNull(element) {
    const value = element?.value?.trim();

    if (!value) {
      return null;
    }

    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) ? number : null;
  }

  function collectPayload() {
    return {
      title: fields.title.value.trim(),
      slug: fields.slug.value.trim(),
      category: fields.category.value,
      year: numberOrNull(fields.year),
      engine: fields.engine.value.trim(),
      mileage: fields.mileage.value.trim(),
      drive: fields.drive.value.trim(),
      gearbox: fields.gearbox.value.trim(),
      fuel: fields.fuel.value.trim(),
      bodyType: fields.bodyType.value.trim(),
      seats: numberOrNull(fields.seats),
      complectation: fields.complectation.value.trim(),
      rentalTerms: fields.rentalTerms.value.trim(),
      description: fields.description.value.trim(),
      features: fields.features.value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      minRentalDays: numberOrNull(fields.minRentalDays) || 1,
      pricePerDay: numberOrNull(fields.pricePerDay),
      deposit: numberOrNull(fields.deposit),
      isActive: fields.isActive.checked,
      sortOrder: numberOrNull(fields.sortOrder) || 0,
    };
  }

  function setFieldValue(name, value) {
    const element = fields[name];

    if (!element) {
      return;
    }

    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
      return;
    }

    element.value = value ?? '';
  }

  function updatePublicLink() {
    const slug = fields.slug.value.trim();

    if (state.mode === 'edit' && slug) {
      elements.publicLink.href = `/car/${encodeURIComponent(slug)}`;
      elements.publicLink.hidden = false;
    } else {
      elements.publicLink.hidden = true;
      elements.publicLink.href = '#';
    }
  }

  function configureMode() {
    state.carId = parseCarId();
    state.mode = state.carId ? 'edit' : 'create';

    if (state.mode === 'create') {
      elements.eyebrow.textContent = 'Новый автомобиль';
      elements.title.textContent = 'Добавление автомобиля';
      elements.delete.hidden = true;
      elements.uploadLabel.setAttribute('aria-disabled', 'true');
      elements.imagesInput.disabled = true;
      elements.imagesHint.hidden = false;
      elements.imagesEmpty.hidden = true;
      setSaveState(false);
    }
  }

  function fillCar(car) {
    state.car = car;
    state.images = Array.isArray(car.images) ? [...car.images] : [];
    state.slugTouched = true;

    setFieldValue('title', car.title);
    setFieldValue('slug', car.slug);
    setFieldValue('category', car.category);
    setFieldValue('year', car.year);
    setFieldValue('engine', car.engine);
    setFieldValue('mileage', car.mileage);
    setFieldValue('drive', car.drive);
    setFieldValue('gearbox', car.gearbox);
    setFieldValue('fuel', car.fuel);
    setFieldValue('bodyType', car.bodyType);
    setFieldValue('seats', car.seats);
    setFieldValue('complectation', car.complectation);
    setFieldValue('rentalTerms', car.rentalTerms);
    setFieldValue('description', car.description);
    setFieldValue('features', Array.isArray(car.features) ? car.features.join('\n') : '');
    setFieldValue('minRentalDays', car.minRentalDays || 1);
    setFieldValue('pricePerDay', car.pricePerDay);
    setFieldValue('deposit', car.deposit);
    setFieldValue('isActive', car.isActive);
    setFieldValue('sortOrder', car.sortOrder || 0);

    elements.eyebrow.textContent = `Автомобиль №${car.id}`;
    elements.title.textContent = car.title || 'Редактирование автомобиля';
    elements.delete.hidden = false;
    elements.uploadLabel.removeAttribute('aria-disabled');
    elements.imagesInput.disabled = false;
    elements.imagesHint.hidden = true;

    updatePublicLink();
    renderImages();
    setSaveState(false);
  }

  async function loadCar() {
    if (state.mode === 'create') {
      setLoading(false);
      elements.form.hidden = false;
      return;
    }

    setLoading(true);

    try {
      const { response, data } = await requestJson(`${CARS_URL}/${state.carId}`);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.car) {
        throw new Error(data.message || 'Не удалось загрузить автомобиль.');
      }

      fillCar(data.car);
      setLoading(false);
    } catch (error) {
      elements.loading.textContent = error.message || 'Автомобиль не найден.';
      showMessage(error.message || 'Не удалось загрузить автомобиль.');
    }
  }

  async function saveCar() {
    if (state.saving || state.uploading) {
      return;
    }

    hideMessage();

    if (!fields.title.value.trim()) {
      showMessage('Введите название автомобиля.');
      fields.title.focus();
      return;
    }

    if (!fields.category.value) {
      showMessage('Выберите класс автомобиля.');
      fields.category.focus();
      return;
    }

    setSaveState(true);

    try {
      const isCreate = state.mode === 'create';
      const url = isCreate ? CARS_URL : `${CARS_URL}/${state.carId}`;

      const { response, data } = await requestWithCsrf(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload()),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data.car) {
        throw new Error(data.message || 'Не удалось сохранить автомобиль.');
      }

      if (isCreate) {
        window.location.replace(`/admin/cars/${data.car.id}/edit?created=1`);
        return;
      }

      fillCar(data.car);
      showMessage(data.message || 'Автомобиль сохранён.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось сохранить автомобиль.');
    } finally {
      setSaveState(false);
    }
  }

  async function deleteCar() {
    if (state.mode !== 'edit' || !state.carId) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить автомобиль «${fields.title.value.trim() || 'Без названия'}»? Это действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    elements.delete.disabled = true;
    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${CARS_URL}/${state.carId}`,
        { method: 'DELETE' },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось удалить автомобиль.');
      }

      window.location.replace('/admin/cars');
    } catch (error) {
      showMessage(error.message || 'Не удалось удалить автомобиль.');
      elements.delete.disabled = false;
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      });

      reader.addEventListener('error', () => {
        reject(new Error(`Не удалось прочитать файл ${file.name}.`));
      });

      reader.readAsDataURL(file);
    });
  }

  function setUploadState(isUploading, text = '') {
    state.uploading = isUploading;
    elements.imagesInput.disabled = isUploading || state.mode === 'create';
    elements.uploadLabel.classList.toggle('is-disabled', isUploading);
    elements.imagesProgress.hidden = !text;
    elements.imagesProgress.textContent = text;
    elements.save.disabled = isUploading || state.saving;
  }

  async function uploadImages(files) {
    if (state.mode !== 'edit' || !state.carId || state.uploading) {
      return;
    }

    const selectedFiles = [...files];

    if (!selectedFiles.length) {
      return;
    }

    if (state.images.length + selectedFiles.length > 12) {
      showMessage('Для одного автомобиля можно загрузить не более 12 фотографий.');
      elements.imagesInput.value = '';
      return;
    }

    for (const file of selectedFiles) {
      if (!SUPPORTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
        showMessage(`Файл «${file.name}» не подходит. Нужен JPG, PNG или WebP до 8 МБ.`);
        elements.imagesInput.value = '';
        return;
      }
    }

    hideMessage();
    setUploadState(true, `Загрузка 1 из ${selectedFiles.length}…`);

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setUploadState(true, `Загрузка ${index + 1} из ${selectedFiles.length}: ${file.name}`);

        const dataBase64 = await readFileAsBase64(file);
        const { response, data } = await requestWithCsrf(
          `${CARS_URL}/${state.carId}/images`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              dataBase64,
              alt: fields.title.value.trim(),
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !data.image) {
          throw new Error(data.message || `Не удалось загрузить ${file.name}.`);
        }

        state.images.push(data.image);
      }

      renderImages();
      showMessage('Фотографии загружены.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось загрузить фотографии.');
    } finally {
      elements.imagesInput.value = '';
      setUploadState(false, '');
    }
  }

  function renderImages() {
    state.images.sort((first, second) => {
      if (first.isPrimary !== second.isPrimary) {
        return first.isPrimary ? -1 : 1;
      }

      if (first.sortOrder !== second.sortOrder) {
        return first.sortOrder - second.sortOrder;
      }

      return first.id - second.id;
    });

    if (!state.images.length) {
      elements.imagesList.innerHTML = '';
      elements.imagesEmpty.hidden = state.mode === 'create';
      return;
    }

    elements.imagesEmpty.hidden = true;

    elements.imagesList.innerHTML = state.images
      .map((image, index) => `
        <article class="admin-car-image" data-image-card="${escapeHtml(image.id)}">
          <div class="admin-car-image__preview">
            <img src="${escapeHtml(image.imagePath)}" alt="" loading="lazy" />
            ${image.isPrimary ? '<span>Главная</span>' : ''}
          </div>

          <div class="admin-car-image__body">
            <label>
              <span>Описание фотографии</span>
              <input
                type="text"
                maxlength="160"
                value="${escapeHtml(image.alt || '')}"
                data-image-alt="${escapeHtml(image.id)}"
              />
            </label>

            <div class="admin-car-image__actions">
              <button
                type="button"
                data-image-primary="${escapeHtml(image.id)}"
                ${image.isPrimary ? 'disabled' : ''}
              >
                ${image.isPrimary ? 'Главная фотография' : 'Сделать главной'}
              </button>

              <button
                type="button"
                data-image-move="up"
                data-image-id="${escapeHtml(image.id)}"
                ${index === 0 || state.images[index - 1]?.isPrimary ? 'disabled' : ''}
                aria-label="Переместить фотографию выше"
              >
                ↑
              </button>

              <button
                type="button"
                data-image-move="down"
                data-image-id="${escapeHtml(image.id)}"
                ${image.isPrimary || index === state.images.length - 1 ? 'disabled' : ''}
                aria-label="Переместить фотографию ниже"
              >
                ↓
              </button>

              <button
                class="admin-car-image__delete"
                type="button"
                data-image-delete="${escapeHtml(image.id)}"
              >
                Удалить
              </button>
            </div>
          </div>
        </article>
      `)
      .join('');
  }

  async function updateImage(imageId, payload) {
    const { response, data } = await requestWithCsrf(
      `${CARS_URL}/${state.carId}/images/${imageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (response.status === 401) {
      redirectToLogin();
      return null;
    }

    if (!response.ok || !data.image) {
      throw new Error(data.message || 'Не удалось обновить фотографию.');
    }

    return data.image;
  }

  async function makeImagePrimary(imageId) {
    hideMessage();

    try {
      const image = await updateImage(imageId, { isPrimary: true });

      if (!image) {
        return;
      }

      state.images = state.images.map((item) => ({
        ...item,
        isPrimary: item.id === imageId,
      }));

      renderImages();
      showMessage('Главная фотография изменена.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось изменить главную фотографию.');
    }
  }

  async function saveImageAlt(input) {
    const imageId = Number.parseInt(input.dataset.imageAlt, 10);

    if (!Number.isInteger(imageId)) {
      return;
    }

    try {
      const image = await updateImage(imageId, { alt: input.value.trim() });

      if (image) {
        state.images = state.images.map((item) =>
          item.id === imageId ? { ...item, alt: image.alt } : item,
        );
      }
    } catch (error) {
      showMessage(error.message || 'Не удалось сохранить описание фотографии.');
    }
  }

  async function saveImageOrder() {
    const { response, data } = await requestWithCsrf(
      `${CARS_URL}/${state.carId}/images/order`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds: state.images.map((image) => image.id) }),
      },
    );

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось сохранить порядок фотографий.');
    }
  }

  async function moveImage(imageId, direction) {
    const index = state.images.findIndex((image) => image.id === imageId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= state.images.length) {
      return;
    }

    const previousImages = [...state.images];
    [state.images[index], state.images[targetIndex]] = [
      state.images[targetIndex],
      state.images[index],
    ];

    state.images = state.images.map((image, order) => ({
      ...image,
      sortOrder: order,
    }));

    renderImages();

    try {
      await saveImageOrder();
    } catch (error) {
      state.images = previousImages;
      renderImages();
      showMessage(error.message || 'Не удалось изменить порядок фотографий.');
    }
  }

  async function deleteImage(imageId) {
    const image = state.images.find((item) => item.id === imageId);

    if (!image || !window.confirm('Удалить эту фотографию?')) {
      return;
    }

    hideMessage();

    try {
      const { response, data } = await requestWithCsrf(
        `${CARS_URL}/${state.carId}/images/${imageId}`,
        { method: 'DELETE' },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось удалить фотографию.');
      }

      state.images = state.images.filter((item) => item.id !== imageId);

      if (image.isPrimary && state.images.length) {
        state.images[0].isPrimary = true;
      }

      renderImages();
      showMessage('Фотография удалена.', true);
    } catch (error) {
      showMessage(error.message || 'Не удалось удалить фотографию.');
    }
  }

  function bindEvents() {
    elements.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void saveCar();
    });

    fields.title?.addEventListener('input', () => {
      if (!state.slugTouched) {
        fields.slug.value = slugify(fields.title.value);
        updatePublicLink();
      }
    });

    fields.slug?.addEventListener('input', () => {
      state.slugTouched = Boolean(fields.slug.value.trim());
      fields.slug.value = slugify(fields.slug.value);
      updatePublicLink();
    });

    elements.delete?.addEventListener('click', () => {
      void deleteCar();
    });

    elements.imagesInput?.addEventListener('change', () => {
      void uploadImages(elements.imagesInput.files);
    });

    elements.imagesList?.addEventListener('click', (event) => {
      const primaryButton = event.target.closest('[data-image-primary]');
      const moveButton = event.target.closest('[data-image-move]');
      const deleteButton = event.target.closest('[data-image-delete]');

      if (primaryButton) {
        void makeImagePrimary(Number.parseInt(primaryButton.dataset.imagePrimary, 10));
        return;
      }

      if (moveButton) {
        void moveImage(
          Number.parseInt(moveButton.dataset.imageId, 10),
          moveButton.dataset.imageMove,
        );
        return;
      }

      if (deleteButton) {
        void deleteImage(Number.parseInt(deleteButton.dataset.imageDelete, 10));
      }
    });

    elements.imagesList?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-image-alt]');

      if (input) {
        void saveImageAlt(input);
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

    configureMode();
    bindEvents();
    await loadCar();

    if (new URLSearchParams(window.location.search).get('created') === '1') {
      showMessage('Автомобиль создан. Теперь можно загрузить фотографии.', true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  void init();
})();

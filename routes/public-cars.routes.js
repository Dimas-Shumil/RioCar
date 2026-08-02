import { Router } from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import prisma from '../lib/prisma.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, 'components');

const headerComponent = readFileSync(
  path.join(COMPONENTS_DIR, 'header.html'),
  'utf8',
);

const footerComponent = readFileSync(
  path.join(COMPONENTS_DIR, 'footer.html'),
  'utf8',
);

const carsTemplate = readFileSync(path.join(PUBLIC_DIR, 'cars.html'), 'utf8');

const carTemplate = readFileSync(path.join(PUBLIC_DIR, 'car.html'), 'utf8');

const categoryLabels = {
  ECONOM: 'Эконом',
  COMFORT: 'Комфорт',
  PREMIUM: 'Премиум',
};

const categorySlugs = {
  ECONOM: 'econom',
  COMFORT: 'comfort',
  PREMIUM: 'premium',
};

const SITE_URL = String(
  process.env.SITE_URL || 'https://riocar-abakan.ru',
).replace(/\/+$/, '');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function replaceAll(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.split(token).join(String(value)),
    template,
  );
}

function prepareNestedComponent(component) {
  return component
    .replace(/src=(['"])site\//g, 'src=$1/site/')
    .replace(/\/site\/image\/Logo\.png/gi, '/site/image/logo.png');
}

function prepareCarHeader(component) {
  return prepareNestedComponent(component)
    .replaceAll('href="/index.html"', 'href="/"')
    .replaceAll('href="/index.html#reviews"', 'href="/#reviews"')
    .replaceAll('href="/index.html#contacts"', 'href="/#contacts"')
    .replaceAll('href="/index.html#form"', 'href="#booking"')
    .replaceAll('href="/#form"', 'href="#booking"');
}

function prepareCarFooter(component) {
  return prepareNestedComponent(component)
    .replaceAll('href="/index.html"', 'href="/"')
    .replaceAll('href="/index.html#reviews"', 'href="/#reviews"')
    .replaceAll('href="/index.html#contacts"', 'href="/#contacts"')
    .replaceAll('href="/index.html#form"', 'href="#booking"')
    .replaceAll('href="/#form"', 'href="#booking"')
    .replaceAll('href="#form"', 'href="#booking"');
}

const nestedHeaderComponent = prepareCarHeader(headerComponent);
const nestedFooterComponent = prepareCarFooter(footerComponent);

function withComponents(template, { nestedPage = false } = {}) {
  return template
    .replace(
      '<!-- HEADER_COMPONENT -->',
      nestedPage ? nestedHeaderComponent : headerComponent,
    )
    .replace(
      '<!-- FOOTER_COMPONENT -->',
      nestedPage ? nestedFooterComponent : footerComponent,
    );
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 'По запросу';
  }

  return new Intl.NumberFormat('ru-RU').format(number);
}

function parseFeatures(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  } catch {
    // Старые записи могли хранить обычную строку.
  }

  return String(value || '')
    .split(/[,+;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getImages(car) {
  const images = Array.isArray(car.images) ? car.images : [];

  return [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return a.sortOrder - b.sortOrder;
  });
}

function getPrimaryImage(car) {
  return getImages(car)[0]?.imagePath || '/site/image/black-lexus.webp';
}

function getCategoryLabel(category) {
  return categoryLabels[category] || 'Автомобиль';
}

function getCategorySlug(category) {
  return categorySlugs[category] || 'all';
}

function renderCatalogCard(car) {
  const image = getPrimaryImage(car);
  const category = getCategoryLabel(car.category);
  const categorySlug = getCategorySlug(car.category);
  const engineShort = String(car.engine || 'Характеристики по запросу')
    .split('/')[0]
    .trim();

  return `
    <a
      class="cars-card"
      role="listitem"
      target="_blank"
      rel="noopener"
      href="/car/${encodeURIComponent(car.slug)}"
      data-category="${escapeHtml(categorySlug)}"
      aria-label="Открыть страницу автомобиля ${escapeHtml(car.title)}"
    >
      <div class="cars-card__image">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(car.title)} для аренды в Абакане"
          loading="lazy"
          decoding="async"
        />
        <span class="cars-card__badge">${escapeHtml(category)}</span>
      </div>

      <div class="cars-card__content">
        <h3 class="cars-card__title">${escapeHtml(car.title)}</h3>

        <div class="cars-card__meta">
          <div class="cars-card__meta-item">
            <span class="cars-card__dot" aria-hidden="true"></span>
            <span>${escapeHtml(car.year || 'Год по запросу')}</span>
          </div>

          <div class="cars-card__meta-item">
            <span class="cars-card__dot" aria-hidden="true"></span>
            <span>${escapeHtml(engineShort)}</span>
          </div>
        </div>

        <div class="cars-card__bottom">
          <div class="cars-card__price">
            ${car.pricePerDay ? `от ${escapeHtml(formatMoney(car.pricePerDay))} ₽` : 'Цена по запросу'}
          </div>
          <span class="cars-card__arrow" aria-hidden="true">›</span>
        </div>
      </div>
    </a>
  `;
}

function renderCatalogPage(cars) {
  const catalogMarkup = cars.length
    ? cars.map(renderCatalogCard).join('')
    : `
      <div class="cars-empty">
        <strong>Автомобили временно недоступны</strong>
        <span>Позвоните нам — менеджер подберёт подходящий вариант.</span>
      </div>
    `;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Автопарк RioCar',
    itemListElement: cars.map((car, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}/car/${car.slug}`,
      item: {
        '@type': 'Product',
        name: car.title,
        image: `${SITE_URL}${getPrimaryImage(car)}`,
        description: car.description || `Аренда ${car.title} в Абакане`,
        offers: car.pricePerDay
          ? {
              '@type': 'Offer',
              priceCurrency: 'RUB',
              price: car.pricePerDay,
              availability: 'https://schema.org/InStock',
              url: `${SITE_URL}/car/${car.slug}`,
            }
          : undefined,
      },
    })),
  };

  return replaceAll(withComponents(carsTemplate), {
    '<!-- CARS_CATALOG -->': catalogMarkup,
    '{{CARS_JSON_LD}}': escapeJsonForHtml(itemList),
  });
}

function iconSvg(type) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';

  const icons = {
    calendar: `<svg ${common}><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>`,
    engine: `<svg ${common}><path d="M7 8h9l3 3v6h-3l-2 2H8l-2-2H3v-6h3l1-3Z"></path><path d="M9 5h5M11.5 5v3M19 12h2v4h-2"></path></svg>`,
    road: `<svg ${common}><path d="M9 3 6 21M15 3l3 18M12 6v3M12 12v3M12 18v3"></path></svg>`,
    gearbox: `<svg ${common}><circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="19" r="2"></circle><circle cx="18" cy="19" r="2"></circle><path d="M6 7v10M18 7v10M6 12h12M12 12V5"></path></svg>`,
    fuel: `<svg ${common}><path d="M5 3h10v18H5z"></path><path d="M8 7h4M15 8h2l2 3v7a2 2 0 0 0 2 2V9l-2-2"></path></svg>`,
    drive: `<svg ${common}><circle cx="6" cy="6" r="2"></circle><circle cx="18" cy="6" r="2"></circle><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle><path d="M8 6h8M6 8v8M18 8v8M8 18h8M12 6v12"></path></svg>`,
    body: `<svg ${common}><path d="m4 15 2-5h12l2 5"></path><path d="M3 15h18v4H3z"></path><circle cx="7" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle></svg>`,
    seats: `<svg ${common}><circle cx="9" cy="6" r="3"></circle><path d="M5 21v-6a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v6M15 10h2a3 3 0 0 1 3 3v8"></path></svg>`,
  };

  return icons[type] || icons.road;
}

function renderSpec(icon, label, value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return `
    <div class="car-spec">
      <span class="car-spec__icon">${iconSvg(icon)}</span>
      <div>
        <span class="car-spec__label">${escapeHtml(label)}</span>
        <strong class="car-spec__value">${escapeHtml(value)}</strong>
      </div>
    </div>
  `;
}

function renderFeature(feature) {
  return `
    <li>
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(feature)}</strong>
    </li>
  `;
}

function renderGallery(car) {
  const images = getImages(car);
  const safeImages = images.length
    ? images
    : [
        {
          imagePath: '/site/image/black-lexus.webp',
          alt: car.title,
        },
      ];

  const mainImage = safeImages[0];
  const arrows =
    safeImages.length > 1
      ? `
      <button class="car-gallery__arrow car-gallery__arrow--prev" type="button" data-gallery-prev aria-label="Предыдущее фото">‹</button>
      <button class="car-gallery__arrow car-gallery__arrow--next" type="button" data-gallery-next aria-label="Следующее фото">›</button>
    `
      : '';

  const thumbs = safeImages
    .map(
      (image, index) => `
        <button
          class="car-gallery__thumb${index === 0 ? ' is-active' : ''}"
          type="button"
          data-gallery-thumb="${index}"
          data-gallery-src="${escapeHtml(image.imagePath)}"
          data-gallery-alt="${escapeHtml(image.alt || car.title)}"
          aria-label="Открыть фото ${index + 1}"
          aria-pressed="${index === 0 ? 'true' : 'false'}"
        >
          <img
            src="${escapeHtml(image.imagePath)}"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </button>
      `,
    )
    .join('');

  return `
    <div class="car-gallery" data-car-gallery>
      <div class="car-gallery__stage">
        <img
          src="${escapeHtml(mainImage.imagePath)}"
          alt="${escapeHtml(mainImage.alt || car.title)}"
          data-gallery-main
        />
        <div class="car-gallery__shade" aria-hidden="true"></div>
        ${arrows}
      </div>
      <div class="car-gallery__thumbs" data-gallery-thumbs>${thumbs}</div>
    </div>
  `;
}

function renderRelatedCard(car) {
  return `
    <a class="car-related-card" href="/car/${encodeURIComponent(car.slug)}">
      <div class="car-related-card__image">
        <img
          src="${escapeHtml(getPrimaryImage(car))}"
          alt="${escapeHtml(car.title)}"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div class="car-related-card__copy">
        <strong>${escapeHtml(car.title)}</strong>
        <span>${car.pricePerDay ? `от ${escapeHtml(formatMoney(car.pricePerDay))} ₽ / сутки` : 'Цена по запросу'}</span>
      </div>
    </a>
  `;
}

function buildCarStructuredData(car) {
  const images = getImages(car).map((image) => `${SITE_URL}${image.imagePath}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: car.title,
    image: images,
    description: car.description || `Аренда ${car.title} в Абакане`,
    category: getCategoryLabel(car.category),
    brand: {
      '@type': 'Brand',
      name: car.title.split(' ')[0],
    },
    offers: car.pricePerDay
      ? {
          '@type': 'Offer',
          url: `${SITE_URL}/car/${car.slug}`,
          priceCurrency: 'RUB',
          price: car.pricePerDay,
          availability: car.isActive
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'AutoRental',
            name: 'RioCar',
          },
        }
      : undefined,
  };
}

function renderCarPage(car, relatedCars) {
  const features = parseFeatures(car.features);
  const category = getCategoryLabel(car.category);
  const primaryImage = getPrimaryImage(car);
  const price = car.pricePerDay ? formatMoney(car.pricePerDay) : 'По запросу';
  const deposit =
    Number(car.deposit) > 0 ? `${formatMoney(car.deposit)} ₽` : 'Без залога';

  const specs = [
    renderSpec('calendar', 'Год выпуска', car.year),
    renderSpec('engine', 'Двигатель', car.engine),
    renderSpec('road', 'Пробег', car.mileage),
    renderSpec('gearbox', 'Коробка передач', car.gearbox),
    renderSpec('fuel', 'Топливо', car.fuel),
  ]
    .filter(Boolean)
    .join('');

  const additionalSpecs = [
    renderSpec('drive', 'Привод', car.drive),
    renderSpec('body', 'Кузов', car.bodyType),
    renderSpec('seats', 'Количество мест', car.seats),
  ]
    .filter(Boolean)
    .join('');

  const featuresMarkup = features.length
    ? features.map(renderFeature).join('')
    : renderFeature(car.complectation || 'Комплектацию уточнит менеджер');

  const relatedMarkup = relatedCars.length
    ? relatedCars.map(renderRelatedCard).join('')
    : '<p class="car-related__empty">Другие автомобили скоро появятся.</p>';

  const description =
    car.description ||
    `${car.title} доступен для аренды в RioCar. Подробности и условия уточнит менеджер.`;

  const rentalTerms =
    car.rentalTerms ||
    'Условия аренды, доступность автомобиля и итоговую стоимость уточнит менеджер RioCar.';

  const page = replaceAll(withComponents(carTemplate, { nestedPage: true }), {
    '{{SEO_TITLE}}': escapeHtml(
      `${car.title} в аренду в Абакане — цена от ${price} ₽ | RioCar`,
    ),
    '{{SEO_DESCRIPTION}}': escapeHtml(
      `Аренда ${car.title} в Абакане. Цена от ${price} ₽ в сутки. Характеристики, фотографии и бронирование автомобиля в RioCar.`,
    ),
    '{{CANONICAL_URL}}': escapeHtml(`${SITE_URL}/car/${car.slug}`),
    '{{OG_IMAGE}}': escapeHtml(`${SITE_URL}${primaryImage}`),
    '{{CAR_SLUG}}': escapeHtml(car.slug),
    '{{CAR_TITLE}}': escapeHtml(car.title),
    '{{CAR_YEAR}}': escapeHtml(car.year || 'Год по запросу'),
    '{{CAR_CATEGORY}}': escapeHtml(category),
    '{{CAR_PRICE}}': escapeHtml(price),
    '{{CAR_MIN_DAYS}}': escapeHtml(car.minRentalDays || 1),
    '{{CAR_DEPOSIT}}': escapeHtml(deposit),
    '{{CAR_GALLERY}}': renderGallery(car),
    '{{CAR_SPECS}}': specs,
    '{{CAR_ADDITIONAL_SPECS}}': additionalSpecs,
    '{{CAR_DESCRIPTION}}': escapeHtml(description),
    '{{CAR_FEATURES}}': featuresMarkup,
    '{{CAR_RENTAL_TERMS}}': escapeHtml(rentalTerms),
    '{{RELATED_CARS}}': relatedMarkup,
    '{{CAR_JSON_LD}}': escapeJsonForHtml(buildCarStructuredData(car)),
    '{{CAR_PRICE_LABEL}}': escapeHtml(
      car.pricePerDay ? `от ${price} ₽ / сутки` : 'Цена по запросу',
    ),
  });

  return page;
}

async function findRelatedCars(car) {
  const sameCategory = await prisma.car.findMany({
    where: {
      isActive: true,
      category: car.category,
      id: { not: car.id },
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 3,
    include: {
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      },
    },
  });

  if (sameCategory.length >= 3) {
    return sameCategory;
  }

  const excludedIds = [car.id, ...sameCategory.map((item) => item.id)];
  const fallback = await prisma.car.findMany({
    where: {
      isActive: true,
      id: { notIn: excludedIds },
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 3 - sameCategory.length,
    include: {
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      },
    },
  });

  return [...sameCategory, ...fallback];
}

router.get('/api/public/cars', async (req, res, next) => {
  try {
    const cars = await prisma.car.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });

    return res.status(200).json({
      success: true,
      cars: cars.map((car) => ({
        ...car,
        features: parseFeatures(car.features),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/cars.html', async (req, res, next) => {
  try {
    const cars = await prisma.car.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });

    return res.status(200).type('html').send(renderCatalogPage(cars));
  } catch (error) {
    return next(error);
  }
});

router.get('/car/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();

    const car = await prisma.car.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: {
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!car) {
      const notFound = replaceAll(
        withComponents(carTemplate, { nestedPage: true }),
        {
          '{{SEO_TITLE}}': 'Автомобиль не найден — RioCar',
          '{{SEO_DESCRIPTION}}':
            'Запрошенный автомобиль не найден или временно недоступен.',
          '{{CANONICAL_URL}}': `${SITE_URL}/cars.html`,
          '{{OG_IMAGE}}': `${SITE_URL}/site/image/black-lexus.webp`,
          '{{CAR_SLUG}}': '',
          '{{CAR_TITLE}}': 'Автомобиль не найден',
          '{{CAR_YEAR}}': '—',
          '{{CAR_CATEGORY}}': 'RioCar',
          '{{CAR_PRICE}}': '—',
          '{{CAR_MIN_DAYS}}': '1',
          '{{CAR_DEPOSIT}}': '—',
          '{{CAR_GALLERY}}': `
          <div class="car-not-found">
            <strong>Такого автомобиля сейчас нет в каталоге</strong>
            <p>Возможно, он скрыт или адрес страницы изменился.</p>
            <a href="/cars.html">Вернуться в автопарк</a>
          </div>
        `,
          '{{CAR_SPECS}}': '',
          '{{CAR_ADDITIONAL_SPECS}}': '',
          '{{CAR_DESCRIPTION}}':
            'Посмотрите другие доступные автомобили в автопарке RioCar.',
          '{{CAR_FEATURES}}': '',
          '{{CAR_RENTAL_TERMS}}': '—',
          '{{RELATED_CARS}}': '',
          '{{CAR_JSON_LD}}': '{}',
          '{{CAR_PRICE_LABEL}}': 'Цена по запросу',
        },
      );

      return res.status(404).type('html').send(notFound);
    }

    const relatedCars = await findRelatedCars(car);

    return res.status(200).type('html').send(renderCarPage(car, relatedCars));
  } catch (error) {
    return next(error);
  }
});

export { renderCatalogPage, renderCarPage };
export default router;

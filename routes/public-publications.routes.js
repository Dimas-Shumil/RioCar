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

const homeTemplate = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const publicationTemplate = readFileSync(
  path.join(PUBLIC_DIR, 'publication.html'),
  'utf8',
);
const headerComponent = readFileSync(
  path.join(COMPONENTS_DIR, 'header.html'),
  'utf8',
);
const footerComponent = readFileSync(
  path.join(COMPONENTS_DIR, 'footer.html'),
  'utf8',
);

const SITE_URL = String(
  process.env.SITE_URL || 'https://riocar-abakan.ru',
).replace(/\/+$/, '');

const typeLabels = {
  NEWS: 'Новость',
  PROMOTION: 'Акция',
  OFFER: 'Предложение',
};

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
    .replace('/site/image/Logo.png', '/site/image/logo.png')
    .replace(/href=(['"])#home\1/g, 'href="/"')
    .replace(/href=(['"])#form\1/g, 'href="/#form"')
    .replace(/href=(['"])#contacts\1/g, 'href="/#contacts"');
}

const nestedHeaderComponent = prepareNestedComponent(headerComponent);
const nestedFooterComponent = prepareNestedComponent(footerComponent);

function withHomeComponents(template) {
  return template
    .replace('<!-- HEADER_COMPONENT -->', headerComponent)
    .replace('<!-- FOOTER_COMPONENT -->', footerComponent);
}

function withNestedComponents(template) {
  return template
    .replace('<!-- HEADER_COMPONENT -->', nestedHeaderComponent)
    .replace('<!-- FOOTER_COMPONENT -->', nestedFooterComponent);
}

function getTypeLabel(type) {
  return typeLabels[type] || 'Публикация';
}

function formatDate(value, options = {}) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: options.withYear === false ? undefined : 'numeric',
    timeZone: 'Asia/Krasnoyarsk',
  }).format(value);
}

function getPublicationDateLabel(publication) {
  const now = new Date();

  if (publication.endsAt) {
    const prefix = publication.endsAt < now ? 'Завершено' : 'До';
    return `${prefix} ${formatDate(publication.endsAt, { withYear: false })}`;
  }

  if (publication.publishedAt) {
    return formatDate(publication.publishedAt);
  }

  return 'Актуально';
}

function getPublicationImage(publication) {
  return publication.coverImage || '/site/image/black-lexus.webp';
}

function renderSliderCard(publication) {
  const image = getPublicationImage(publication);
  const label = getTypeLabel(publication.type);

  return `
    <a
      class="publication-card swiper-slide"
      href="/publications/${encodeURIComponent(publication.slug)}"
      target="_blank"
      rel="noopener"
      data-publication-type="${escapeHtml(publication.type.toLowerCase())}"
      aria-label="Открыть публикацию: ${escapeHtml(publication.title)}"
    >
      <img
        class="publication-card__image"
        src="${escapeHtml(image)}"
        alt="${escapeHtml(publication.coverAlt || publication.title)}"
        loading="lazy"
        decoding="async"
      />
      <span class="publication-card__shade" aria-hidden="true"></span>

      <span class="publication-card__content">
        <span class="publication-card__badge">${escapeHtml(label)}</span>
        <strong class="publication-card__title">${escapeHtml(publication.title)}</strong>
        <span class="publication-card__meta">
          <span class="publication-card__calendar" aria-hidden="true"></span>
          ${escapeHtml(getPublicationDateLabel(publication))}
        </span>
      </span>

      <span class="publication-card__open" aria-hidden="true">↗</span>
    </a>
  `;
}

function renderHomeSlider(publications) {
  if (!publications.length) {
    return '';
  }

  return `
    <section class="publication-strip" aria-labelledby="publication-strip-title">
      <div class="publication-strip__container">
        <div class="publication-strip__head">
          <div>
            <span class="publication-strip__eyebrow">Актуальное RioCar</span>
            <h2 id="publication-strip-title">Новости и специальные предложения</h2>
          </div>

          <div
            class="publication-strip__pagination"
            data-publications-pagination
            aria-label="Переключение публикаций"
          ></div>
        </div>

        <div
          class="publication-strip__slider swiper"
          data-publications-slider
          data-publications-count="${publications.length}"
        >
          <div class="swiper-wrapper">
            ${publications.map(renderSliderCard).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPublicationContent(content) {
  const lines = String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(escapeHtml).join('<br />')}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    );
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-•]\s+/, ''));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return (
    blocks.join('') ||
    '<p>Подробности предложения уточняйте у менеджера RioCar.</p>'
  );
}

function getPublicationStatus(publication) {
  const now = new Date();

  if (publication.startsAt && publication.startsAt > now) {
    return 'Скоро начнётся';
  }

  if (publication.endsAt && publication.endsAt < now) {
    return 'Предложение завершено';
  }

  return 'Действует';
}

function getPeriodText(publication) {
  if (publication.startsAt && publication.endsAt) {
    return `${formatDate(publication.startsAt)} — ${formatDate(publication.endsAt)}`;
  }

  if (publication.endsAt) {
    return `До ${formatDate(publication.endsAt)}`;
  }

  if (publication.startsAt) {
    return `С ${formatDate(publication.startsAt)}`;
  }

  return 'Без ограничения по сроку';
}

function renderMeta(publication) {
  const published = publication.publishedAt || publication.createdAt;

  return `
    <div class="publication-meta">
      <article class="publication-meta__item">
        <span>Статус</span>
        <strong>${escapeHtml(getPublicationStatus(publication))}</strong>
      </article>
      <article class="publication-meta__item">
        <span>Период</span>
        <strong>${escapeHtml(getPeriodText(publication))}</strong>
      </article>
      <article class="publication-meta__item">
        <span>Опубликовано</span>
        <strong>${escapeHtml(formatDate(published))}</strong>
      </article>
    </div>
  `;
}

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();

    const publications = await prisma.publication.findMany({
      where: {
        isActive: true,
        showOnHome: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      orderBy: [
        { isPinned: 'desc' },
        { sortOrder: 'asc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 12,
    });

    const page = replaceAll(withHomeComponents(homeTemplate), {
      '<!-- PUBLICATIONS_SLIDER -->': renderHomeSlider(publications),
    });

    return res.status(200).type('html').send(page);
  } catch (error) {
    return next(error);
  }
});

router.get('/publications/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .slice(0, 120);
    const now = new Date();

    const publication = await prisma.publication.findFirst({
      where: {
        slug,
        isActive: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
    });

    if (!publication) {
      return res.status(404).type('text').send('Публикация не найдена.');
    }

    const typeLabel = getTypeLabel(publication.type);
    const description =
      publication.excerpt ||
      String(publication.content || '')
        .replace(/\s+/g, ' ')
        .slice(0, 180);
    const image = getPublicationImage(publication);
    const canonicalUrl = `${SITE_URL}/publications/${publication.slug}`;
    const absoluteImage = image.startsWith('http')
      ? image
      : `${SITE_URL}${image}`;
    const publishedAt = publication.publishedAt || publication.createdAt;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': publication.type === 'NEWS' ? 'NewsArticle' : 'Article',
      headline: publication.title,
      description,
      image: [absoluteImage],
      datePublished: publishedAt.toISOString(),
      dateModified: publication.updatedAt.toISOString(),
      mainEntityOfPage: canonicalUrl,
      author: {
        '@type': 'Organization',
        name: 'RioCar',
      },
      publisher: {
        '@type': 'Organization',
        name: 'RioCar',
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/site/image/logo.png`,
        },
      },
    };

    const page = replaceAll(withNestedComponents(publicationTemplate), {
      '{{SEO_TITLE}}': escapeHtml(`${publication.title} — RioCar`),
      '{{SEO_DESCRIPTION}}': escapeHtml(description),
      '{{CANONICAL_URL}}': escapeHtml(canonicalUrl),
      '{{OG_IMAGE}}': escapeHtml(absoluteImage),
      '{{PUBLICATION_TYPE}}': escapeHtml(typeLabel),
      '{{PUBLICATION_TYPE_CLASS}}': escapeHtml(publication.type.toLowerCase()),
      '{{PUBLICATION_TITLE}}': escapeHtml(publication.title),
      '{{PUBLICATION_EXCERPT}}': escapeHtml(description),
      '{{PUBLICATION_IMAGE}}': escapeHtml(image),
      '{{PUBLICATION_IMAGE_ALT}}': escapeHtml(
        publication.coverAlt || publication.title,
      ),
      '{{PUBLICATION_CONTENT}}': renderPublicationContent(publication.content),
      '{{PUBLICATION_META}}': renderMeta(publication),
      '{{PUBLICATION_JSON_LD}}': escapeJsonForHtml(structuredData),
    });

    return res.status(200).type('html').send(page);
  } catch (error) {
    return next(error);
  }
});

export default router;

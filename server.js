import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MIN_FORM_TIME_MS = 2500;

const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'TO_EMAIL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Отсутствуют переменные окружения: ${missingEnv.join(', ')}`);
  process.exit(1);
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(__dirname));

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много заявок. Попробуйте чуть позже.',
  },
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RioCar server is running',
  });
});

app.post('/api/send', sendLimiter, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Некорректный запрос.',
      });
    }

    if (req.body.website) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная заявка.',
      });
    }

    const formTime = Number(req.body.form_time || 0);

    if (!formTime || Date.now() - formTime < MIN_FORM_TIME_MS) {
      return res.status(400).json({
        success: false,
        message: 'Попробуйте отправить форму чуть позже.',
      });
    }

    const name = cleanText(req.body.name, 60);
    const phone = cleanText(req.body.phone, 40);
    const car = cleanText(req.body.car, 120);
    const tripDate = cleanText(req.body.date, 100);
    const carYear = cleanText(req.body.car_year, 20);
    const carPrice = cleanText(req.body.car_price, 80);
    const message = cleanText(req.body.message, 900);
    const page = cleanText(req.body.page, 200);

    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректное имя.',
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона.',
      });
    }

    if (!car) {
      return res.status(400).json({
        success: false,
        message: 'Выберите автомобиль.',
      });
    }

    const formattedPhone = formatPhone(phone);
    const telLink = makeTelLink(phone);

    const createdAt = new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Krasnoyarsk',
    });

    console.log('🔥 Новая заявка RioCar:', {
      name,
      phone: formattedPhone,
      car,
      carYear: carYear || '—',
      carPrice: carPrice || '—',
      tripDate: tripDate || '—',
      page: page || '—',
      createdAt,
      ip: req.ip,
    });

    const text = `
Новая заявка с сайта RioCar

Имя: ${name}
Телефон: ${formattedPhone}
Автомобиль: ${car}
Год: ${carYear || '—'}
Цена: ${carPrice || '—'}
Дата поездки: ${tripDate || '—'}
Комментарий: ${message || '—'}
Страница: ${page || '—'}
Дата заявки: ${createdAt}
    `.trim();

    const html = buildEmailTemplate({
      name,
      formattedPhone,
      telLink,
      car,
      carYear,
      carPrice,
      tripDate,
      message,
      page,
      createdAt,
    });

    const sendMailPromise = transporter.sendMail({
      from: `"RioCar сайт" <${process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `Заявка RioCar: ${car}`,
      text,
      html,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SMTP timeout')), 10000);
    });

    await Promise.race([sendMailPromise, timeoutPromise]);

    return res.status(200).json({
      success: true,
      message: 'Заявка отправлена. Мы скоро свяжемся с вами.',
    });
  } catch (error) {
    console.error('Ошибка отправки заявки RioCar:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера. Попробуйте ещё раз чуть позже.',
    });
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('Ошибка подключения к SMTP RioCar:', error.message);
  } else {
    console.log('SMTP RioCar готов к отправке писем');
  }
});

app.listen(PORT, () => {
  console.log(`RioCar server started: http://localhost:${PORT}`);
});

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) return digits;
  if (digits.length === 11 && digits.startsWith('7')) return `8${digits.slice(1)}`;
  if (digits.length === 10) return `8${digits}`;

  return '';
}

function isValidPhone(phone) {
  return /^89\d{9}$/.test(normalizePhone(phone));
}

function formatPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return '';

  return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
}

function makeTelLink(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return '';

  return `+7${normalized.slice(1)}`;
}

function emailRow(label, value) {
  return `
<tr>
<td style="padding:12px 0 4px; color:#777777; font-size:12px; text-transform:uppercase; letter-spacing:1px;">
${escapeHtml(label)}
</td>
</tr>
<tr>
<td style="padding:4px 0 16px; font-size:18px; font-weight:700; color:#ffffff; line-height:1.5;">
${value}
</td>
</tr>
`;
}

function buildEmailTemplate({
  name,
  formattedPhone,
  telLink,
  car,
  carYear,
  carPrice,
  tripDate,
  message,
  page,
  createdAt,
}) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Новая заявка RioCar</title>
</head>

<body style="margin:0; padding:0; background:#090909; font-family:Arial, sans-serif; color:#ffffff;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#090909; padding:32px 12px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="
  max-width:640px;
  background:#111111;
  border:1px solid rgba(216,160,22,0.22);
  border-radius:20px;
  overflow:hidden;
">

<tr>
<td style="
  padding:32px;
  background:linear-gradient(135deg,#151515 0%,#090909 100%);
  border-bottom:3px solid #d8a016;
">

<div style="
  font-size:12px;
  letter-spacing:3px;
  text-transform:uppercase;
  color:#d8a016;
  margin-bottom:10px;
">
RIOCAR / ЗАЯВКА
</div>

<h1 style="
  margin:0;
  font-size:28px;
  line-height:1.2;
  text-transform:uppercase;
">
Новая заявка<br>
<span style="color:#d8a016;">на аренду автомобиля</span>
</h1>

<p style="
  margin:14px 0 0;
  color:#a0a0a0;
  font-size:14px;
  line-height:1.6;
">
Клиент оставил заявку с сайта RioCar.
</p>

</td>
</tr>

<tr>
<td style="padding:28px 32px;">

<table width="100%" cellpadding="0" cellspacing="0">

${emailRow('Имя', escapeHtml(name))}

${emailRow(
    'Телефон',
    `<a href="tel:${escapeHtml(telLink)}" style="color:#d8a016; text-decoration:none;">${escapeHtml(formattedPhone)}</a>`,
  )}

${emailRow(
    'Автомобиль',
    `<span style="display:inline-block; padding:10px 16px; border-radius:999px; background:#d8a016; color:#000000; font-size:15px; font-weight:700;">${escapeHtml(car)}</span>`,
  )}

${emailRow('Год', escapeHtml(carYear || '—'))}

${emailRow('Цена', escapeHtml(carPrice || '—'))}

${emailRow('Дата поездки', escapeHtml(tripDate || '—'))}

${emailRow('Комментарий', escapeHtml(message || '—'))}

${emailRow('Страница', escapeHtml(page || '—'))}

${emailRow('Дата заявки', escapeHtml(createdAt || '—'))}

</table>

</td>
</tr>

<tr>
<td style="
  padding:24px 32px;
  background:#0b0b0b;
  border-top:1px solid rgba(255,255,255,0.06);
">

<a href="tel:${escapeHtml(telLink)}" style="
  display:inline-block;
  padding:14px 22px;
  background:linear-gradient(135deg,#e6b84d 0%,#d8a016 100%);
  color:#000000;
  text-decoration:none;
  border-radius:10px;
  font-weight:700;
  text-transform:uppercase;
">
Позвонить клиенту
</a>

<p style="
  margin:16px 0 0;
  color:#666666;
  font-size:12px;
  line-height:1.5;
">
Письмо автоматически отправлено с сайта RioCar.
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

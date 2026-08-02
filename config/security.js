const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? '__Host-riocar_admin_session'
  : 'riocar_admin_session';

const SESSION_ABSOLUTE_TTL_MS =
  4 * 60 * 60 * 1000;

// Пока вкладка админки открыта, heartbeat поддерживает сессию.
// После прекращения heartbeat сессия протухает примерно за 2 минуты.
const SESSION_IDLE_TTL_MS =
  2 * 60 * 1000;

// Не чаще одного обновления lastUsedAt примерно раз в 20 секунд.
const SESSION_TOUCH_INTERVAL_MS =
  20 * 1000;

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
  };
}

function getSessionCookieClearOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
  };
}

export {
  IS_PRODUCTION,
  SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
  getSessionCookieOptions,
  getSessionCookieClearOptions,
};

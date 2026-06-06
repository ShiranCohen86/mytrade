const isProd = process.env.NODE_ENV === 'production';

function fmt(level, msg, meta) {
  if (isProd) {
    return JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta });
  }
  const ts = new Date().toISOString().slice(11, 19);
  const suffix = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] ${msg}${suffix}`;
}

module.exports = {
  info:  (msg, meta) => console.log(fmt('info', msg, meta)),
  warn:  (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
  audit: (action, data) => console.log(fmt('audit', action, { type: 'audit', ...data })),
};

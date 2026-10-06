const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const emit = (level, message, meta) => {
  if (LEVELS[level] < currentLevel) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  const target = level === "error" ? console.error : console.log;
  if (meta !== undefined) target(line, meta);
  else target(line);
};

export const logger = {
  debug: (message, meta) => emit("debug", message, meta),
  info: (message, meta) => emit("info", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  error: (message, meta) => emit("error", message, meta),
};

export default logger;
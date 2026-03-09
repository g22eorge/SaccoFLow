type LogLevel = "info" | "warn" | "error";

const writeLog = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ?? {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
};

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    writeLog("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    writeLog("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    writeLog("error", message, context),
};

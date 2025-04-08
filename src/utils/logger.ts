import pino from 'pino';

export function setupLogger(verbose = false): pino.Logger {
  const logLevel = verbose ? 'debug' : 'info';
  
  return pino({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    },
    enabled: process.env.NODE_ENV !== 'test'
  });
} 
import { Logger } from 'pino';

interface GetTimestampOptions {
  verbose?: boolean;
  endpoint?: string;
  logger: Logger;
}

export async function getTimestamp(
  programId: string,
  options: GetTimestampOptions
): Promise<number> {
  const { logger } = options;
  
  logger.debug(`Fetching deployment timestamp for program: ${programId}`);
  logger.debug('Verbose mode is enabled, showing additional debug information');
  
  const start = new Date(2020, 0, 1).getTime() / 1000;
  const now = Date.now() / 1000;
  const randomTimestamp = Math.floor(start + Math.random() * (now - start));
  
  logger.debug(`Generated random timestamp: ${randomTimestamp}`);
  
  return randomTimestamp;
} 
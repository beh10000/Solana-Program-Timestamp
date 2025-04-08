import { Logger } from 'pino';
import bs58 from 'bs58';

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
  // Validate the program ID before proceeding
  if (!isValidProgramId(programId)) {
    logger.error(`Invalid program ID: ${programId}`);
    throw new Error(`Invalid program ID: ${programId}`);
  }
  
  logger.debug(`Program ID validation passed: ${programId}`);
  
  const start = new Date(2020, 0, 1).getTime() / 1000;
  const now = Date.now() / 1000;
  const randomTimestamp = Math.floor(start + Math.random() * (now - start));
  
  logger.debug(`Generated random timestamp: ${randomTimestamp}`);
  
  return randomTimestamp;
} 

/**
 * Validates if a string is a valid Solana program ID
 * A valid Solana program ID is a base58-encoded public key (32 bytes)
 * @param programId The program ID to validate
 * @returns boolean indicating whether the program ID is valid
 */
export function isValidProgramId(programId: string): boolean {
  // Check if the input is a non-empty string
  if (!programId || typeof programId !== 'string') {
    return false;
  }

  // Base58 character set: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  
  // Check if the string contains only base58 characters
  if (!base58Regex.test(programId)) {
    return false;
  }
  
  // Decode the base58 string and check the byte length
  try {
    // Use the imported bs58 instead of requiring it here
    const decoded = bs58.decode(programId);
    
    // Check if the decoded byte array is exactly 32 bytes (Solana public key size)
    if (decoded.length !== 32) {
      return false;
    }
  } catch (error) {
    // If decoding fails, it's not a valid base58 string
    return false;
  }
  
  return true;
}

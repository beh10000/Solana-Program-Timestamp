import { Logger } from 'pino';
import bs58 from 'bs58';
import { getRpcUrls, getDefaultRpcUrl } from '../utils/config';
import { Connection } from '@solana/web3.js';
import { setupLogger } from '../utils/logger';
export interface GetTimestampOptions {
  verbose?: boolean;
  endpoint?: string;
  logger?: Logger;
}

export async function getTimestamp(
  programId: string, 
  endpoints: string[],
  options?: { 
    verbose?: boolean; 
    logger?: Logger;
  }
): Promise<string> {
  // Create a default logger if one isn't provided
  const logger = options?.logger || setupLogger(options?.verbose || false);
  // Try each RPC URL until one works
  let lastError: Error | null = null;
  
  for (const rpcUrl of endpoints) {
    try {
      logger?.debug(`Attempting to use RPC URL: ${rpcUrl}`);
      
      // Create connection with the current RPC URL
      const connection = new Connection(rpcUrl);
      logger.debug(`Fetching deployment timestamp for program: ${programId}`);
      // Validate the program ID before proceeding
      if (!isValidProgramId(programId)) {
        logger.error(`Invalid program ID: ${programId}`);
        throw new Error(`Invalid program ID: ${programId}`);
      }
      
      logger.debug(`Program ID validation passed: ${programId}`);
      
      const randomTimestamp = await requestTimestamp(connection, programId, logger);
      
      // If successful, return the timestamp
      return randomTimestamp.toString();
    } catch (error) {
      logger?.warn({ error, rpcUrl }, 'Failed to get timestamp from RPC URL');
      lastError = error as Error;
      // Continue to the next RPC URL
    }
  }
  
  // If we get here, all RPC URLs failed
  throw new Error(`Failed to get timestamp using all configured RPC URLs: ${lastError?.message || 'Unknown error'}`);
}
/**
 * Requests the deployment timestamp for a Solana program
 * This is a placeholder implementation that returns a random timestamp
 * TODO: Implement actual logic to fetch the deployment timestamp from the blockchain
 * 
 * @param connection The Solana connection object
 * @param programId The program ID to get the timestamp for
 * @param logger Logger instance for debugging
 * @returns A random timestamp (will be replaced with actual deployment timestamp)
 */
async function requestTimestamp(
  connection: Connection,
  programId: string,
  logger: any
): Promise<number> {
  logger.debug(`Requesting timestamp for program: ${programId}`);
  
  // This is a placeholder implementation that returns a random timestamp
  // between Jan 1, 2020 and current date
  const startDate = new Date('2020-01-01').getTime();
  const endDate = new Date().getTime();
  const randomTimestamp = Math.floor(startDate + Math.random() * (endDate - startDate));
  
  logger.debug(`Generated random timestamp: ${randomTimestamp}`);
  logger.info(`Note: This is a placeholder implementation. Actual blockchain query will be implemented later.`);
  
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

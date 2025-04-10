import { Logger } from 'pino';
import bs58 from 'bs58';
import { getRpcUrls, getDefaultRpcUrl } from '../utils/config';
import { Connection, PublicKey, Finality } from '@solana/web3.js';
import { setupLogger } from '../utils/logger';

export interface GetTimestampOptions {
  verbose?: boolean;
  endpoint?: string;
  logger?: Logger;
  retries?: number;
  retryDelay?: number;
}


export async function getTimestamp(
  programId: string,
  endpoints: string[],
  options?: GetTimestampOptions
): Promise<number> {
  const logger = options?.logger || setupLogger(options?.verbose || false);
  let lastError: Error | null = null;
  const maxRetries = options?.retries ?? 3;
  const retryDelay = options?.retryDelay ?? 1000;

  for (const rpcUrl of endpoints) {
    try {
      logger?.debug(`Attempting to use RPC URL: ${rpcUrl}`);
      const connection = new Connection(rpcUrl);

      logger.debug(`Validating program ID: ${programId}`);
      if (!isValidProgramId(programId)) {
        throw new Error(`Invalid program ID: ${programId}`);
      }
      logger.debug(`Program ID validation passed: ${programId}`);

      
      const firstBlockTime = await findFirstBlockTimestamp(connection, programId, logger, maxRetries, retryDelay);

      if (firstBlockTime === null) {
        logger.error(`Could not determine a valid block timestamp for program: ${programId}.`);
        throw new Error(`Could not determine deployment timestamp for program: ${programId}`);
      }

      const timestamp = firstBlockTime;

      return timestamp;
    } catch (error) {
      logger?.warn({ error, rpcUrl }, 'Failed to get timestamp from RPC URL');
      lastError = error as Error;
    }
  }

  throw new Error(`Failed to get timestamp using all configured RPC URLs: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Finds the earliest block timestamp for a Solana program by iteratively fetching transaction signatures
 * and examining their block times.
 * 
 * This function works by:
 * 1. Starting with the most recent transactions
 * 2. Paginating backward through transaction history using the 'before' parameter
 * 3. Continuing until either:
 *    - No more signatures are found (reached beginning of history)
 *    - A batch with fewer than the requested limit is returned (last page)
 * 
 * The function uses retry logic to handle temporary RPC failures.
 * 
 * @param connection - The Solana connection object to use for RPC calls
 * @param programIdStr - The program ID as a string to search for transactions
 * @param logger - Logger instance for debug and error information
 * @param maxRetries - Maximum number of retry attempts for failed RPC calls
 * @param retryDelayMs - Delay in milliseconds between retry attempts
 * 
 * @returns A Promise that resolves to:
 *   - The earliest block timestamp (in seconds) if found
 *   - null if no transactions with timestamps were found
 * 
 * @throws Will propagate errors from the RPC connection after retry attempts are exhausted
 */
async function findFirstBlockTimestamp(
    connection: Connection,
    programIdStr: string,
    logger: Logger,
    maxRetries: number,
    retryDelayMs: number
): Promise<number | null> {
    let oldestSignature: string | null = null;
    let currentBeforeSignature: string | undefined = undefined;
    let firstTimestamp: number | null = null;
    const limit = 1000;
    const programId = new PublicKey(programIdStr);
    const operationName = `getSignaturesForAddress(${programIdStr})`;

    logger.debug(`Starting search for the first signature for ${programIdStr}`);

    while (true) {
        logger.debug(`Fetching signatures before: ${currentBeforeSignature || 'latest'}`);

        const signaturesInfo = await retryOperation(
            () => connection.getSignaturesForAddress(
                programId,
                {
                    limit: limit,
                    before: currentBeforeSignature,
                },
            ),
            maxRetries,
            retryDelayMs,
            logger,
            operationName
        );

        if (!signaturesInfo || signaturesInfo.length === 0) {
            logger.debug('No more signatures found. Reached the beginning of history or no transactions exist.');
            break;
        }
        
        
        const oldestInBatch = signaturesInfo[signaturesInfo.length - 1];
        oldestSignature = oldestInBatch.signature;
        currentBeforeSignature = oldestSignature;

        // Convert blockTime (seconds) to milliseconds for Date constructor
        const oldestBlockTimeMs = typeof oldestInBatch.blockTime === 'number' ? oldestInBatch.blockTime * 1000 : null;
        const oldestTimestampReadable = oldestBlockTimeMs ? new Date(oldestBlockTimeMs).toLocaleString() : 'N/A';

        logger.debug(`Fetched ${signaturesInfo.length} signatures. Oldest in batch: ${oldestSignature} (Slot: ${oldestInBatch.slot}, Time: ${oldestTimestampReadable})`);

        if (signaturesInfo.length < limit) {
            logger.debug('Received less than limit, assuming this is the last page.');
            if (typeof oldestInBatch.blockTime === 'number') {
                firstTimestamp = oldestInBatch.blockTime;
            } else {
                logger.warn(`Oldest transaction found (${oldestSignature}) has no blockTime. Timestamp may be inaccurate.`);
            }
            break;
        }
        if (typeof oldestInBatch.blockTime === 'number') {
            firstTimestamp = oldestInBatch.blockTime;
        }
    }

    if (firstTimestamp !== null) {
        logger.debug(`Found the potentially earliest block timestamp for ${programIdStr}: ${firstTimestamp} (from signature ${oldestSignature})`);
    } else {
        logger.warn(`Could not determine a block timestamp for ${programIdStr}. The program might be unused or transactions lack blockTime data.`);
    }

    return firstTimestamp;
}



/**
 * Validates if a string is a valid Solana program ID
 * A valid Solana program ID is a base58-encoded public key (32 bytes)
 * @param programId The program ID to validate
 * @returns boolean indicating whether the program ID is valid
 */
export function isValidProgramId(programId: string): boolean {
  if (!programId || typeof programId !== 'string') {
    return false;
  }
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(programId)) {
    return false;
  }
  try {
    const decoded = bs58.decode(programId);
    if (decoded.length !== 32) {
      return false;
    }
  } catch (error) {
    return false;
  }
  return true;
}
/**
 * Helper function to retry asynchronous operations. Useful for re-attempting rpc http requests when they fail for no clear reason.
 */
async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delayMs: number,
    logger: Logger,
    operationName: string = 'Operation'
    ): Promise<T> {
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                return await operation();
            } catch (error) {
                attempts++;
                const isLastAttempt = attempts >= maxRetries;
                const level = isLastAttempt ? 'error' : 'warn';
                logger[level](
                    { error },
                    `${operationName} attempt ${attempts} failed.${isLastAttempt ? ` No more retries.` : ` Retrying in ${delayMs}ms...`}`
                );
                if (isLastAttempt) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        throw new Error(`${operationName} failed after ${maxRetries} attempts.`);
        }

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

/**
 * Helper function to retry asynchronous operations.
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

export async function getTimestamp(
  programId: string,
  endpoints: string[],
  options?: GetTimestampOptions
): Promise<string> {
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

      const timestamp = await requestTimestamp(
          connection,
          programId,
          logger,
          maxRetries,
          retryDelay
      );

      return timestamp.toString();
    } catch (error) {
      logger?.warn({ error, rpcUrl }, 'Failed to get timestamp from RPC URL');
      lastError = error as Error;
    }
  }

  throw new Error(`Failed to get timestamp using all configured RPC URLs: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Finds the signature of the first transaction involving the given address.
 * Iterates backwards through transaction history using getSignaturesForAddress.
 */
async function findFirstSignature(
    connection: Connection,
    programIdStr: string,
    logger: Logger,
    maxRetries: number,
    retryDelayMs: number
): Promise<string | null> {
    let oldestSignature: string | null = null;
    let currentBeforeSignature: string | undefined = undefined;
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
            break;
        }
    }

    if (oldestSignature) {
        logger.info(`Found the potentially oldest signature for ${programIdStr}: ${oldestSignature}`);
    } else {
        logger.warn(`Could not find any signatures for ${programIdStr}. The program might be unused or very new.`);
    }

    return oldestSignature;
}

/**
 * Requests the deployment timestamp for a Solana program by finding its first transaction signature.
 *
 * @param connection The Solana connection object
 * @param programId The program ID to get the timestamp for
 * @param logger Logger instance for debugging
 * @param maxRetries Max number of retries for RPC calls
 * @param retryDelayMs Delay between retries in milliseconds
 * @returns The timestamp (in milliseconds) of the first transaction, or throws an error.
 */
async function requestTimestamp(
  connection: Connection,
  programId: string,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number
): Promise<number> {
  logger.debug(`Attempting to find the first signature for program: ${programId}`);

  try {
    const firstSignature = await findFirstSignature(connection, programId, logger, maxRetries, retryDelayMs);

    if (!firstSignature) {
      logger.error(`No transaction signatures found for program: ${programId}. Cannot determine deployment time.`);
      throw new Error(`No transaction signatures found for program: ${programId}`);
    }

    const operationName = `getParsedTransaction(${firstSignature})`;
    logger.debug(`Fetching transaction details for signature: ${firstSignature}`);

    const txDetails = await retryOperation(
        () => connection.getParsedTransaction(firstSignature, { maxSupportedTransactionVersion: 0 }),
        maxRetries,
        retryDelayMs,
        logger,
        operationName
    );

    if (!txDetails) {
         logger.error(`Failed to retrieve transaction details for signature: ${firstSignature} after retries.`);
         throw new Error(`Failed to retrieve transaction details for signature: ${firstSignature}`);
    }

    if (typeof txDetails.blockTime !== 'number') {
        logger.error(`Could not retrieve valid blockTime for signature: ${firstSignature}. Transaction details: ${JSON.stringify(txDetails)}`);
        throw new Error(`Could not retrieve valid blockTime for signature: ${firstSignature}`);
    }

    const timestamp = txDetails.blockTime * 1000;
    logger.info(`Deployment timestamp determined from first transaction ${firstSignature}: ${timestamp}`);
    logger.info(`Human-readable time (first transaction): ${new Date(timestamp).toLocaleString()}`);
    return timestamp;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error }, `Error determining deployment timestamp for ${programId}: ${errorMessage}`);
    throw new Error(`Failed to determine deployment timestamp for ${programId}: ${errorMessage}`);
  }
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

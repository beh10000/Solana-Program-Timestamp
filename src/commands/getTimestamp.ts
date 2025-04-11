import { Logger } from 'pino';
import bs58 from 'bs58';
import { getRpcUrls, getDefaultRpcUrl } from '../utils/config';
import { Connection, PublicKey, Finality, ConfirmedSignatureInfo } from '@solana/web3.js';
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

      // Use binary search strategy to find the first timestamp
      const result = await findFirstTimestampBinarySearch(
        connection,
        programId,
        logger,
        maxRetries,
        retryDelay
      );

      if (result === null) {
        logger.error(`Could not determine a valid block timestamp for program: ${programId}.`);
        throw new Error(`Could not determine deployment timestamp for program: ${programId}`);
      }

      return result;
    } catch (error) {
      logger?.warn({ error, rpcUrl }, 'Failed to get timestamp from RPC URL');
      lastError = error as Error;
    }
  }

  throw new Error(`Failed to get timestamp using all configured RPC URLs: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Finds the earliest timestamp of a program using binary search on slot numbers.
 * 
 * This approach is significantly faster than paginating through all transaction
 * signatures, especially for programs with long histories.
 * 
 * @param connection - The Solana connection object
 * @param programIdStr - The program ID as a string
 * @param logger - Logger instance
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries in milliseconds
 * 
 * @returns The earliest timestamp in seconds, or null if not found
 */
async function findFirstTimestampBinarySearch(
  connection: Connection,
  programIdStr: string,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number
): Promise<number | null> {
  logger.debug(`Starting binary search for the first transaction of program: ${programIdStr}`);
  
  const programId = new PublicKey(programIdStr);

  // First, get the latest slot to establish our search bounds
  const latestSlot = await retryOperation(
    () => connection.getSlot(),
    maxRetries,
    retryDelayMs,
    logger,
    'getSlot'
  );
  
  logger.debug(`Latest slot: ${latestSlot}`);
  
  // Binary search bounds
  let low = 1; // Start from slot 1 (genesis is slot 0)
  let high = latestSlot;
  let firstProgramSlot: number | null = null;
  
  // Keep track of transactions found at specific slots for optimization
  const foundSignaturesAtSlot = new Map<number, boolean>();
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    logger.debug(`Binary search: Checking slot ${mid} (range: ${low}-${high})`);
    
    try {
      const hasSignatures = await checkSlotForProgramTransactions(
        connection,
        programId,
        mid,
        logger,
        maxRetries,
        retryDelayMs,
        foundSignaturesAtSlot
      );
      
      if (hasSignatures) {
        // Program exists at or before this slot
        firstProgramSlot = mid;
        high = mid - 1; // Look earlier
      } else {
        // Program doesn't exist at this slot, look later
        low = mid + 1;
      }
    } catch (error) {
      // If we can't get this slot, try moving to an adjacent slot
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not check slot ${mid}, trying to adjust: ${errorMessage}`);
      // Try the next slot
      low = mid + 1;
    }
  }
  
  // If we found a slot with program transactions, get the actual timestamp
  if (firstProgramSlot !== null) {
    logger.debug(`Found potential first slot for program: ${firstProgramSlot}`);
    return await getTimestampFromSlot(
      connection,
      firstProgramSlot,
      programId,
      logger,
      maxRetries,
      retryDelayMs
    );
  }
  
  logger.debug(`Binary search completed without finding any program transactions`);
  return null;
}

/**
 * Checks if a program has transactions at or before a specific slot.
 * 
 * @param connection - The Solana connection
 * @param programId - The program ID
 * @param slot - The slot to check
 * @param logger - Logger instance
 * @param maxRetries - Maximum retries for RPC calls
 * @param retryDelayMs - Delay between retries
 * @param foundSignaturesAtSlot - Cache of slots already checked
 * 
 * @returns Boolean indicating if program transactions exist at or before this slot
 */
async function checkSlotForProgramTransactions(
  connection: Connection,
  programId: PublicKey,
  slot: number,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number,
  foundSignaturesAtSlot: Map<number, boolean>
): Promise<boolean> {
  // Check cache first
  if (foundSignaturesAtSlot.has(slot)) {
    return foundSignaturesAtSlot.get(slot)!;
  }
  
  try {
    // Get the block to extract a signature
    const block = await retryOperation(
      () => connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
      }),
      maxRetries,
      retryDelayMs,
      logger,
      `getBlock(${slot})`
    );
    
    if (!block || !block.transactions || block.transactions.length === 0) {
      logger.debug(`No transactions found in slot ${slot}`);
      foundSignaturesAtSlot.set(slot, false);
      return false;
    }
    
    // Get a signature from the block to use as 'before' parameter
    const anySignature = block.transactions[0].transaction.signatures[0];
    if (!anySignature) {
      logger.debug(`No signatures found in transactions at slot ${slot}`);
      foundSignaturesAtSlot.set(slot, false);
      return false;
    }
    
    logger.debug(`Using signature ${anySignature} from slot ${slot} as reference point`);
    
    // Check if there are any transactions for this program before this signature
    const signatures: ConfirmedSignatureInfo[] = await retryOperation(
      () => connection.getSignaturesForAddress(programId, {
        before: anySignature,
        limit: 1,
      }),
      maxRetries,
      retryDelayMs,
      logger,
      `getSignaturesForAddress(${programId.toBase58()}, before: ${anySignature})`
    );
    
    const hasTransactions = signatures && signatures.length > 0;
    foundSignaturesAtSlot.set(slot, hasTransactions);
    
    if (hasTransactions) {
      logger.debug(`Found program transactions at or before slot ${slot}`);
    } else {
      logger.debug(`No program transactions found at or before slot ${slot}`);
    }
    
    return hasTransactions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Error checking slot ${slot}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Gets the actual timestamp from a slot where we found program transactions.
 * This performs a more fine-grained search to find the exact timestamp
 * by paginating all the way back to the first transaction.
 * 
 * @param connection - The Solana connection
 * @param slot - The slot to analyze
 * @param programId - The program ID
 * @param logger - Logger instance
 * @param maxRetries - Maximum retries for RPC calls
 * @param retryDelayMs - Delay between retries
 * 
 * @returns The timestamp in seconds, or null if not found
 */
async function getTimestampFromSlot(
  connection: Connection,
  slot: number,
  programId: PublicKey,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number
): Promise<number | null> {
  try {
    // Get the block data including block time
    const block = await retryOperation(
      () => connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
      }),
      maxRetries,
      retryDelayMs,
      logger,
      `getBlock(${slot})`
    );
    
    if (!block || block.transactions.length === 0) {
      logger.warn(`Could not get block data for slot ${slot}`);
      return null;
    }
    
    // Get a signature from the block
    const anySignature = block.transactions[0].transaction.signatures[0];
    
    // Pagination variables
    let oldestSignature: string | undefined = anySignature;
    let oldestBlockTime: number | null = null;
    let moreSignaturesExist = true;
    const limit = 1000;  // Maximum batch size
    
    logger.debug(`Starting pagination to find earliest transaction for program ${programId.toBase58()}`);
    
    // Keep paginating backward until we find the first transaction
    while (moreSignaturesExist) {
      logger.debug(`Fetching signatures before: ${oldestSignature}`);
      
      const signatures: ConfirmedSignatureInfo[] = await retryOperation(
        () => connection.getSignaturesForAddress(programId, {
          before: oldestSignature,
          limit: limit,
        }),
        maxRetries,
        retryDelayMs,
        logger,
        `getSignaturesForAddress(${programId.toBase58()}, before: ${oldestSignature})`
      );
      
      if (!signatures || signatures.length === 0) {
        logger.debug(`No more signatures found. Reached the beginning of history.`);
        moreSignaturesExist = false;
        break;
      }
      
      // Update our oldest signature and blockTime
      const batchOldestSignature = signatures[signatures.length - 1];
      oldestSignature = batchOldestSignature.signature;
      
      if (batchOldestSignature.blockTime) {
        oldestBlockTime = batchOldestSignature.blockTime;
      }
      
      logger.debug(`Fetched ${signatures.length} signatures. Oldest in batch: ${oldestSignature}`);
      
      // If we got fewer signatures than the limit, we've reached the end
      if (signatures.length < limit) {
        logger.debug(`Received ${signatures.length} signatures (less than limit ${limit}). Reached the beginning.`);
        moreSignaturesExist = false;
      }
    }
    
    if (oldestBlockTime !== null) {
      logger.info(`Found earliest transaction timestamp: ${oldestBlockTime} (${new Date(oldestBlockTime * 1000).toISOString()})`);
      return oldestBlockTime;
    }
    
    logger.warn(`Oldest signature found, but no blockTime available`);
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting timestamp from slot ${slot}: ${errorMessage}`);
    return null;
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

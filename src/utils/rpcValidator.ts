import fetch from 'node-fetch';
import pino from 'pino';

/**
 * Validates a Solana RPC endpoint by making a test request
 * @param url The RPC endpoint URL to validate
 * @param logger Logger instance
 * @returns A promise that resolves if the endpoint is valid
 */
export async function validateRpcEndpoint(url: string, logger: pino.Logger): Promise<void> {
  logger.debug(`Validating RPC endpoint: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getVersion'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.debug(`Successfully connected to RPC endpoint. Response: ${JSON.stringify(data)}`);
  } catch (error) {
    logger.error({ error }, `Invalid RPC endpoint: ${url}`);
    throw error;
  }
}

/**
 * Validates multiple RPC endpoints and returns only the valid ones
 * @param endpoints Array of RPC endpoint URLs to validate
 * @param logger Logger instance
 * @returns Array of validated endpoint URLs
 */
export async function validateRpcEndpoints(endpoints: string[], logger: pino.Logger): Promise<string[]> {
  const validatedEndpoints: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      await validateRpcEndpoint(endpoint, logger);
      validatedEndpoints.push(endpoint);
    } catch (error) {
      logger.debug(`Endpoint validation failed for ${endpoint}, skipping this endpoint`);
    }
  }
  
  return validatedEndpoints;
} 
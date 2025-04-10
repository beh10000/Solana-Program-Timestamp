import pino from 'pino';
import { getDefaultRpcUrl, getRpcUrls } from './config';
import { validateRpcEndpoints } from './rpcValidator';

/**
 * Resolves and validates RPC endpoints from command options or configuration
 * @param options Command options containing optional endpoints
 * @param logger Logger instance
 * @returns Promise resolving to an array of validated endpoints
 */
export async function resolveEndpoints(
  options: { endpoints?: string[] } & Record<string, any>,
  logger: pino.Logger
): Promise<string[]> {
  let endpoints: string[] = [];
  
  // If endpoints are passed as arguments in the command line, only use these if valid URLs.
  if (options.endpoints && options.endpoints.length > 0) {
    // Validate the provided endpoints
    endpoints = await validateRpcEndpoints(options.endpoints, logger);
    
    // If after validation, no endpoints are left, exit
    if (endpoints.length === 0) {
      logger.error('No valid RPC endpoints provided.');
      console.error('Error: No valid RPC endpoints were provided via the --endpoints flag.');
      process.exit(1);
    }
  } 
  // If no endpoints are passed as arguments, check for pre-configured RPC urls.
  else {
    // Try to get the default RPC endpoint from config
    const defaultRpcUrl = getDefaultRpcUrl(logger);
    const configuredUrls = getRpcUrls(logger);

    if (defaultRpcUrl) {
      // Use default and other configured URLs
      endpoints = [defaultRpcUrl, ...configuredUrls.filter(url => url !== defaultRpcUrl)];
      logger.debug(`Using configured RPC endpoints starting with default: ${defaultRpcUrl}`);
    } else if (configuredUrls.length > 0) {
      // Use other configured URLs if no default is set for some reason.
      endpoints = configuredUrls;
      logger.debug(`Using configured RPC endpoints. No default set.`);
    } else {
      // No endpoints provided and none configured, inform user and exit
      logger.error('No RPC endpoint provided and no endpoints configured.');
      console.error('Error: No RPC endpoint specified.');
      console.error('Please provide an endpoint using the --endpoints flag or configure one using "rpc add <url>".');
      process.exit(1);
    }
  }

  // Ensure endpoints are not empty before proceeding (should be covered above, but as a safeguard)
  if (endpoints.length === 0) {
    logger.error('No RPC endpoints available to use.');
    console.error('Error: Could not determine an RPC endpoint to use.');
    process.exit(1);
  }
  
  return endpoints;
} 
#!/usr/bin/env node

import { Command } from 'commander';
import { getTimestamp } from './commands/getTimestamp';
import { setupLogger } from './utils/logger';
import { 
  addRpcUrl, 
  removeRpcUrl, 
  getRpcUrls, 
  getDefaultRpcUrl,
  setDefaultRpcUrl
} from './utils/config';
import fetch from 'node-fetch';
import pino from 'pino';
import { performance } from 'perf_hooks';

const program = new Command();

program
  .name('solana-timestamp')
  .description('CLI tool to get the first deployment timestamp of a Solana program')
  .version('1.0.0');

program
  .command('get')
  .description('Get the first deployment timestamp of a Solana program')
  .argument('<programId>', 'Solana program ID')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-e, --endpoints <endpoints...>', 'Custom RPC endpoint URLs to try in order, if one fails more than 5 times in a row it falls back to the next URL in line.')
  .option('-r, --retries <number>', 'Number of retry attempts for RPC calls (default: 3)')
  .option('-d, --retry-delay <number>', 'Delay in milliseconds between retry attempts (default: 1000)')
  .action(async (programId, options) => {
    const logger = setupLogger(options.verbose);
    let endpoints: string[] = [];
    // If endpoints are passed as arguments in the command line, only use these if valid URLs.
    if (options.endpoints && options.endpoints.length > 0) {
      try {
        // Validate each provided endpoint
        for (const endpoint of options.endpoints) {
          try {
            await validateRpcEndpoint(endpoint, logger);
            // Add only validated endpoints to the list
            endpoints.push(endpoint);
          } catch (error) {
            logger.debug(`Endpoint validation failed for ${endpoint}, skipping this endpoint`);
          }
        }
        // If after validation, no endpoints are left, exit
        if (endpoints.length === 0) {
            logger.error('No valid RPC endpoints provided.');
            console.error('Error: No valid RPC endpoints were provided via the --endpoints flag.');
            process.exit(1);
        }
      } catch (error) {
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

    try {
      const timestamp = await getTimestamp(programId, endpoints, {
        verbose: options.verbose,
        logger
      });
      
      console.log(timestamp);
    } catch (error) {
      // End timing on error
      console.timeEnd('getTimestamp execution');
      logger.error({ error }, 'Error occurred during timestamp retrieval');
      process.exit(1);
    }
  });

const rpcCommand = program
  .command('rpc')
  .description('Manage RPC endpoint URLs');

rpcCommand
  .command('add')
  .description('Add an RPC endpoint URL to the configuration')
  .argument('<url>', 'RPC endpoint URL')
  .option('-d, --default', 'Set as default RPC URL')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (url, options) => {
    const logger = setupLogger(options.verbose);
    
    try {
      // Validate the RPC endpoint
      await validateRpcEndpoint(url, logger);
      const setAsDefault = options.default;
      // Add the validated URL to configuration
      if (addRpcUrl(url, setAsDefault, logger)) {
        const isDefault = getDefaultRpcUrl(logger) === url;
        console.log(`Added RPC URL: ${url}${isDefault ? ' (default)' : ''}`);
      } else {
        console.error('Failed to add RPC URL to configuration');
        process.exit(1);
      }
    } catch (error) {
      process.exit(1);
    }
  });

rpcCommand
  .command('remove')
  .description('Remove an RPC endpoint URL from the configuration')
  .argument('<url>', 'RPC endpoint URL')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((url, options) => {
    const logger = setupLogger(options.verbose);
    let currentDefault =getDefaultRpcUrl(logger);
    
    if (removeRpcUrl(url, logger)) {
      console.log(`Removed RPC URL: ${url}`);
      let newDefault = getDefaultRpcUrl(logger);
      // If the default URL has changed after removal, notify the user
      if (newDefault !== currentDefault) {
        console.log(`Default URL is now: ${newDefault}`);
      }
    } else {
      console.error('Failed to remove RPC URL');
      process.exit(1);
    }
  });

rpcCommand
  .command('list')
  .description('List all configured RPC endpoint URLs')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((options) => {
    const logger = setupLogger(options.verbose);
    const urls = getRpcUrls(logger);
    const defaultUrl = getDefaultRpcUrl(logger);
    
    if (urls.length === 0) {
      console.log('No RPC URLs configured');
    } else {
      console.log('Configured RPC URLs:');
      urls.forEach(url => {
        console.log(`${url === defaultUrl ? '* ' : '  '}${url}`);
      });
      console.log('\n* = default URL');
    }
    
    // Add explicit exit to prevent hanging
    process.exit(0);
  });

rpcCommand
  .command('set-default')
  .description('Set the default RPC endpoint URL')
  .argument('<url>', 'RPC endpoint URL')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((url, options) => {
    const logger = setupLogger(options.verbose);
    if (setDefaultRpcUrl(url, logger)) {
      console.log(`Set default RPC URL: ${url}`);
    } else {
      console.error('Failed to set default RPC URL. Make sure the URL is in your configuration.');
      process.exit(1);
    }
  });

// Only parse arguments when running as the main script, not when imported
if (require.main === module) {
  program.parse();
}
/**
 * Validates a Solana RPC endpoint by making a test request
 * @param url The RPC endpoint URL to validate
 * @param logger Logger instance
 * @returns A promise that resolves if the endpoint is valid
 */
async function validateRpcEndpoint(url: string, logger: pino.Logger): Promise<void> {
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
export { validateRpcEndpoint }; 
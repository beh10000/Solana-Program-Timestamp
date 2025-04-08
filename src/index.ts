#!/usr/bin/env node

import { Command } from 'commander';
import { getTimestamp } from './commands/getTimestamp';
import { setupLogger } from './utils/logger';

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
  .option('-e, --endpoint <endpoint>', 'Custom RPC endpoint URL')
  .action(async (programId, options) => {
    const logger = setupLogger(options.verbose);
    try {
      const timestamp = await getTimestamp(programId, {
        verbose: options.verbose,
        endpoint: options.endpoint,
        logger
      });
      
      console.log(timestamp);
    } catch (error) {
      logger.error({ error }, 'Error occurred');
      process.exit(1);
    }
  });

program.parse(); 
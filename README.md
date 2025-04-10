# Solana Timestamp CLI

A command-line tool for retrieving the first deployment timestamp of Solana programs.

## Overview

This tool queries Solana RPC nodes to find the earliest transaction involving a specified program ID, allowing you to determine when a program was first deployed to the Solana blockchain.

## Features

- Retrieve the first deployment timestamp of any Solana program
- Manage multiple RPC endpoints with fallback capability
- Configurable retry mechanisms for handling transient RPC failures
- Configurable logging levels for debugging

## Solana Timestamp CLI: Architectural Overview

The Solana Timestamp CLI employs a modular, service-oriented architecture designed for reliability and extensibility. 
### Core Architecture Components

1. **Command Pattern Implementation**  
   The application leverages the Commander.js library to implement a clean command pattern architecture. This pattern separates command definition, argument parsing, and execution logic, creating a maintainable command structure with intuitive subcommands.

2. **Service-Oriented Design**  
   The tool follows a service-oriented approach with clear separation of concerns:
   * **Command Handlers**: Encapsulated logic for specific functions (getTimestamp, RPC management)
   * **Utility Services**: Configuration management, logging, validation
   * **RPC Interaction Layer**: Abstracted communication with blockchain nodes

3. **Fault-Tolerant RPC Management**  
   A simple and robust endpoint management system with:
   * Multiple endpoint support with automatic failover to handle transient RPC failures that may occur with free-tier RPC endpoints
   * Persistent configuration storage and on-the-fly RPC endpoint input
   * Endpoint validation and health checking
   * Default endpoint designation

4. **Resilient Data Retrieval System**  
   The timestamp retrieval logic employs:
   * Backward pagination through transaction history
   * Configurable retry mechanisms with exponential backoff
   * Explicit error handling with informative messaging
   * Transaction signature processing for determining program deployment time
   * NOTE: A more efficient way of doing this would be to lean into subgraph indexing APIs to retrieve deployment signatures instead of backwards search. 

5. **Logging Infrastructure**  
   Structured logging via Pino with:
   * Verbosity option
   * Context-rich log entries and error messages



### Performance Considerations

It was determined that the only feasible way to retrieve the deployment timestamp using only the RPC HTTP endpoints was to work backwards through a paginated list of transaction signatures to find the earliest on for the target program ID. This is not particularly efficient, but a different solution could not be found so far. An alternative solution if using external hosted API's is acceptable for your particular use case is to query indexed subgraph APIs to retrieve the first available signature. 


### Extensibility

The architecture facilitates easy extension through:
* Modular command structure for adding new capabilities
* Abstracted RPC interaction layer
* Clear interfaces between components

This design enables reliable interaction with Solana while providing users with flexibility in how they connect to the network, making it suitable for both individual users and integration into larger systems.

## Installation

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Install from npm

```bash
npm install -g solana-timestamp
```

Or with yarn:

```bash
yarn global add solana-timestamp
```

### Install from source

```bash
git clone https://github.com/yourusername/solana-timestamp.git
cd solana-timestamp
npm install
npm link
```

## Usage

### Basic Usage

Get the timestamp of a Solana program:

```bash
solana-timestamp get <programId>
```

Example:

```bash
solana-timestamp get TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
```

Output:
```
1614292795
```

The output is a Unix timestamp (seconds since epoch).

### Managing RPC Endpoints

Add an RPC endpoint:

```bash
solana-timestamp rpc add https://api.mainnet-beta.solana.com
```

Set as default:

```bash
solana-timestamp rpc add https://api.mainnet-beta.solana.com --default
```

List configured endpoints:

```bash
solana-timestamp rpc list
```

Remove an endpoint:

```bash
solana-timestamp rpc remove https://api.mainnet-beta.solana.com
```

Set an existing endpoint as default:

```bash
solana-timestamp rpc set-default https://api.mainnet-beta.solana.com
```

### Advanced Options

#### Verbose Logging

Enable detailed logging:

```bash
solana-timestamp get <programId> --verbose
```

#### Custom RPC Endpoints

Use specific RPC endpoints for a single command:

```bash
solana-timestamp get <programId> --endpoints https://api.mainnet-beta.solana.com https://solana-api.projectserum.com
```

This will try the endpoints in order, falling back to the next one if an endpoint fails.

#### Retry Options

Configure retry behavior:

```bash
solana-timestamp get <programId> --retries 5 --retry-delay 2000
```

This sets 5 retry attempts with a 2-second delay between attempts.

## Command Reference

### `get`

```
solana-timestamp get <programId> [options]
```

Options:
- `-v, --verbose` - Enable verbose logging
- `-e, --endpoints <endpoints...>` - Custom RPC endpoint URLs to try in order
- `-r, --retries <number>` - Number of retry attempts (default: 3)
- `-d, --retry-delay <number>` - Delay in ms between retries (default: 1000)

### `rpc add`

```
solana-timestamp rpc add <url> [options]
```

Options:
- `-d, --default` - Set as default RPC URL
- `-v, --verbose` - Enable verbose logging

### `rpc remove`

```
solana-timestamp rpc remove <url> [options]
```

Options:
- `-v, --verbose` - Enable verbose logging

### `rpc list`

```
solana-timestamp rpc list [options]
```

Options:
- `-v, --verbose` - Enable verbose logging

### `rpc set-default`

```
solana-timestamp rpc set-default <url> [options]
```

Options:
- `-v, --verbose` - Enable verbose logging

## How It Works

The tool functions by:

1. Validating the provided program ID
2. Connecting to Solana RPC nodes
3. Fetching transaction signatures associated with the program ID
4. Paginating backward through the transaction history
5. Finding the oldest transaction with a valid timestamp
6. Returning the Unix timestamp of the earliest block containing the program

## Troubleshooting

### Common Issues

**Error: No RPC endpoint specified**
- Add an RPC endpoint: `solana-timestamp rpc add <url>`
- Or specify endpoints with the command: `solana-timestamp get <programId> --endpoints <url>`

**Error: Invalid program ID**
- Ensure you're using a valid Solana program ID (32-byte public key in base58 format)

**Error: Failed to get timestamp using all configured RPC URLs**
- Check your internet connection
- Verify the RPC endpoints are operational
- Try increasing the number of retries: `--retries 5`

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

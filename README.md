# Solana Timestamp CLI

A command-line tool for retrieving the first deployment timestamp of Solana programs. Useful for both human users and integration into automated systems.

## Features

- Retrieve the first deployment timestamp of any Solana program
- Simple and powerful RPC endpoint management allowing pre-saved RPCs or command line input RPCs
- Configurable retry mechanisms for handling transient RPC failures
- Configurable logging levels for debugging

## Installation

### Using npm
1. Clone the repository:
   ```bash
   git clone https://github.com/beh10000/Solana-Program-Timestamp.git
   cd Solana-Program-Timestamp
   ```
2. ```bash
   npm install
   npm run build
   ```
   Run Tests with
   ```bash
   npm test
   ```
3. Create an alias for simple calls. Either temporary (current session only):
   ```bash
   alias solana-timestamp='npx ts-node src/index.ts'
   ```
   or permanent:
   ```bash
   echo 'alias solana-timestamp="npx ts-node src/index.ts"' >> ~/.bashrc
   source ~/.bashrc  
   ```


### Alternative: Using Docker

You can run the Solana Timestamp CLI using Docker without installing Node.js or npm on your system.

#### Building the Docker Image

1. Clone the repository:
   ```bash
   git clone https://github.com/beh10000/Solana-Program-Timestamp.git
   cd Solana-Program-Timestamp
   ```

2. Build the Docker image:
   ```bash
   docker build -t solana-timestamp .
   ```

#### Using the Docker Image

Run commands using the Docker image:

```bash

docker run --rm solana-timestamp get <programId> --endpoints <rpcEndpoint> --verbose
```
Quicknode and Helius have free, reliable RPC urls with reasonable rate limits and request allowances. NOTE: Helius endpoint has a "?" in it which may trip up the command line so if the endpoint has interfering characters pass it in quotes as a string.
#### Persisting Configuration
This tool enables users to save RPC urls so that they do not have to be passed in every command line call. To persist RPC endpoint configurations between runs, use the provided `docker-run.sh` script, which automatically sets up proper permissions:

```bash
# Make the script executable
chmod +x docker-run.sh

# Add an RPC endpoint
./docker-run.sh rpc add <rpcEndpoint> --default

# List configured endpoints
./docker-run.sh rpc list
```

Alternatively, you can use Docker Compose with permission initialization:

```bash
# First initialize the volume permissions (only needed once)
docker-compose --profile init up init-volume

# Then add an RPC URL
ARGS="rpc add <rpcEndpointUrl> --default" docker-compose up --rm

# Get timestamp for a program
ARGS="get <programId>" docker-compose up --rm
```

If you prefer to manually manage Docker volumes, you'll need to ensure proper permissions:

```bash
# Create the volume
docker volume create solana-timestamp-config

# Set proper permissions
docker run --rm -v solana-timestamp-config:/data alpine sh -c "mkdir -p /data/solana-timestamp && chmod -R 777 /data"

# Then run commands with the volume
docker run --rm -v solana-timestamp-config:/home/appuser/.config solana-timestamp rpc add <rpcEndpointUrl> --default
docker run --rm -v solana-timestamp-config:/home/appuser/.config solana-timestamp rpc list
```

#### Creating a Shell Alias

For easier use, you can create a shell alias in your `~/.bashrc` or `~/.zshrc` after setting up the volume permissions:

```bash
# First set up permissions (only needs to be done once)
docker volume create solana-timestamp-config
docker run --rm -v solana-timestamp-config:/data alpine sh -c "mkdir -p /data/solana-timestamp && chmod -R 777 /data"

# Then create the alias
alias solana-timestamp='docker run --rm -v solana-timestamp-config:/home/appuser/.config solana-timestamp'
```

After creating this alias (and restarting your shell or running `source ~/.bashrc`), you can use the tool as if it were installed locally:

```bash
solana-timestamp get <programId>
solana-timestamp rpc list
```

## Usage
### Managing RPC Endpoints
Note: Public RPC urls shown in the example below may have rate limits or other issues. Consider Quicknode or Helius for free RPC urls.
Add an RPC endpoint:

```bash
solana-timestamp rpc add <rpcEndpointUrl>
```

Set as default:

```bash
solana-timestamp rpc add <rpcEndpointUrl> --default
```

List configured endpoints:

```bash
solana-timestamp rpc list
```

Remove an endpoint:

```bash
solana-timestamp rpc remove <rpcEndpointUrl>
```

Set an existing endpoint as default:

```bash
solana-timestamp rpc set-default <rpcEndpointUrl>
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
solana-timestamp get <programId> --endpoints <rpcEndpointUrl1> <rpcEndpointUrl1> 
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
## Solana Timestamp CLI: Architectural Overview

The Solana Timestamp CLI employs a modular, service-oriented architecture designed for reliability and extensibility. 
### Core Architecture Components

1. **Command Pattern Implementation**  
   The application leverages the Commander.js library to implement a clean command pattern architecture. This pattern separates command definition, argument parsing, and execution logic, creating a maintainable command structure with intuitive subcommands.

2. **Service-Oriented Design**  
   * **Command Handlers**: Encapsulated logic for specific functions (getTimestamp, RPC management)
   * **Utility Services**: Configuration management, logging, validation
   * **RPC Interaction Layer**: Abstracted communication with blockchain nodes

3. **Fault-Tolerant RPC Management**  
   A simple and robust endpoint management system with:
   * Multiple endpoint support with automatic failover to handle transient RPC failures that may occur with free-tier RPC endpoints
   * Persistent configuration storage of RPC endpoints and on-the-fly RPC endpoint input
   * Endpoint validation and health checking
   * Default endpoint fallback

4. **Resilient Data Retrieval System**  
   A RPC endpoint request scheme that manages potentially large amounts of transactions to parse via:
   * Backward pagination through transaction history
   * Configurable retry mechanisms with exponential backoff to mitigate rate limit faiuires
   * Explicit error handling with informative messaging

5. **Logging Infrastructure**  
   Structured logging via Pino with:
   * Verbosity option
   * Context-rich log entries and error messages



### Performance Considerations

It was determined that the most feasible way to retrieve the deployment timestamp using only the RPC HTTP endpoints was to work backwards through a paginated list of transaction signatures to find the earliest on for the target program ID. This is not particularly efficient, but a different solution could not be found so far. An alternative solution if using external hosted API's is acceptable for your particular use case is to query indexed subgraph APIs to retrieve the first indexed signature. 


### Extensibility

The architecture facilitates easy extension through:
* Modular command structure for adding new capabilities
* Abstracted RPC interaction layer
* Clear interfaces between components

This design enables reliable interaction with Solana while providing users with flexibility in how they use this tool, making it suitable for both individual users manually using it in the terminal or integration into larger systems.

## How It Works

The tool functions by:

1. Validating the provided program ID and RPC endpoints
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
- Verify the RPC endpoints are operational and you have not reached your request limit.
- Try increasing the number of retries: `--retries 5`


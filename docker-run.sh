#!/bin/bash

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Create a volume name based on the tool name
VOLUME_NAME="solana-timestamp-config"

# Create the volume if it doesn't exist
if ! docker volume inspect "$VOLUME_NAME" &> /dev/null; then
    docker volume create "$VOLUME_NAME"
    echo "Created Docker volume: $VOLUME_NAME"
fi

# Run the container with the volume mounted
docker run --rm -it -v "$VOLUME_NAME:/home/appuser/.config" solana-timestamp "$@" 
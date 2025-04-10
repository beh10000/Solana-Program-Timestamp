import { Connection, PublicKey, ConfirmedSignatureInfo, BlockResponse } from '@solana/web3.js';
import { getTimestamp } from '../../src/commands/getTimestamp'; // Adjust the import path as needed
import dotenv from 'dotenv';
// Mock the logger to prevent console output during tests
jest.mock('../../src/utils/logger', () => {
    // Define the mock logger object *inside* the factory function
    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };
    return {
        // Export the mock logger instance
        logger: mockLogger,
        // Also export a mock setupLogger function that returns the mock logger
        setupLogger: jest.fn(() => mockLogger),
    };
});

// Mock the Connection class from @solana/web3.js
const mockGetSignaturesForAddress = jest.fn();
const mockGetBlock = jest.fn();


describe('getTimestamp integration tests', () => {
  // Load environment variables before accessing them
  dotenv.config();
  const RPC_URL = process.env.TEST_RPC_URL || 'https://google.com';
  
  // Set longer timeout for these tests since they make real network calls
  jest.setTimeout(20000);
  
  it('should return the correct timestamp for a known token', async () => {
   
    const tokenAddress = '4pg4o382r8t63isoReVLV4GXDE7hqpdNFx4XAbAZpump';
    
    const timestamp = await getTimestamp(tokenAddress, [RPC_URL]);
    
    
    expect(timestamp).toBe(1744229620); // Exact timestamp for this token from block explorer
    
  });
  
  
  
  
  
  it('should throw an error for an invalid address', async () => {
    const invalidAddress = 'invalidaddress';
    
    await expect(getTimestamp(invalidAddress, [RPC_URL]))
      .rejects
      .toThrow();
  });
  
  it('should throw an error for an address with no activity', async () => {
    // Generate a valid but unused address
    const unusedAddress = 'FRoGa5UiqGJHGGJp2mHP5eE4AfZ9SDpoysHfS2zN7Wy6';
    
    await expect(getTimestamp(unusedAddress, [RPC_URL]))
      .rejects
      .toThrow();
  });
  
  
});

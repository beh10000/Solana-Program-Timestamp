import { jest } from '@jest/globals';
import * as config from '../../src/utils/config';
import fetch from 'node-fetch';

// Mock the config module and fetch
jest.mock('../../src/utils/config');
jest.mock('node-fetch');

// Import the functions we want to test directly
import { validateRpcEndpoint } from '../../src/index';

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('RPC URL Management', () => {
  const validRpcUrl = 'https://mainnet.helius-rpc.com/?api-key=5796e52e-3f1a-4f3e-ac06-75ac9803166e';
  const invalidRpcUrl = 'https://invalid.rpc.url';
  const logger = { debug: jest.fn(), error: jest.fn() } as any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockedConfig.addRpcUrl.mockReturnValue(true);
    mockedConfig.removeRpcUrl.mockReturnValue(true);
    mockedConfig.getRpcUrls.mockReturnValue([validRpcUrl]);
    mockedConfig.getDefaultRpcUrl.mockReturnValue(validRpcUrl);
    mockedConfig.setDefaultRpcUrl.mockReturnValue(true);
    
    // Mock fetch for RPC validation
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { solana: '1.10.0' } })
    } as any);
  });

  describe('addRpcUrl function', () => {
    it('should add a valid RPC URL', async () => {
      await validateRpcEndpoint(validRpcUrl, logger);
      expect(mockedFetch).toHaveBeenCalledWith(
        validRpcUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('getVersion')
        })
      );
      
      const result = config.addRpcUrl(validRpcUrl, false, logger);
      expect(result).toBe(true);
      
      expect(mockedConfig.addRpcUrl).toHaveBeenCalledWith(validRpcUrl, false, logger);
    });

    it('should add a valid RPC URL as default', async () => {
      await validateRpcEndpoint(validRpcUrl, logger);
      const result = config.addRpcUrl(validRpcUrl, true, logger);
      expect(result).toBe(true);
      expect(mockedConfig.addRpcUrl).toHaveBeenCalledWith(validRpcUrl, true, logger);
    });

    it('should fail when adding an invalid RPC URL', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(validateRpcEndpoint(invalidRpcUrl, logger)).rejects.toThrow();
      expect(mockedConfig.addRpcUrl).not.toHaveBeenCalled();
    });

    it('should fail when config.addRpcUrl returns false', async () => {
      mockedConfig.addRpcUrl.mockReturnValueOnce(false);
      
      await validateRpcEndpoint(validRpcUrl, logger);
      const result = config.addRpcUrl(validRpcUrl, false, logger);
      expect(result).toBe(false);
    });
  });

  describe('removeRpcUrl function', () => {
    it('should remove an RPC URL', () => {
      const result = config.removeRpcUrl(validRpcUrl, logger);
      expect(result).toBe(true);
      expect(mockedConfig.removeRpcUrl).toHaveBeenCalledWith(validRpcUrl, logger);
    });

    it('should fail when config.removeRpcUrl returns false', () => {
      mockedConfig.removeRpcUrl.mockReturnValueOnce(false);
      
      const result = config.removeRpcUrl(validRpcUrl, logger);
      expect(result).toBe(false);
    });
  });

  describe('getRpcUrls and getDefaultRpcUrl functions', () => {
    it('should list configured RPC URLs', () => {
      const urls = config.getRpcUrls(logger);
      const defaultUrl = config.getDefaultRpcUrl(logger);
      
      expect(urls).toEqual([validRpcUrl]);
      expect(defaultUrl).toBe(validRpcUrl);
      expect(mockedConfig.getRpcUrls).toHaveBeenCalledWith(logger);
      expect(mockedConfig.getDefaultRpcUrl).toHaveBeenCalledWith(logger);
    });

    it('should handle when no RPC URLs are configured', () => {
      mockedConfig.getRpcUrls.mockReturnValueOnce([]);
      mockedConfig.getDefaultRpcUrl.mockReturnValueOnce(undefined);
      
      const urls = config.getRpcUrls(logger);
      const defaultUrl = config.getDefaultRpcUrl(logger);
      
      expect(urls).toEqual([]);
      expect(defaultUrl).toBeUndefined();
    });

    it('should identify the default URL among multiple URLs', () => {
      const secondUrl = 'https://api.mainnet-beta.solana.com';
      mockedConfig.getRpcUrls.mockReturnValueOnce([validRpcUrl, secondUrl]);
      
      const urls = config.getRpcUrls(logger);
      const defaultUrl = config.getDefaultRpcUrl(logger);
      
      expect(urls).toEqual([validRpcUrl, secondUrl]);
      expect(defaultUrl).toBe(validRpcUrl);
    });
  });

  describe('setDefaultRpcUrl function', () => {
    it('should set the default RPC URL', () => {
      const result = config.setDefaultRpcUrl(validRpcUrl, logger);
      expect(result).toBe(true);
      expect(mockedConfig.setDefaultRpcUrl).toHaveBeenCalledWith(validRpcUrl, logger);
    });

    it('should fail when config.setDefaultRpcUrl returns false', () => {
      mockedConfig.setDefaultRpcUrl.mockReturnValueOnce(false);
      
      const result = config.setDefaultRpcUrl(validRpcUrl, logger);
      expect(result).toBe(false);
    });
  });

  describe('validateRpcEndpoint function', () => {
    it('should validate a working RPC endpoint', async () => {
      await validateRpcEndpoint(validRpcUrl, logger);
      expect(mockedFetch).toHaveBeenCalledWith(
        validRpcUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('getVersion')
        })
      );
    });

    it('should reject an invalid RPC endpoint with HTTP error', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as any);
      
      await expect(validateRpcEndpoint(invalidRpcUrl, logger)).rejects.toThrow();
      expect(mockedFetch).toHaveBeenCalled();
    });

    it('should reject an RPC endpoint that throws an error', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(validateRpcEndpoint(invalidRpcUrl, logger)).rejects.toThrow();
      expect(mockedFetch).toHaveBeenCalled();
    });
  });
});

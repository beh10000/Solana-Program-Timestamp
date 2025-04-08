import { isValidProgramId } from '../../src/commands/getTimestamp';
import bs58 from 'bs58';

describe('isValidProgramId', () => {
  describe('Valid program IDs', () => {
    test.each([
      // Well-known Solana program IDs
      ['11111111111111111111111111111111', 'System Program'],
      ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'Token Program'],
      ['ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'Associated Token Program'],
      ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', 'Metaplex Token Metadata Program'],
      // Generated valid program ID (32 bytes encoded in base58)
      [bs58.encode(Buffer.from(Array(32).fill(1))), 'Custom valid ID with all bytes = 1'],
      [bs58.encode(Buffer.from(Array(32).fill(255))), 'Custom valid ID with all bytes = 255'],
    ])('should validate %s as a valid program ID (%s)', (programId) => {
      expect(isValidProgramId(programId)).toBe(true);
    });

    test('should validate a randomly generated valid program ID', () => {
      // Generate a random 32-byte array
      const randomBytes = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256)));
      const encodedId = bs58.encode(randomBytes);
      
      expect(isValidProgramId(encodedId)).toBe(true);
    });
  });

  describe('Invalid program IDs', () => {
    describe('Invalid input types', () => {
      test.each([
        [null, 'null'],
        [undefined, 'undefined'],
        ['', 'empty string'],
        [123, 'number'],
        [{}, 'object'],
        [[], 'array'],
      ])('should reject %s as invalid', (invalidInput, description) => {
        // @ts-ignore - intentionally testing invalid types
        expect(isValidProgramId(invalidInput)).toBe(false);
      });
    });

    describe('Invalid string formats', () => {
      test.each([
        ['0x1234567890abcdef', 'Hexadecimal format (Ethereum style)'],
        ['not-base58-!@#$%^', 'Contains invalid base58 characters'],
        ['short', 'Too short to be a valid program ID'],
        [
          'ThisIsAVeryLongStringThatExceedsTheMaximumLengthOfAValidSolanaProgramIdAndShouldBeRejected',
          'Excessively long string'
        ],
      ])('should reject %s as invalid (%s)', (invalidId, description) => {
        expect(isValidProgramId(invalidId)).toBe(false);
      });
    });

    describe('Invalid byte lengths', () => {
      test.each([
        [bs58.encode(Buffer.from([1, 2, 3])), '3 bytes (too short)'],
        [bs58.encode(Buffer.from(Array(16).fill(1))), '16 bytes (too short)'],
        [bs58.encode(Buffer.from(Array(33).fill(1))), '33 bytes (too long)'],
        [bs58.encode(Buffer.from(Array(64).fill(1))), '64 bytes (too long)'],
      ])('should reject %s as invalid (%s)', (invalidId, description) => {
        expect(isValidProgramId(invalidId)).toBe(false);
      });
    });

    test('should reject a valid base58 string that decodes to incorrect length', () => {
      // This is a valid base58 string but decodes to wrong length (24 bytes)
      const validBase58ButWrongLength = '3Mz9N7YPbfbkVwgC67WBFMvuUUdWxeGNN';
      const decoded = bs58.decode(validBase58ButWrongLength);
      expect(decoded.length).not.toBe(32);
      expect(isValidProgramId(validBase58ButWrongLength)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should handle program IDs with leading zeros correctly', () => {
      // Create a byte array with leading zeros
      const bytesWithLeadingZeros = Buffer.from(Array(32).fill(0));
      bytesWithLeadingZeros[31] = 1; // Set last byte to 1 to avoid all zeros
      const encoded = bs58.encode(bytesWithLeadingZeros);
      expect(isValidProgramId(encoded)).toBe(true);
    });

    test('should reject a program ID with all zeros', () => {
      const allZeros = Buffer.from(Array(32).fill(0));
      const encoded = bs58.encode(allZeros);
      expect(isValidProgramId(encoded)).toBe(true);
    });
  });

  describe('Performance considerations', () => {
    test('should validate 1000 program IDs in a reasonable time', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const randomBytes = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256)));
        const encodedId = bs58.encode(randomBytes);
        isValidProgramId(encodedId);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Validated 1000 program IDs in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(1000);
    });
  });
}); 
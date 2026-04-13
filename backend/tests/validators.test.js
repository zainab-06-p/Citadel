/**
 * Unit Tests: Validators
 * Tests all input validation functions used across API routes
 */
const { isValidAlgorandAddress, isValidMilestones, sanitizeString } = require('../src/utils/validators');

// A valid 58 character Algorand address (base32)
const VALID_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1234';
const VALID_ADDRESS_2 = 'B2C3D4E5F6G7H2I3J4K5L6M7N2O3P4Q5R6S7T2U3V4W5X6Y7Z234567A';

describe('isValidAlgorandAddress', () => {
  test('returns true for a valid 58 char alphanumeric address', () => {
    // 58 chars, uppercase A-Z2-7
    const addr = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'.substring(0, 58);
    expect(isValidAlgorandAddress(addr)).toBe(true);
  });

  test('returns false for null', () => {
    expect(isValidAlgorandAddress(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isValidAlgorandAddress(undefined)).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isValidAlgorandAddress('')).toBe(false);
  });

  test('returns false for non-string', () => {
    expect(isValidAlgorandAddress(12345)).toBe(false);
  });

  test('returns false for address shorter than 58 chars', () => {
    expect(isValidAlgorandAddress('AAAAAAA')).toBe(false);
  });

  test('returns false for address longer than 58 chars', () => {
    const longAddr = 'A'.repeat(60);
    expect(isValidAlgorandAddress(longAddr)).toBe(false);
  });

  test('returns false for address with invalid characters (special chars)', () => {
    const badAddr = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@AAAAAAAAAAAAAAAAAAAAA';
    expect(isValidAlgorandAddress(badAddr.substring(0, 58))).toBe(false);
  });

  test('returns false for address with spaces', () => {
    const spacedAddr = 'A'.repeat(28) + '  ' + 'A'.repeat(28);
    expect(isValidAlgorandAddress(spacedAddr)).toBe(false);
  });
});

describe('isValidMilestones', () => {
  test('returns true for valid milestone array', () => {
    const milestones = [
      { amount: 1000, description: 'Phase 1 - Setup' },
      { amount: 2000, description: 'Phase 2 - Development' },
    ];
    expect(isValidMilestones(milestones)).toBe(true);
  });

  test('returns false for empty array', () => {
    expect(isValidMilestones([])).toBe(false);
  });

  test('returns false for null', () => {
    expect(isValidMilestones(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isValidMilestones(undefined)).toBe(false);
  });

  test('returns false for non-array', () => {
    expect(isValidMilestones('not an array')).toBe(false);
    expect(isValidMilestones(42)).toBe(false);
    expect(isValidMilestones({})).toBe(false);
  });

  test('returns false for milestone with zero amount', () => {
    const milestones = [{ amount: 0, description: 'Free work' }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false for milestone with negative amount', () => {
    const milestones = [{ amount: -500, description: 'Refund' }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false for milestone with no amount', () => {
    const milestones = [{ description: 'Missing amount' }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false for milestone with non-number amount', () => {
    const milestones = [{ amount: '1000', description: 'String amount' }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false for milestone with missing description', () => {
    const milestones = [{ amount: 1000 }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false for milestone with empty description', () => {
    const milestones = [{ amount: 1000, description: '' }];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('returns false if any milestone in array is invalid', () => {
    const milestones = [
      { amount: 1000, description: 'Phase 1' },
      { amount: -100, description: 'Phase 2' },
    ];
    expect(isValidMilestones(milestones)).toBe(false);
  });

  test('handles single milestone array', () => {
    const milestones = [{ amount: 500, description: 'Only milestone' }];
    expect(isValidMilestones(milestones)).toBe(true);
  });
});

describe('sanitizeString', () => {
  test('strips HTML angle brackets', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
  });

  test('trims whitespace', () => {
    expect(sanitizeString('  hello world  ')).toBe('hello world');
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeString(123)).toBe('');
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString({})).toBe('');
  });

  test('handles normal strings without modification', () => {
    expect(sanitizeString('Normal description')).toBe('Normal description');
  });

  test('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });
});

// Define a few utility functions to test
const utils = {
  sum: (a, b) => a + b,
  multiply: (a, b) => a * b,
  capitalize: (str) => {
    if (!str) throw new Error('Cannot capitalize empty string');
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },
  isPalindrome: (str) => {
    const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized === normalized.split('').reverse().join('');
  }
};

describe('Utility Functions', () => {
  describe('sum', () => {
    it('should add two positive numbers correctly', () => {
      expect(utils.sum(2, 3)).toBe(5);
    });
    
    it('should handle negative numbers', () => {
      expect(utils.sum(-1, -2)).toBe(-3);
      expect(utils.sum(5, -3)).toBe(2);
    });
    
    it('should handle zero', () => {
      expect(utils.sum(0, 5)).toBe(5);
      expect(utils.sum(0, 0)).toBe(0);
    });
  });
  
  describe('multiply', () => {
    it('should multiply two positive numbers correctly', () => {
      expect(utils.multiply(2, 3)).toBe(6);
    });
    
    it('should handle negative numbers', () => {
      expect(utils.multiply(-2, 3)).toBe(-6);
      expect(utils.multiply(-2, -3)).toBe(6);
    });
    
    it('should handle zero', () => {
      expect(utils.multiply(5, 0)).toBe(0);
    });
  });
  
  describe('capitalize', () => {
    it('should capitalize the first letter and lowercase the rest', () => {
      expect(utils.capitalize('hello')).toBe('Hello');
      expect(utils.capitalize('WORLD')).toBe('World');
      expect(utils.capitalize('javaScript')).toBe('Javascript');
    });
    
    it('should handle single-letter strings', () => {
      expect(utils.capitalize('a')).toBe('A');
    });
    
    it('should handle empty strings', () => {
      // This would actually throw an error with the current implementation
      // but we're testing the expected behavior if it were fixed
      expect(() => utils.capitalize('')).toThrow();
    });
  });
  
  describe('isPalindrome', () => {
    it('should correctly identify palindromes', () => {
      expect(utils.isPalindrome('racecar')).toBe(true);
      expect(utils.isPalindrome('A man a plan a canal Panama')).toBe(true);
      expect(utils.isPalindrome('Madam, I\'m Adam')).toBe(true);
    });
    
    it('should correctly identify non-palindromes', () => {
      expect(utils.isPalindrome('hello')).toBe(false);
      expect(utils.isPalindrome('kanban')).toBe(false);
    });
    
    it('should handle empty strings', () => {
      expect(utils.isPalindrome('')).toBe(true); // An empty string reads the same forward and backward
    });
  });
});
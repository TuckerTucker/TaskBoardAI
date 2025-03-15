/**
 * Filesystem mocking utilities for tests
 * 
 * This module provides a consistent way to mock the node:fs module
 * across tests with proper tracking and reset capabilities.
 */

const mockFs = {
  reset() {
    // Reset all mocks to their initial state
    this.promises.readFile.mockReset();
    this.promises.writeFile.mockReset();
    this.promises.mkdir.mockReset();
    this.promises.readdir.mockReset();
    this.promises.access.mockReset();
    this.promises.unlink.mockReset();
    
    // Reset default implementations
    this.promises.readFile.mockResolvedValue('');
    this.promises.writeFile.mockResolvedValue();
    this.promises.mkdir.mockResolvedValue();
    this.promises.readdir.mockResolvedValue([]);
    this.promises.access.mockResolvedValue();
    this.promises.unlink.mockResolvedValue();
  },

  // Create the mock structure with all relevant methods
  promises: {
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    readdir: jest.fn().mockResolvedValue([]),
    access: jest.fn().mockResolvedValue(),
    unlink: jest.fn().mockResolvedValue()
  }
};

/**
 * Setup the mock for the 'node:fs' module
 * 
 * This function should be called at the beginning of your test file
 * before any imports that use the fs module.
 */
function setupFsMock() {
  jest.mock('node:fs', () => {
    const originalModule = jest.requireActual('node:fs');
    return {
      ...originalModule,
      promises: mockFs.promises
    };
  });
  
  return mockFs;
}

module.exports = {
  setupFsMock,
  mockFs
};
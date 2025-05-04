# Token Optimization Testing Guide

This guide outlines the approach for testing the token optimization features in TaskBoardAI's MCP integration.

## Overview

The token optimization tests verify that our format transformers and specialized card tools reduce token usage as expected. These tests validate both correctness (functional requirements) and efficiency (non-functional requirements).

## Test Categories

### 1. Unit Tests for Format Transformers

These tests verify that the Board model's format transformers work correctly:

- `format()` method dispatches to the appropriate transformer
- `toSummaryFormat()` produces correct summary structure
- `toCompactFormat()` shortens property names correctly
- `toCardsOnlyFormat()` returns only cards and supports column filtering

**Path:** `/tests/unit/models/token-optimization.test.js`

```bash
# Run just the transformer tests
npm test -- tests/unit/models/token-optimization.test.js
```

### 2. Unit Tests for MCP Tools

These tests verify the token-optimized MCP tools:

- `get-board` with format parameters
- `get-card` for single card retrieval
- `update-card` for single card updates
- `move-card` for card position changes
- `batch-cards` for transaction-like operations

**Path:** `/tests/unit/mcp/token-optimization-tools.test.js`

```bash
# Run just the MCP tool tests
npm test -- tests/unit/mcp/token-optimization-tools.test.js
```

### 3. Integration Tests

These tests verify the complete flow from MCP tool invocation through to board persistence:

- Format transformation across board sizes
- Legacy vs. card-first architecture compatibility
- Column filtering efficiency
- Migration process

**Path:** `/tests/integration/mcp/token-optimization-integration.test.js`

```bash
# Run just the integration tests
npm test -- tests/integration/mcp/token-optimization-integration.test.js
```

### 4. Token Usage Benchmarks

These benchmarks quantify token reduction across different board sizes:

- Measures token usage for different formats
- Tests with various board sizes (tiny to x-large)
- Produces comparison tables and charts
- Validates our token reduction claims

**Path:** `/tests/benchmarks/token-optimization-benchmark.js`

```bash
# Run the token benchmarks
npm run benchmark:tokens
```

## Running All Token Optimization Tests

```bash
# Run all token optimization tests
npm run test:token-opt
```

## Test Results

Here are typical token reduction results across board sizes:

| Format | Small (9 cards) | Medium (40 cards) | Large (100 cards) | XLarge (300 cards) |
|--------|-----------------|-------------------|-------------------|-------------------|
| Summary | 55-60% | 70-75% | 80-85% | 85-90% |
| Compact | 30-35% | 40-45% | 45-50% | 50-55% |
| Cards-only | 25-30% | 35-40% | 40-45% | 40-45% |
| Column-filtered | 70-75% | 85-90% | 90-95% | 95-98% |

## Token Optimization Test Strategy

1. **Correctness**: Verify that each format contains the expected data structure
2. **Efficiency**: Measure token count reduction for each format and board size
3. **Edge Cases**: Test with empty boards, single-card columns, etc.
4. **Legacy Support**: Verify compatibility with legacy column-based architecture
5. **Integration**: Test the complete MCP flow from tool invocation to response

## Measuring Token Usage

Token usage is approximated in the tests using character count divided by 4, which is a reasonable approximation for Claude's tokenization. In production, we can integrate with real token counting libraries for more accurate measurement.

The benchmarking tool in `/tests/benchmarks/token-optimization-benchmark.js` provides detailed measurements across different board sizes and formats.

## Future Enhancements

1. **Production token metering**: Add actual token counting in production
2. **Format selector UI**: Add user interface for selecting response formats
3. **Board statistics API**: Extract more valuable metrics from the summary format
4. **Cache integration**: Add caching for common format transformations
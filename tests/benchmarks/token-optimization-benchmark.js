/**
 * Token Optimization Benchmark
 * 
 * This utility measures token usage for different board sizes and formats
 * to quantify the effectiveness of token optimization techniques.
 * 
 * It helps validate token reduction claims and provides data for
 * performance reports.
 */

const fs = require('fs').promises;
const path = require('path');
const Board = require('../../server/models/Board');

// Simple token counting function (approximation)
const countTokens = (text) => {
  if (typeof text === 'object') {
    return Math.ceil(JSON.stringify(text).length / 4);
  }
  return Math.ceil(text.length / 4);
};

// Board data generator with configurable size
const generateTestBoard = (size = 'small') => {
  // Define sizes
  const sizes = {
    tiny: { columns: 3, cardsPerColumn: 1 },
    small: { columns: 3, cardsPerColumn: 3 },
    medium: { columns: 4, cardsPerColumn: 10 },
    large: { columns: 5, cardsPerColumn: 20 },
    xlarge: { columns: 6, cardsPerColumn: 50 }
  };
  
  const config = sizes[size] || sizes.small;
  
  // Create columns
  const columns = [];
  for (let c = 0; c < config.columns; c++) {
    const column = {
      id: `col-${c + 1}`,
      name: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done', 'Archived'][c] || `Column ${c + 1}`
    };
    columns.push(column);
  }
  
  // Create cards
  const cards = [];
  let cardId = 1;
  
  for (let c = 0; c < columns.length; c++) {
    const columnId = columns[c].id;
    const isDoneColumn = columns[c].name === 'Done' || columns[c].name === 'Archived';
    
    for (let i = 0; i < config.cardsPerColumn; i++) {
      const card = {
        id: `card-${cardId}`,
        title: `Task ${cardId}`,
        content: `Description for task ${cardId}. This includes detailed content with multiple sentences to simulate realistic card data. The more text we have, the better our token measurement will reflect real-world usage.`,
        columnId: columnId,
        position: i,
        collapsed: false,
        subtasks: [
          `Subtask ${cardId}.1`, 
          `Subtask ${cardId}.2`,
          `Subtask ${cardId}.3`
        ],
        tags: ['tag1', 'tag2', cardId % 2 === 0 ? 'even' : 'odd'],
        dependencies: i > 0 ? [`card-${cardId - 1}`] : [],
        created_at: '2025-03-01T00:00:00.000Z',
        updated_at: '2025-03-15T00:00:00.000Z',
        completed_at: isDoneColumn ? '2025-03-15T00:00:00.000Z' : null
      };
      
      cards.push(card);
      cardId++;
    }
  }
  
  // Create the board
  return {
    id: `benchmark-board-${size}`,
    projectName: `Benchmark Board (${size})`,
    last_updated: '2025-03-15T00:00:00.000Z',
    columns: columns,
    cards: cards
  };
};

// Run benchmark
const runBenchmark = async () => {
  console.log('Token Optimization Benchmark');
  console.log('===========================');
  console.log();
  
  const sizes = ['tiny', 'small', 'medium', 'large', 'xlarge'];
  const formats = ['full', 'summary', 'compact', 'cards-only'];
  
  const results = {
    sizes: {},
    summary: {
      avgReductions: {}
    }
  };
  
  // Run tests for each board size
  for (const size of sizes) {
    const boardData = generateTestBoard(size);
    const board = new Board(boardData);
    
    const totalCards = boardData.cards.length;
    const cardsByColumn = {};
    
    // Count cards per column for column filtering test
    boardData.columns.forEach(col => {
      cardsByColumn[col.id] = boardData.cards.filter(card => card.columnId === col.id).length;
    });
    
    const sizeResults = {
      totalCards: totalCards,
      cardsByColumn: cardsByColumn,
      formats: {},
      reductions: {}
    };
    
    // Measure each format
    for (const format of formats) {
      const result = board.format(format);
      const tokens = countTokens(result);
      
      sizeResults.formats[format] = tokens;
      
      // Calculate reduction percentage for non-full formats
      if (format !== 'full') {
        const reduction = Math.round((1 - (tokens / sizeResults.formats.full)) * 100);
        sizeResults.reductions[format] = reduction;
      }
    }
    
    // Test column filtering with cards-only format (use first column)
    const firstColumnId = boardData.columns[0].id;
    const filteredResult = board.format('cards-only', { columnId: firstColumnId });
    const filteredTokens = countTokens(filteredResult);
    
    sizeResults.formats['filtered'] = filteredTokens;
    sizeResults.reductions['filtered'] = Math.round((1 - (filteredTokens / sizeResults.formats.full)) * 100);
    
    // Store results for this size
    results.sizes[size] = sizeResults;
    
    // Log results
    console.log(`Board Size: ${size.toUpperCase()} (${totalCards} cards, ${boardData.columns.length} columns)`);
    console.log('Token counts by format:');
    console.log(`- Full format: ${sizeResults.formats.full} tokens (baseline)`);
    
    for (const fmt of [...formats.filter(f => f !== 'full'), 'filtered']) {
      if (fmt === 'filtered') {
        console.log(`- Cards-only format (filtered to ${cardsByColumn[firstColumnId]} cards): ${sizeResults.formats[fmt]} tokens (${sizeResults.reductions[fmt]}% reduction)`);
      } else {
        console.log(`- ${fmt} format: ${sizeResults.formats[fmt]} tokens (${sizeResults.reductions[fmt]}% reduction)`);
      }
    }
    console.log();
  }
  
  // Calculate average reductions across all sizes
  const formatReductions = {};
  
  for (const format of [...formats.filter(f => f !== 'full'), 'filtered']) {
    const reductions = Object.values(results.sizes).map(size => size.reductions[format]);
    const avgReduction = Math.round(reductions.reduce((sum, val) => sum + val, 0) / reductions.length);
    formatReductions[format] = avgReduction;
  }
  
  results.summary.avgReductions = formatReductions;
  
  // Log summary
  console.log('SUMMARY');
  console.log('=======');
  console.log('Average token reduction across all board sizes:');
  for (const [format, reduction] of Object.entries(formatReductions)) {
    if (format === 'filtered') {
      console.log(`- Cards-only format (column filtered): ${reduction}% reduction`);
    } else {
      console.log(`- ${format} format: ${reduction}% reduction`);
    }
  }
  
  // Create reduction comparison table
  console.log('\nToken Reduction by Board Size (%)');
  console.log('-------------------------------');
  
  // Table header
  const header = ['Size', 'Cards', ...formats.filter(f => f !== 'full'), 'Column-Filtered'];
  console.log(header.join('\t'));
  
  // Table rows
  for (const size of sizes) {
    const sizeData = results.sizes[size];
    const row = [
      size,
      sizeData.totalCards,
      ...Object.keys(sizeData.reductions)
        .filter(f => f !== 'filtered')
        .map(f => `${sizeData.reductions[f]}%`),
      `${sizeData.reductions.filtered}%`
    ];
    console.log(row.join('\t'));
  }
  
  // Save results
  const resultsFile = path.join(__dirname, 'token-optimization-results.json');
  await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to ${resultsFile}`);
  
  return results;
};

// Only run directly if executed as a script
if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = {
  runBenchmark,
  generateTestBoard,
  countTokens
};
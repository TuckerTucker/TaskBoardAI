const Board = require('./server/models/Board');
const config = require('./server/config/config');

console.log('Boards directory:', config.boardsDir);

async function listBoards() {
  try {
    const boards = await Board.list();
    console.log('Boards found:', boards.length);
    console.log('Board list:', JSON.stringify(boards, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

listBoards();
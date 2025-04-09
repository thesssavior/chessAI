import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const STOCKFISH_SOURCE = path.join(__dirname, '../node_modules/stockfish.js/stockfish.js');

// Create public directory if it doesn't exist
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR);
}

console.log('Copying Stockfish.js...');

try {
  // Check if source file exists
  if (!fs.existsSync(STOCKFISH_SOURCE)) {
    console.error('Stockfish.js not found in node_modules. Please run npm install first.');
    process.exit(1);
  }

  // Copy the file
  fs.copyFileSync(STOCKFISH_SOURCE, path.join(PUBLIC_DIR, 'stockfish.js'));
  console.log('Stockfish.js copied successfully!');
} catch (err) {
  console.error('Error copying Stockfish.js:', err);
  process.exit(1);
} 
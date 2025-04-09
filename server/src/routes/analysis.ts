import { Request, Response } from 'express';
import { OpenAI } from 'openai';
import { Chess } from 'chess.js';
import { apiRequest } from '@/lib/queryClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = require('express').Router();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { fen, pgn, currentMoveNumber, evaluations, stockfishAnalysis, enableExperiments, userMessage } = req.body;
    
    // Extract previous moves context from PGN
    const previousMovesContext = extractPreviousMovesContext(pgn, currentMoveNumber);
    
    // Format Stockfish analysis in a more structured way
    const formattedStockfishAnalysis = formatStockfishAnalysis(stockfishAnalysis);
    
    // Create a prompt that includes Stockfish analysis and enables experimentation only when requested
    const prompt = `Analyze this chess position:
      FEN: ${fen}
      
      Current Move Number: ${currentMoveNumber + 1}
      
      ${previousMovesContext ? `Previous Moves Context:
${previousMovesContext}` : ''}
      
      ${formattedStockfishAnalysis ? `Engine Analysis:
${formattedStockfishAnalysis}` : ''}

      ${enableExperiments ? `User Question: "${userMessage}"

      You can experiment with moves to answer the user's question by using the following format:
      [EXPERIMENT] move: <move in UCI format>
      [RESULT] fen: <resulting FEN>
      [ANALYSIS] <your analysis of the resulting position>

      To try a move:
      1. Use [EXPERIMENT] move: followed by the move in UCI format (e.g., e2e4)
      2. The system will return the new FEN and Stockfish analysis
      3. You can then analyze the resulting position and explain why it works or doesn't work

      Focus on answering the user's specific question about the move or position.` : ''}

      Please provide a concise analysis of the position, focusing on:
      1. Key tactical and strategic elements
      2. Important threats or opportunities
      3. Suggested plans for both sides
      4. How this position relates to the overall game

      Keep the analysis clear and concise, using chess terminology appropriately.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a chess expert providing concise, insightful analysis of chess positions. 
${enableExperiments ? 'You can experiment with moves to answer specific questions about what happens if certain moves are played. When suggesting moves, use the [EXPERIMENT] format to try them out. The system will return the new position and Stockfish analysis for you to evaluate. Focus on explaining why moves work or don\'t work based on the analysis.' : ''}

When analyzing positions, always consider these core chess principles:
1. Piece Activity: Assess how active each piece is and how to improve their positions
2. King Safety: Evaluate king position, pawn shelter, and potential attacks
3. Pawn Structure: Identify pawn weaknesses, islands, chains, and potential pawn breaks
4. Center Control: Determine who controls the center and how this affects the position
5. Material Balance: Consider not just the raw material count but also piece coordination and activity
6. Space Advantage: Look at which side has more space to maneuver
7. Development: Check if all pieces are developed, especially in the opening
8. Tactical Opportunities: Look for pins, forks, discovered attacks, and other tactical motifs
9. Tempo: Pay attention to who has the initiative and how to maintain or gain it
10. Endgame Considerations: When approaching an endgame, assess the potential king activity and pawn promotion possibilities

Focus on key tactical and strategic elements, threats, and opportunities. Use chess terminology appropriately.
Provide concrete, practical advice rather than general statements. When analyzing a position, recommend specific moves or plans.

For any position where the advantage is clear (either a decisive material advantage or a decisive positional advantage), clearly state which side is winning and why.
If the position is sharp or complex, explain the key factors that will determine the outcome.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });

    // If GPT suggests an experiment, process it
    const content = response.choices[0].message.content || '';
    if (enableExperiments && content.includes('[EXPERIMENT]')) {
      const experimentMatch = content.match(/\[EXPERIMENT\] move: ([a-h][1-8][a-h][1-8][nbrq]?)/);
      if (experimentMatch) {
        const move = experimentMatch[1];
        // Try the move and get Stockfish analysis
        const experimentResponse = await fetch('/api/experiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fen, move })
        });
        const experimentData = await experimentResponse.json();
        
        if (experimentData.success) {
          // Add the experiment results to the analysis
          const updatedContent = content + `\n\nExperiment Results:\n[RESULT] fen: ${experimentData.fen}\n[ANALYSIS] ${experimentData.analysis}`;
          res.json({ analysis: updatedContent });
          return;
        }
      }
    }

    res.json({ analysis: content });
  } catch (error) {
    console.error('Error in analysis endpoint:', error);
    res.status(500).json({ error: 'Failed to analyze position' });
  }
});

// Add new endpoint for move experimentation
router.post('/experiment', async (req: Request, res: Response) => {
  try {
    const { fen, move } = req.body;
    
    // Create a new chess instance to validate and apply the move
    const chess = new Chess(fen);
    try {
      // Use strict mode for move validation
      chess.move(move, { strict: false });
      const newFen = chess.fen();
      
      // Get Stockfish evaluation of the new position
      const response = await apiRequest('POST', '/api/analyze', {
        fen: newFen,
        pgn: '', // We don't need PGN for experiments
        currentMoveNumber: 0,
        evaluations: [],
        stockfishAnalysis: '',
        enableExperiments: false // Don't enable further experiments
      });
      
      const data = await response.json();
      
      res.json({
        success: true,
        fen: newFen,
        analysis: data.analysis
      });
    } catch (error) {
      res.json({
        success: false,
        error: 'Invalid move'
      });
    }
  } catch (error) {
    console.error('Error in experiment endpoint:', error);
    res.status(500).json({ error: 'Failed to experiment with move' });
  }
});

/**
 * Format Stockfish analysis in a more structured way
 */
function formatStockfishAnalysis(stockfishAnalysis: string): string {
  if (!stockfishAnalysis) return '';
  
  // If already structured properly, return as is
  if (stockfishAnalysis.includes('EVALUATION') && stockfishAnalysis.includes('BEST MOVE') && stockfishAnalysis.includes('BEST LINE')) {
    return stockfishAnalysis;
  }
  
  // Parse the raw stockfish analysis to structure it better
  const lines = stockfishAnalysis.split('\n\n');
  
  return lines.map((line, index) => {
    // Extract evaluation, depth, best move and best line
    const evalMatch = line.match(/Evaluation: (M-?\d+|[+-]?\d+\.\d+)/i);
    const depthMatch = line.match(/Depth (\d+)/i);
    const bestMoveMatch = line.match(/Best Move: ([a-zA-Z0-9]+)/i);
    const bestLineMatch = line.match(/Best Line: (.*)/i);
    
    const evaluation = evalMatch ? evalMatch[1] : 'Unknown';
    const depth = depthMatch ? depthMatch[1] : 'Unknown';
    const bestMove = bestMoveMatch ? bestMoveMatch[1] : 'Unknown';
    const bestLine = bestLineMatch ? bestLineMatch[1] : 'Unknown';
    
    return `VARIATION ${index + 1}:
  DEPTH: ${depth}
  EVALUATION: ${evaluation}
  BEST MOVE: ${bestMove}
  BEST LINE: ${bestLine}`;
  }).join('\n\n');
}

/**
 * Extract the previous moves leading to the current position
 */
function extractPreviousMovesContext(pgn: string, currentMoveIndex: number): string {
  if (!pgn || currentMoveIndex < 0) return '';
  
  try {
    // Create a new chess game and load the PGN
    const chess = new Chess();
    chess.loadPgn(pgn);
    
    // Get the move history
    const history = chess.history({ verbose: true });
    
    // Return empty string if we're at the starting position
    if (currentMoveIndex < 0 || history.length === 0) return '';
    
    // Extract the last few moves (up to 5) leading to the current position
    const movesToShow = Math.min(5, currentMoveIndex + 1);
    const relevantMoves = history.slice(Math.max(0, currentMoveIndex + 1 - movesToShow), currentMoveIndex + 1);
    
    // Format the moves with numbers and annotations
    let formattedMoves = '';
    let moveNumber = Math.floor((history.length - relevantMoves.length) / 2) + 1;
    
    for (let i = 0; i < relevantMoves.length; i++) {
      const move = relevantMoves[i];
      if (i === 0 || move.color === 'w') {
        formattedMoves += `${moveNumber}. `;
        if (move.color === 'b') {
          formattedMoves += '... ';
        }
        moveNumber++;
      }
      formattedMoves += `${move.san} `;
    }
    
    return `Last ${movesToShow} moves leading to the current position:\n${formattedMoves.trim()}`;
  } catch (error) {
    console.error('Error extracting previous moves context:', error);
    return '';
  }
}

module.exports = router; 
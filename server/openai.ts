import OpenAI from "openai";
import { AnalysisRequest, AnalysisResponse } from "@shared/types";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Create a detailed analysis of the current chess position
export async function analyzePosition(request: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const { fen, pgn, currentMoveNumber, question } = request;
    
    // Construct the prompt based on whether this is a general analysis or a specific question
    const prompt = question
      ? `Analyze this chess position and answer the following question: "${question}".
         FEN: ${fen}
         Current move number: ${currentMoveNumber}
         The game so far (in PGN format):
         ${pgn}
         
         Provide a detailed, educational response explaining the ideas, strategies, and tactical opportunities in this position. Include specific chess concepts when relevant.`
      : `Analyze this chess position:
         FEN: ${fen}
         Current move number: ${currentMoveNumber}
         The game so far (in PGN format):
         ${pgn}
         
         Provide a detailed analysis of this position, including:
         1. An evaluation of the position (who stands better and why)
         2. Key strategic elements (pawn structure, piece activity, king safety)
         3. Any tactical opportunities
         4. Potential plans for both sides
         
         Explain in a clear, educational way that would help a chess student understand the position deeply.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a helpful chess coach and analysis assistant. You explain chess positions and ideas clearly, focusing on the most important elements and using proper chess terminology. Your explanations are educational and helpful for chess players looking to improve."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    return {
      analysis: response.choices[0].message.content || "Analysis unavailable",
      suggestedMoves: [] // Could expand this in the future with specific move suggestions
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    let errorMessage = "Sorry, I couldn't analyze this position. Please try again later.";
    
    // Check for rate limit or quota errors
    if (error && typeof error === 'object') {
      if ('status' in error && error.status === 429) {
        errorMessage = "Rate limit exceeded for the OpenAI API. Either wait a minute and try again, or check your OpenAI account quota.";
      } else if ('code' in error && error.code === 'insufficient_quota') {
        errorMessage = "Your OpenAI API key has insufficient quota. Please check your billing details in your OpenAI account.";
      } else if (!process.env.OPENAI_API_KEY) {
        errorMessage = "OpenAI API key is missing. Please provide a valid API key in the environment variables.";
      }
    }
    
    // Add an alternative analysis using Stockfish evaluation if available
    if (request.engineEvaluation) {
      const { score, bestMove, bestLine, depth } = request.engineEvaluation;
      let engineAnalysis = "\n\n**Stockfish Engine Analysis (Depth " + depth + "):**\n\n";
      
      // Format the score for human readability
      if (score.includes('#')) {
        // It's a mate score
        const mateNumber = parseInt(score.replace('#', ''));
        const side = mateNumber > 0 ? "White" : "Black";
        engineAnalysis += `Mate in ${Math.abs(mateNumber)} for ${side}\n`;
      } else {
        // It's a centipawn score
        const cpScore = parseFloat(score) / 100; // Convert centipawns to pawns
        if (cpScore > 0) {
          engineAnalysis += `White is ahead by ${cpScore.toFixed(2)} pawns\n`;
        } else if (cpScore < 0) {
          engineAnalysis += `Black is ahead by ${Math.abs(cpScore).toFixed(2)} pawns\n`;
        } else {
          engineAnalysis += "The position is equal\n";
        }
      }
      
      // Add best move information
      if (bestMove) {
        engineAnalysis += `Best move: ${bestMove}\n`;
      }
      
      // Add the suggested line if available
      if (bestLine && bestLine.length > 0) {
        engineAnalysis += `Best line: ${bestLine}\n`;
      }
      
      errorMessage += engineAnalysis;
    }
    
    return {
      analysis: errorMessage,
      suggestedMoves: []
    };
  }
}

import OpenAI from "openai";
import { AnalysisRequest, AnalysisResponse } from "@shared/types";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "placeholder-key" 
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
      }
    }
    
    return {
      analysis: errorMessage,
      suggestedMoves: []
    };
  }
}

import OpenAI from "openai";
import { AnalysisRequest, AnalysisResponse } from "@shared/types";

const MODEL = "gpt-4-turbo-preview";

let openai: OpenAI;
try {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY
  });
  
} catch (error) {
  console.error("[OpenAI Config] Failed to initialize client:", error);
  openai = new OpenAI({ apiKey: "invalid-key" });
}

export async function analyzePosition(request: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const { fen, pgn, currentMoveNumber, question, stockfishAnalysis, engineEvaluation, detailedEvaluation } = request;
    console.log('Analyzing position:', {
      fen,
      currentMoveNumber,
      hasStockfishAnalysis: !!stockfishAnalysis,
      hasEngineEvaluation: !!engineEvaluation,
      hasDetailedEvaluation: !!detailedEvaluation,
      question
    });

    // Format detailed evaluation if available
    let detailedEvalText = '';
    if (detailedEvaluation) {
      detailedEvalText = `
Detailed Position Metrics:
- Material: ${(detailedEvaluation.materialScore / 100).toFixed(2)}
- Pawn Structure: ${(detailedEvaluation.pawnStructure / 100).toFixed(2)}
- King Safety: White ${(detailedEvaluation.kingAttack.white / 100).toFixed(2)} | Black ${(detailedEvaluation.kingAttack.black / 100).toFixed(2)}
- Mobility: White ${(detailedEvaluation.mobility.white / 100).toFixed(2)} | Black ${(detailedEvaluation.mobility.black / 100).toFixed(2)}
- Space: ${(detailedEvaluation.space / 100).toFixed(2)}
- Passed Pawns: ${(detailedEvaluation.passed / 100).toFixed(2)}
- Tempo: ${(detailedEvaluation.tempo / 100).toFixed(2)}`;
    }
    
    let prompt = '';
    if (question) {
      prompt = `Answer this question about the chess position: "${question}"

Current Position:
FEN: ${fen}
Move number: ${currentMoveNumber}
Game history: ${pgn}

Engine Analysis:
${stockfishAnalysis}

${detailedEvalText ? `\nDetailed Position Metrics:\n${detailedEvalText}` : ''}

Please provide a clear and concise answer, focusing on:
1. The specific question asked
2. The concrete tactical and positional themes shown in the engine analysis
3. The best plans for both sides based on the engine's suggestions
4. Any critical weaknesses or advantages in the position`;
    } else {
      prompt = `Analyze this chess position in two sentences. Focus on the key points.
        FEN: ${fen}
        Current move number: ${currentMoveNumber}
        PGN: ${pgn}
        
        Engine Analysis:
        ${stockfishAnalysis}
        ${detailedEvalText ? `\nPosition Metrics:\n${detailedEvalText}` : ''}
        
        Please analyze this position, considering:
        1. The evaluation of all three top engine lines
        2. The concrete tactical and positional themes
        3. The best plans for both sides based on the engine's suggestions
        4. Any critical weaknesses or advantages shown in the position metrics`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a chess analysis assistant. Focus on explaining critical positions and missed opportunities. 
          
When you have detailed position metrics you may use them to explain the advantages and weaknesses of each side.
Use proper chess terminology and be concise but thorough in your analysis.
When answering questions, make sure to directly address the user's specific query while incorporating relevant insights from the engine analysis.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 500
    });

    return {
      analysis: response.choices[0].message.content || "Analysis unavailable",
      suggestedMoves: []
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      analysis: `Analysis error: ${error instanceof Error ? error.message : String(error)}`,
      suggestedMoves: []
    };
  }
}
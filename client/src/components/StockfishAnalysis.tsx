import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { StockfishService, StockfishEvaluation } from '../lib/stockfishService';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { AnalysisResponse } from '@shared/types';

// Create stockfishService instance
const stockfishService = new StockfishService();

interface StockfishAnalysisProps {
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  onExplanationGenerated: (explanation: string) => void;
  onEvaluationUpdate?: (evaluation: StockfishEvaluation | null) => void;
}

export function StockfishAnalysis({
  fen,
  pgn,
  currentMoveNumber,
  onExplanationGenerated,
  onEvaluationUpdate
}: StockfishAnalysisProps) {
  const [evaluations, setEvaluations] = useState<StockfishEvaluation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset the evaluation when the position changes
    setEvaluations([]);
    setExplanation('');
    
    // Start analysis for the new position
    if (fen) {
      analyzePosition();
    }
    
    // Cleanup when component unmounts
    return () => {
      stockfishService.stopAnalysis();
    };
  }, [fen]);
  
  const analyzePosition = async () => {
    if (!fen || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('Starting Stockfish analysis for FEN:', fen);
      const evalResults = await stockfishService.evaluatePosition(fen, 25);
      console.log('Stockfish analysis results:', evalResults);
      setEvaluations(evalResults);
      
      // Pass the best evaluation (first one) to the parent
      if (evalResults.length > 0) {
        onEvaluationUpdate?.(evalResults[0]);
      }
      
      // Convert moves to SAN notation for all lines
      const updatedEvals = await Promise.all(evalResults.map(async (result) => {
        try {
          const chess = new Chess(fen);
          const move = chess.move({
            from: result.bestMove.substring(0, 2),
            to: result.bestMove.substring(2, 4),
            promotion: result.bestMove.length > 4 ? result.bestMove[4] : undefined
          });
          
          if (move) {
            result.bestMoveSan = move.san;
          }
          
          // Convert the line moves to SAN
          const lineMoves: string[] = [];
          const lineChess = new Chess(fen);
          
          for (const moveStr of result.line) {
            if (moveStr.length >= 4) {
              try {
                const lineMove = lineChess.move({
                  from: moveStr.substring(0, 2),
                  to: moveStr.substring(2, 4),
                  promotion: moveStr.length > 4 ? moveStr[4] : undefined
                });
                
                if (lineMove) {
                  lineMoves.push(lineMove.san);
                }
              } catch (e) {
                console.error('Error converting move to SAN:', e);
              }
            }
          }
          
          return {
            ...result,
            line: lineMoves
          };
        } catch (error) {
          console.error('Error converting moves to SAN:', error);
          return result;
        }
      }));
      
      setEvaluations(updatedEvals);
    } catch (err) {
      console.error('Error in Stockfish analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const getExplanation = async () => {
    if (!fen || !evaluations.length || isExplaining) return;
    
    setIsExplaining(true);
    
    try {
      // Format evaluation for the API
      const formattedEval = evaluations[0].type === 'cp' 
        ? (evaluations[0].value / 100).toFixed(2) 
        : `Mate in ${Math.abs(evaluations[0].value)}`;
      
      const bestLine = evaluations[0].line.length > 0
        ? evaluations[0].line.slice(0, 5).join(' ')
        : evaluations[0].bestMoveSan;
      
      // Request explanation from the API with Stockfish data
      const response = await apiRequest('POST', '/api/analyze-with-engine', {
        fen,
        pgn,
        currentMoveNumber,
        engineEvaluation: {
          score: formattedEval,
          bestMove: evaluations[0].bestMoveSan,
          bestLine,
          depth: evaluations[0].depth
        }
      });
      
      const data: AnalysisResponse = await response.json();
      
      setExplanation(data.analysis);
      if (onExplanationGenerated) {
        onExplanationGenerated(data.analysis);
      }
    } catch (error) {
      console.error('Error getting explanation:', error);
      setExplanation('Sorry, I encountered an error explaining this position. Please try again.');
    } finally {
      setIsExplaining(false);
    }
  };
  
  if (isAnalyzing) {
    return (
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          <span>Analyzing position...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error analyzing position: {error}
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="p-4">
        No evaluation available
      </div>
    );
  }

  return (
    <div className="p-4">
      {evaluations.map((evaluation, index) => {
        const cpScore = evaluation.type === 'cp' ? evaluation.value / 100 : null;
        const side = cpScore === 0 ? 'Equal' : cpScore && cpScore > 0 ? 'White' : 'Black';
        const scoreClass = cpScore && cpScore > 0 ? 'text-white' : cpScore && cpScore < 0 ? 'text-black' : 'text-yellow-500';

        return (
          <div key={index} className={`mb-6 ${index > 0 ? 'border-t pt-4' : ''}`}>
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2">Line {index + 1}</h3>
              <p className={`font-semibold ${scoreClass}`}>
                {evaluation.type === 'cp' ? (
                  <>
                    {side === 'Equal' 
                      ? 'Position is equal' 
                      : `${side} is better by ${Math.abs(cpScore || 0).toFixed(2)} pawns`}
                  </>
                ) : (
                  `Mate in ${Math.abs(evaluation.value)} for ${evaluation.value > 0 ? 'White' : 'Black'}`
                )}
              </p>
            </div>

            {evaluation.bestMoveSan && (
              <div className="mb-4">
                <h4 className="font-semibold mb-1">Best Move</h4>
                <p className="font-mono">{evaluation.bestMoveSan}</p>
              </div>
            )}

            {evaluation.line && evaluation.line.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">Best Line</h4>
                <p className="font-mono text-sm">{evaluation.line.join(' ')}</p>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Explanation section */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">AI Explanation</h3>
          <Button
            size="sm"
            onClick={getExplanation}
            disabled={isExplaining || isAnalyzing || !evaluations.length}
          >
            {isExplaining ? 'Generating...' : 'Explain Position'}
          </Button>
        </div>
        
        <div className="bg-neutral-50 p-3 rounded">
          {isExplaining ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : explanation ? (
            <div className="whitespace-pre-line">
              {explanation.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-neutral-400">
              Click "Explain Position" to get an AI-powered explanation of this position based on the engine analysis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
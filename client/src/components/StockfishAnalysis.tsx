import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { stockfishService, StockfishEvaluation } from '@/lib/stockfishService';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { AnalysisResponse } from '@shared/types';

interface StockfishAnalysisProps {
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  onExplanationGenerated?: (explanation: string) => void;
}

export function StockfishAnalysis({
  fen,
  pgn,
  currentMoveNumber,
  onExplanationGenerated
}: StockfishAnalysisProps) {
  const [evaluation, setEvaluation] = useState<StockfishEvaluation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  
  useEffect(() => {
    // Reset the evaluation when the position changes
    setEvaluation(null);
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
    
    try {
      const result = await stockfishService.evaluatePosition(fen, 18);
      
      // Convert bestMove to SAN notation
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
              // Ignore invalid moves
            }
          }
        }
        
        result.line = lineMoves;
      } catch (error) {
        console.error('Error converting moves to SAN:', error);
      }
      
      setEvaluation(result);
    } catch (error) {
      console.error('Error analyzing position:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const getExplanation = async () => {
    if (!fen || !evaluation || isExplaining) return;
    
    setIsExplaining(true);
    
    try {
      // Format evaluation for the API
      const formattedEval = evaluation.type === 'cp' 
        ? (evaluation.value / 100).toFixed(2) 
        : `Mate in ${Math.abs(evaluation.value)}`;
      
      const bestLine = evaluation.line.length > 0
        ? evaluation.line.slice(0, 5).join(' ')
        : evaluation.bestMoveSan;
      
      // Request explanation from the API with Stockfish data
      const response = await apiRequest('POST', '/api/analyze-with-engine', {
        fen,
        pgn,
        currentMoveNumber,
        engineEvaluation: {
          score: formattedEval,
          bestMove: evaluation.bestMoveSan,
          bestLine,
          depth: evaluation.depth
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
  
  // Format the evaluation for display
  const formatEvaluation = () => {
    if (!evaluation) return 'Analysis pending...';
    
    if (evaluation.type === 'cp') {
      const score = (evaluation.value / 100).toFixed(2);
      const sign = evaluation.value > 0 ? '+' : '';
      return `${sign}${score}`;
    } else {
      // Mate score
      const moves = Math.abs(evaluation.value);
      const side = evaluation.value > 0 ? 'White' : 'Black';
      return `Mate in ${moves} for ${side}`;
    }
  };
  
  return (
    <div className="bg-white p-4 rounded shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Engine Analysis</h3>
        <div className="flex items-center">
          <span className="mr-2 font-medium">Depth: {evaluation?.depth || '--'}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={analyzePosition}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Refresh'}
          </Button>
        </div>
      </div>
      
      {/* Engine evaluation display */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-sm text-neutral-500 mb-1">Evaluation</h4>
          <div className={`text-xl font-bold ${
            evaluation?.value && evaluation.value > 0 
              ? 'text-green-600' 
              : evaluation?.value && evaluation.value < 0 
                ? 'text-red-600' 
                : 'text-neutral-600'
          }`}>
            {isAnalyzing ? '...' : formatEvaluation()}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm text-neutral-500 mb-1">Best Move</h4>
          <div className="text-xl font-medium">
            {isAnalyzing 
              ? '...' 
              : evaluation?.bestMoveSan || 'N/A'
            }
          </div>
        </div>
        
        <div>
          <h4 className="text-sm text-neutral-500 mb-1">Best Line</h4>
          <div className="text-sm">
            {isAnalyzing 
              ? '...' 
              : evaluation?.line.slice(0, 3).join(' ') || 'N/A'
            }
          </div>
        </div>
      </div>
      
      {/* Explanation section */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">AI Explanation</h3>
          <Button
            size="sm"
            onClick={getExplanation}
            disabled={isExplaining || isAnalyzing || !evaluation}
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
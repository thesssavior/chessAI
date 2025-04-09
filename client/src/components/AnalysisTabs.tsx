import React, { useState, useEffect } from 'react';
import { MoveList } from './MoveList';
import { ChatInterface } from './ChatInterface';
import { apiRequest } from '@/lib/queryClient';
import { GameState, ChatMessage, AnalysisResponse, ChessMove } from '@shared/types';
import { EvaluationGraph } from './EvaluationGraph';
import { StockfishService, DetailedEvaluation, StockfishEvaluation } from '../lib/stockfishService';
import { Chess } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import './AnalysisTabs.css';
import { StockfishAnalysis } from './StockfishAnalysis';

// Create stockfishService instance
const stockfishService = new StockfishService();

export interface TemporaryBranchInfo {
  baseMoveIndex: number;
  moves: ChessMove[];
  positionAfterFirstMove: string;
  name?: string;
}

interface AnalysisTabsProps {
  gameState: GameState;
  onMoveClick: (index: number) => void;
  gameId: string;
  temporaryBranch: { baseMoveIndex: number; moves: ChessMove[]; fen: string } | null;
  onTemporaryBranchChange: (branch: { baseMoveIndex: number; moves: ChessMove[]; fen: string } | null) => void;
  onFenChange: (fen: string) => void;
}

// Add a new DetailedEval component
const DetailedEval: React.FC<{ fen: string }> = ({ fen }) => {
  const [detailedEval, setDetailedEval] = useState<DetailedEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetailedEval = async () => {
    setLoading(true);
    setError(null);
    try {
      const evaluation = await stockfishService.getDetailedEvaluation(fen);
      setDetailedEval(evaluation);
    } catch (err) {
      console.error('Error fetching detailed evaluation:', err);
      setError('Failed to fetch detailed evaluation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="detailed-evaluation p-8 flex flex-col items-center justify-center">
        <div className="loading-spinner mb-4"></div>
        <p className="text-gray-400">Analyzing position metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detailed-evaluation p-6">
        <div className="error">
          <h3 className="text-red-400 font-medium mb-2">Analysis Error</h3>
          <p>{error}</p>
          <button 
            onClick={fetchDetailedEval} 
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!detailedEval) {
    return (
      <div className="detailed-evaluation p-8 flex flex-col items-center justify-center">
        <p className="text-gray-400 mb-4">Get detailed position metrics to understand advantages and weaknesses</p>
        <button 
          onClick={fetchDetailedEval} 
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
          </svg>
          Analyze Position Metrics
        </button>
      </div>
    );
  }

  return (
    <div className="detailed-evaluation p-4">
      <div className="grid grid-cols-1 gap-2">
        <div className="eval-header">
          <h3 className="font-bold text-xl mb-2">Position Assessment: {(detailedEval.totalEvaluation / 100).toFixed(2)}</h3>
          <p className="text-sm text-gray-500 mb-4">{detailedEval.totalEvaluation > 0 ? 'White' : 'Black'} has the advantage</p>
        </div>
        
        {/* Main metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Left column - Material & Structure */}
          <div className="space-y-3">
            <MetricItem 
              label="Material" 
              value={detailedEval.materialScore} 
              max={200} 
            />
            
            <MetricItem 
              label="Pawn Structure" 
              value={detailedEval.pawnStructure} 
              max={100} 
            />
            
            <MetricItem 
              label="Space Control" 
              value={detailedEval.space} 
              max={100} 
            />
            
            <MetricItem 
              label="Passed Pawns" 
              value={detailedEval.passed} 
              max={100} 
            />
          </div>
          
          {/* Right column - Piece Activity & King Safety */}
          <div className="space-y-3">
            <ComparativeMetric 
              label="Piece Activity" 
              white={detailedEval.mobility.white} 
              black={detailedEval.mobility.black} 
              max={200}
            />
            
            <ComparativeMetric 
              label="King Safety" 
              white={detailedEval.kingAttack.white} 
              black={detailedEval.kingAttack.black} 
              max={100}
            />
            
            <ComparativeMetric 
              label="Piece Placement" 
              white={detailedEval.pieceSquares.white} 
              black={detailedEval.pieceSquares.black} 
              max={200}
            />
            
            <MetricItem 
              label="Initiative" 
              value={detailedEval.tempo} 
              max={50} 
            />
          </div>
        </div>
        
        {/* Debug section */}
        <div className="mt-4">
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">Debug Raw Output</summary>
            <pre className="mt-2 p-3 bg-gray-800 text-gray-300 text-xs overflow-auto max-h-64 rounded">
              {detailedEval.raw}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

// Helper components for detailed evaluation display
const MetricItem = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const absValue = Math.abs(value);
  const percentage = Math.min(Math.round((absValue / max) * 100), 100);
  const color = value > 0 ? '#88c0d0' : value < 0 ? '#bf616a' : '#d8dee9';
  const formattedValue = (value / 100).toFixed(2);
  const side = value > 0 ? 'White' : value < 0 ? 'Black' : 'Equal';
  
  return (
    <div className="metric-item">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm">{formattedValue} ({side})</span>
      </div>
      <div className="h-2 bg-gray-700 rounded overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

const ComparativeMetric = ({ 
  label, 
  white, 
  black,
  max 
}: { 
  label: string; 
  white: number; 
  black: number;
  max: number;
}) => {
  const whitePercentage = Math.min(Math.round((white / max) * 100), 100);
  const blackPercentage = Math.min(Math.round((black / max) * 100), 100);
  
  return (
    <div className="comparative-metric">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <div className="flex justify-between">
            <span className="text-xs">White</span>
            <span className="text-xs">{(white / 100).toFixed(2)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${whitePercentage}%`,
                backgroundColor: '#88c0d0',
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <span className="text-xs">Black</span>
            <span className="text-xs">{(black / 100).toFixed(2)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${blackPercentage}%`,
                backgroundColor: '#bf616a',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add this component near the DetailedEval component
const SimpleExplainer: React.FC<{ 
  fen: string; 
  evaluation: {
    type: string;
    value: number;
    depth: number;
    bestMoveSan?: string;
    bestMove?: string;
    line?: string[];
  } | null 
}> = ({ fen, evaluation }) => {
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const getExplanation = async () => {
    if (!fen || !evaluation) return;
    setIsLoading(true);
    
    try {      
      // Format evaluation for the API
      const formattedEval = evaluation.type === 'cp' 
        ? (evaluation.value / 100).toFixed(2) 
        : `Mate in ${Math.abs(evaluation.value)}`;
      
      const bestLine = evaluation.line && evaluation.line.length > 0
        ? evaluation.line.slice(0, 5).join(' ')
        : evaluation.bestMoveSan;
      
      const engineEvaluation = {
        score: formattedEval,
        bestMove: evaluation.bestMoveSan || evaluation.bestMove,
        bestLine,
        depth: evaluation.depth
      };
      
      console.log("Sending direct fetch for explanation...");
      
      // Try a direct fetch to test server connectivity
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          engineEvaluation,
          question: "Explain this position briefly"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Explanation data:", data);
      
      setExplanation(data.analysis || "No explanation available");
    } catch (error) {
      console.error("Failed to get explanation:", error);
      setExplanation(`Could not get AI explanation. Server might be offline.\n\nError: ${(error as Error).message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!evaluation) {
    return (
      <div className="p-4 bg-gray-800 rounded-md text-gray-300">
        <p>Analyze the position first to get Stockfish evaluation</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800 rounded-md text-gray-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Position Explanation</h3>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          onClick={getExplanation}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Get AI Explanation'}
        </button>
      </div>
      
      {explanation ? (
        <div className="whitespace-pre-wrap mt-4">{explanation}</div>
      ) : (
        <p className="text-gray-500">Click the button to get AI analysis of this position</p>
      )}
    </div>
  );
};

// Modify the API key status section to always show ready
const apiKeyStatus = {
  isValid: true,
  message: "API connection ready"
};

// Render the Stockfish evaluation in a user-friendly format
function renderStockfishEvaluation(evaluation: {
  type: string;
  value: number;
  depth: number;
  bestMoveSan?: string;
  bestMove?: string;
  line?: string[];
}) {
  // Handle mate scores
  if (evaluation.type === 'mate') {
    const side = evaluation.value > 0 ? 'White' : 'Black';
    return (
      <div>
        <p className="font-bold">
          <span className={evaluation.value > 0 ? 'text-white' : 'text-gray-500'}>
            {side} has mate in {Math.abs(evaluation.value)}
          </span>
        </p>
        {evaluation.bestMoveSan && (
          <p className="mt-1">
            Best move: <span className="font-semibold">{evaluation.bestMoveSan}</span>
          </p>
        )}
        {evaluation.line && evaluation.line.length > 0 && (
          <p className="mt-1 text-gray-400 text-sm">
            Line: {evaluation.line.slice(0, 5).join(' ')}
          </p>
        )}
      </div>
    );
  }
  
  // Handle centipawn scores
  const cpScore = evaluation.value / 100;
  const side = cpScore > 0 ? 'White' : cpScore < 0 ? 'Black' : 'Equal';
  const scoreClass = cpScore > 0 ? 'text-white' : cpScore < 0 ? 'text-gray-500' : 'text-yellow-500';
  
  return (
    <div>
      <p className="font-bold">
        <span className={scoreClass}>
          {side === 'Equal' 
            ? 'Position is equal' 
            : `${side} is better by ${Math.abs(cpScore).toFixed(2)} pawns`}
        </span>
      </p>
      {evaluation.bestMoveSan && (
        <p className="mt-1">
          Best move: <span className="font-semibold">{evaluation.bestMoveSan}</span>
        </p>
      )}
      {evaluation.line && evaluation.line.length > 0 && (
        <p className="mt-1 text-gray-400 text-sm">
          Line: {evaluation.line.slice(0, 5).join(' ')}
        </p>
      )}
    </div>
  );
}

export function AnalysisTabs({
  gameState,
  onMoveClick,
  gameId,
  temporaryBranch,
  onTemporaryBranchChange,
  onFenChange,
}: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<'moves' | 'analysis'>('moves');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [evaluations, setEvaluations] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentFen, setCurrentFen] = useState(gameState.fen);
  const [currentEvaluation, setCurrentEvaluation] = useState<StockfishEvaluation | null>(null);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        // Go to previous move
        if (currentMoveIndex > -1) {
          handleMoveClick(currentMoveIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        // Go to next move
        if (currentMoveIndex < gameState.history.length - 1) {
          handleMoveClick(currentMoveIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, gameState.history.length]);

  // Update currentFen when gameState.fen changes
  useEffect(() => {
    setCurrentFen(gameState.fen);
    // Reset evaluation when position changes
    setCurrentEvaluation(null);
  }, [gameState.fen]);

  // Handle move clicks
  const handleMoveClick = (index: number) => {
    setCurrentMoveIndex(index);
    onMoveClick(index);
  };

  // Update explanation from Stockfish analysis
  const handleExplanationUpdate = (explanation: string) => {
    setAnalysis(explanation);
  };

  // Handle chat messages update
  const handleMessagesUpdate = (updatedMessages: ChatMessage[]) => {
    setMessages(updatedMessages);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="moves" className="w-full">
        <TabsList>
          <TabsTrigger value="moves">Moves</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="moves" className="flex-grow">
          <div className="h-[400px] overflow-y-auto">
            <MoveList
              history={gameState.history}
              currentMoveIndex={currentMoveIndex}
              onMoveClick={handleMoveClick}
              temporaryBranch={temporaryBranch}
            />
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="flex-grow">
          <div className="h-[400px] overflow-y-auto">
            <StockfishAnalysis
              fen={currentFen}
              pgn={gameState.pgn}
              currentMoveNumber={currentMoveIndex}
              onExplanationGenerated={handleExplanationUpdate}
              onEvaluationUpdate={setCurrentEvaluation}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Analysis Chat below moves list */}
      <div className="mt-4 border-t pt-4">
        <ChatInterface
          gameId={gameId}
          fen={currentFen}
          pgn={gameState.history.map(move => move.san).join(' ')}
          currentMoveNumber={currentMoveIndex}
          messages={messages}
          onMessagesUpdate={handleMessagesUpdate}
          evaluation={currentEvaluation}
        />
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chess } from 'chess.js';
import { stockfishService } from '@/lib/stockfishService';

interface ChatInterfaceProps {
  gameId: string;
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  messages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  evaluation?: {
    type: string;
    value: number;
    depth?: number;
    bestMoveSan?: string;
    line?: string[];
  } | null;
}

export function ChatInterface({
  gameId,
  fen,
  pgn,
  currentMoveNumber,
  messages,
  onMessagesUpdate,
  evaluation
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };
    
    // Add user message to UI immediately
    const updatedMessages = [...messages, userMessage];
    onMessagesUpdate(updatedMessages);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Run Stockfish analysis first
      console.log('Running Stockfish analysis for position:', fen);
      const stockfishEval = await stockfishService.evaluatePosition(fen, 25);
      console.log('Stockfish analysis results:', stockfishEval);

      // Convert moves to SAN notation
      const chess = new Chess();
      
      // Load the game history to create proper PGN
      const moves = pgn.split('\n')
        .filter(line => !line.startsWith('[') && line.trim().length > 0)
        .join(' ')
        .trim();
      
      if (moves) {
        chess.loadPgn(moves);
      } else {
        chess.load(fen);
      }

      const processedEvals = await Promise.all(stockfishEval.map(async (result) => {
        try {
          // Convert best move to SAN
          const move = chess.move({
            from: result.bestMove.substring(0, 2),
            to: result.bestMove.substring(2, 4),
            promotion: result.bestMove.length > 4 ? result.bestMove[4] : undefined
          });
          
          if (move) {
            result.bestMoveSan = move.san;
            chess.undo(); // Undo the move to keep position clean
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

      // Format the analysis for the API
      const analysisText = processedEvals.map((evaluation, index) => {
        const score = evaluation.type === 'cp' 
          ? (evaluation.value / 100).toFixed(2) 
          : `Mate in ${Math.abs(evaluation.value)}`;
        
        return `Line ${index + 1}:
Score: ${score}
Best move: ${evaluation.bestMoveSan || evaluation.bestMove}
Best line: ${evaluation.line.slice(0, 5).join(' ')}`;
      }).join('\n\n');

      // Use the first evaluation as the current evaluation
      const currentEval = processedEvals[0];

      // Create context for the AI
      const gameContext = {
        fen,
        pgn: chess.pgn(), // Use clean PGN from chess.js with proper move history
        currentMoveNumber,
        evaluation: currentEval ? {
          type: currentEval.type,
          value: currentEval.value,
          bestMove: currentEval.bestMoveSan || currentEval.bestMove,
          line: currentEval.line.slice(0, 5),
          depth: currentEval.depth
        } : null,
        stockfishAnalysis: analysisText
      };
      
      // Get AI response
      console.log('Sending request with context:', gameContext);
      const response = await apiRequest('POST', '/api/chats', {
        gameId,
        messages: updatedMessages,
        context: gameContext
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add AI response to messages
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      };
      
      onMessagesUpdate([...updatedMessages, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      onMessagesUpdate([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 max-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-gray-500 italic">
            Ask me about this position, potential improvements, or strategic ideas.
            {evaluation && (
              <div className="mt-2">
                <p>Current evaluation: {evaluation.type === 'cp' 
                  ? `${(evaluation.value / 100).toFixed(1)}` 
                  : `Mate in ${evaluation.value}`}
                </p>
                {evaluation.bestMoveSan && (
                  <p>Best move: {evaluation.bestMoveSan}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
                }`}
              >
                <div className="font-bold mb-1">
                  {message.role === 'user' ? 'You' : 'Chess Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                <div className="font-bold mb-1">Chess Assistant</div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this position..."
          disabled={isLoading}
          className="flex-1 mr-2"
        />
        <Button 
          onClick={handleSendMessage} 
          disabled={isLoading || !inputValue.trim()}
          className={`min-w-[80px] ${isLoading ? 'opacity-50' : ''}`}
        >
          {isLoading ? 'Thinking...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}

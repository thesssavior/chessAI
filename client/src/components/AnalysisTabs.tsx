import React, { useState } from 'react';
import { MoveList } from './MoveList';
import { ChatInterface } from './ChatInterface';
import { apiRequest } from '@/lib/queryClient';
import { GameState, ChatMessage, AnalysisResponse } from '@shared/types';

interface AnalysisTabsProps {
  gameState: GameState;
  onMoveClick: (index: number) => void;
  gameId: string;
}

export function AnalysisTabs({ gameState, onMoveClick, gameId }: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');
  const [analysis, setAnalysis] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Fetch position analysis when the current move changes
  React.useEffect(() => {
    const fetchAnalysis = async () => {
      if (gameState.history.length === 0) return;
      
      setIsAnalysisLoading(true);
      try {
        const response = await apiRequest('POST', '/api/analyze', {
          fen: gameState.fen,
          pgn: gameState.pgn,
          currentMoveNumber: gameState.currentMoveIndex,
        });
        
        const data: AnalysisResponse = await response.json();
        setAnalysis(data.analysis);
      } catch (error) {
        console.error('Error fetching analysis:', error);
        setAnalysis('Analysis unavailable. Please try again later.');
      } finally {
        setIsAnalysisLoading(false);
      }
    };

    fetchAnalysis();
  }, [gameState.currentMoveIndex, gameState.fen, gameState.pgn, gameState.history.length]);

  // Load chat messages for this game
  React.useEffect(() => {
    const fetchChatMessages = async () => {
      try {
        const response = await fetch(`/api/chats/game/${gameId}`);
        if (response.ok) {
          const chatData = await response.json();
          setMessages(chatData.messages);
        }
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      }
    };

    if (gameId) {
      fetchChatMessages();
    }
  }, [gameId]);

  const handleTabChange = (tab: 'moves' | 'chat') => {
    setActiveTab(tab);
  };

  const handleMessagesUpdate = (updatedMessages: ChatMessage[]) => {
    setMessages(updatedMessages);
  };

  return (
    <div className="bg-white rounded shadow-sm">
      <div className="flex border-b">
        <button
          className={`flex-1 py-3 font-medium focus:outline-none ${
            activeTab === 'moves' ? 'tab-active' : 'text-neutral-300 hover:text-neutral-400'
          }`}
          onClick={() => handleTabChange('moves')}
        >
          Moves
        </button>
        <button
          className={`flex-1 py-3 font-medium focus:outline-none ${
            activeTab === 'chat' ? 'tab-active' : 'text-neutral-300 hover:text-neutral-400'
          }`}
          onClick={() => handleTabChange('chat')}
        >
          Analysis Chat
        </button>
      </div>

      {/* Moves Tab Content */}
      <div className={`p-4 ${activeTab !== 'moves' ? 'hidden' : ''}`}>
        <MoveList
          history={gameState.history}
          currentMoveIndex={gameState.currentMoveIndex}
          onMoveClick={onMoveClick}
          result={gameState.metadata.result}
        />

        {/* Position Analysis */}
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Position Analysis</h3>
          <div className="bg-neutral-100 p-4 rounded">
            {isAnalysisLoading ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : gameState.history.length === 0 ? (
              <p>Load a game to see position analysis.</p>
            ) : (
              <>
                <div className="whitespace-pre-line">
                  {analysis.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                  ))}
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  Ask a follow-up question in the Analysis Chat tab.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Tab Content */}
      <div className={`p-4 ${activeTab !== 'chat' ? 'hidden' : ''}`}>
        <ChatInterface
          gameId={gameId}
          fen={gameState.fen}
          pgn={gameState.pgn}
          currentMoveNumber={gameState.currentMoveIndex}
          messages={messages}
          onMessagesUpdate={handleMessagesUpdate}
        />
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { ChatMessage, AnalysisResponse } from '@shared/types';

interface ChatInterfaceProps {
  gameId: string;
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  messages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
}

export function ChatInterface({
  gameId,
  fen,
  pgn,
  currentMoveNumber,
  messages,
  onMessagesUpdate,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    onMessagesUpdate(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Send to API for analysis
      const response = await apiRequest('POST', '/api/analyze', {
        fen,
        pgn,
        currentMoveNumber,
        question: input,
      });
      
      const analysisData: AnalysisResponse = await response.json();
      
      // Add response from AI
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: analysisData.analysis,
        timestamp: Date.now(),
      };
      
      onMessagesUpdate([...updatedMessages, aiMessage]);
      
      // Save the updated chat history
      await apiRequest('POST', '/api/chats', {
        gameId,
        messages: [...updatedMessages, aiMessage],
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error analyzing this position. Please try again.',
        timestamp: Date.now(),
      };
      
      onMessagesUpdate([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div>
      <div 
        ref={chatContainerRef}
        className="chat-container mb-4 h-[300px] overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="text-center text-neutral-300 mt-20">
            Ask a question about the current position
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index}
              className={`flex ${message.role === 'user' ? '' : 'justify-end'}`}
            >
              <div 
                className={`chat-bubble max-w-[80%] mb-3 p-3 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-neutral-100' 
                    : 'bg-primary bg-opacity-10'
                }`}
              >
                {message.role === 'user' && <p className="font-bold">You:</p>}
                <div className="whitespace-pre-line">
                  {message.content.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-end">
            <div className="chat-bubble bg-primary bg-opacity-10 max-w-[80%] mb-3 p-3 rounded-2xl">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ask about the current position..."
          className="px-4 py-2 border border-neutral-200 rounded-l focus:outline-none focus:ring-2 focus:ring-primary flex-grow"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button
          className={`${
            isLoading ? 'bg-neutral-300' : 'bg-primary hover:bg-blue-700'
          } text-white px-4 py-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center`}
          onClick={handleSendMessage}
          disabled={isLoading}
        >
          <span className="material-icons mr-1">send</span>
          Send
        </button>
      </div>
    </div>
  );
}

// We'll use a simplified interface for Engine type
interface Engine {
  postMessage: (message: string) => void;
  onmessage: ((event: MessageEvent) => void) | null;
}

// Interface for Stockfish evaluation
export interface StockfishEvaluation {
  type: 'cp' | 'mate'; // centipawns or mate
  value: number;
  bestMove: string;
  bestMoveSan: string;
  depth: number;
  line: string[];
}

export class StockfishService {
  private engine: Engine | null = null;
  private isReady = false;
  private depth = 15; // Default analysis depth
  private isAnalyzing = false;
  private currentResolve: ((evaluation: StockfishEvaluation) => void) | null = null;
  private currentReject: ((reason: any) => void) | null = null;
  
  constructor() {
    this.initEngine();
  }
  
  private async initEngine() {
    try {
      // Dynamically import the engine
      const worker = new Worker('/stockfish.js');
      
      this.engine = {
        postMessage: (message: string) => worker.postMessage(message),
        onmessage: null
      };
      
      // Set up event listeners
      worker.onmessage = (event: MessageEvent) => {
        if (this.engine && this.engine.onmessage) {
          this.engine.onmessage(event);
        }
        this.handleEngineMessage(event.data);
      };
      
      // Initialize the engine
      this.engine.postMessage('uci');
      this.engine.postMessage('isready');
      
      // Wait for the engine to be ready
      await new Promise<void>((resolve) => {
        const checkReady = setInterval(() => {
          if (this.isReady) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      });
      
      // Set some default options
      this.engine.postMessage('setoption name MultiPV value 3');
      this.engine.postMessage('setoption name Threads value 4');
    } catch (error) {
      console.error('Failed to initialize Stockfish engine:', error);
    }
  }
  
  private handleEngineMessage(message: string) {
    // Check if the engine is ready
    if (message === 'readyok') {
      this.isReady = true;
      return;
    }
    
    // If we're not analyzing, ignore other messages
    if (!this.isAnalyzing || !this.currentResolve) {
      return;
    }
    
    // Parse evaluation info
    if (message.startsWith('info') && message.includes('score')) {
      const depth = this.extractDepth(message);
      const { type, value } = this.extractScore(message);
      const pv = this.extractPv(message);
      
      // Only process messages that have reached our target depth
      if (depth === this.depth) {
        this.engine?.postMessage('stop');
      }
    }
    
    // Parse best move info
    if (message.startsWith('bestmove')) {
      const bestMove = message.split(' ')[1];
      
      if (this.currentResolve) {
        // Create an evaluation object with all the relevant data
        const evaluation: StockfishEvaluation = {
          type: 'cp', // Default, will be overridden if we parsed a mate score
          value: 0,
          bestMove,
          bestMoveSan: '', // We'll need to convert this from the Chess.js instance
          depth: this.depth,
          line: []
        };
        
        this.currentResolve(evaluation);
        this.isAnalyzing = false;
        this.currentResolve = null;
        this.currentReject = null;
      }
    }
  }
  
  private extractDepth(message: string): number {
    const depthMatch = message.match(/depth (\d+)/);
    return depthMatch ? parseInt(depthMatch[1], 10) : 0;
  }
  
  private extractScore(message: string): { type: 'cp' | 'mate', value: number } {
    if (message.includes('score cp')) {
      const cpMatch = message.match(/score cp ([-\d]+)/);
      return { type: 'cp', value: cpMatch ? parseInt(cpMatch[1], 10) : 0 };
    } else if (message.includes('score mate')) {
      const mateMatch = message.match(/score mate ([-\d]+)/);
      return { type: 'mate', value: mateMatch ? parseInt(mateMatch[1], 10) : 0 };
    }
    return { type: 'cp', value: 0 };
  }
  
  private extractPv(message: string): string[] {
    const pvMatch = message.match(/pv (.+)$/);
    return pvMatch ? pvMatch[1].split(' ') : [];
  }
  
  public async evaluatePosition(fen: string, depth = 15): Promise<StockfishEvaluation> {
    if (!this.engine || !this.isReady) {
      await this.initEngine();
    }
    
    // Set the analysis depth
    this.depth = depth;
    
    // Return a promise that will resolve when the analysis is complete
    return new Promise((resolve, reject) => {
      try {
        this.isAnalyzing = true;
        this.currentResolve = resolve;
        this.currentReject = reject;
        
        // Set the position and start the analysis
        this.engine?.postMessage('position fen ' + fen);
        this.engine?.postMessage('go depth ' + depth);
      } catch (error) {
        this.isAnalyzing = false;
        reject(error);
      }
    });
  }
  
  public stopAnalysis() {
    if (this.isAnalyzing) {
      this.engine?.postMessage('stop');
      this.isAnalyzing = false;
    }
  }
  
  public cleanup() {
    this.stopAnalysis();
    this.engine?.postMessage('quit');
    this.engine = null;
  }
}

// Create a singleton instance
export const stockfishService = new StockfishService();
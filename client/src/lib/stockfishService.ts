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
  multipv: number;
}

// Interface for detailed position evaluation
export interface DetailedEvaluation {
  totalEvaluation: number;  // Overall evaluation in centipawns
  materialScore: number;    // Material balance evaluation
  pawnStructure: number;    // Pawn structure evaluation
  kingAttack: {
    white: number;
    black: number;
  };
  mobility: {
    white: number;
    black: number;
  };
  pieceSquares: {
    white: number;
    black: number;
  };
  tempo: number;             // Tempo evaluation
  passed: number;            // Passed pawns evaluation
  space: number;             // Space evaluation
  otherFactors: number;      // Any additional factors
  raw: string;               // Raw evaluation output for debugging
}

export class StockfishService {
  private engine: Engine | null = null;
  private isReady = false;
  private depth = 15; // Default analysis depth
  private isAnalyzing = false;
  private currentResolve: ((evaluation: StockfishEvaluation[]) => void) | null = null;
  private currentReject: ((reason: any) => void) | null = null;
  private static instance: StockfishService | null = null;
  private static evaluations: StockfishEvaluation[] = [];
  
  constructor() {
    if (StockfishService.instance) {
      return StockfishService.instance;
    }
    StockfishService.instance = this;
    this.initEngine();
  }

  public static getInstance(): StockfishService {
    if (!StockfishService.instance) {
      StockfishService.instance = new StockfishService();
    }
    return StockfishService.instance;
  }
  
  private async initEngine() {
    if (this.isReady) return;
    
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
      this.engine.postMessage('setoption name MultiPV value 3'); // Get top 3 moves
      this.engine.postMessage('setoption name Threads value 4');
      this.engine.postMessage('setoption name Hash value 128');
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
    if (!this.isAnalyzing) {
      return;
    }
    
    // Parse bestmove message
    if (message.startsWith('bestmove') && this.currentResolve) {
      console.log('Received bestmove message:', message);
      // If we get a bestmove message and have evaluations, resolve with them
      if (StockfishService.evaluations.length > 0) {
        console.log('Resolving with evaluations:', StockfishService.evaluations);
        this.currentResolve(StockfishService.evaluations);
        StockfishService.evaluations = []; // Clear for next analysis
      } else {
        console.log('No evaluations found, creating fallback');
        // Fallback to single evaluation if no MultiPV data
        const bestMoveMatch = message.match(/bestmove\s+(\w+)/);
        const bestMove = bestMoveMatch ? bestMoveMatch[1] : '';
        
        const fallbackEval: StockfishEvaluation = {
          type: 'cp',
          value: 0,
          bestMove: bestMove,
          bestMoveSan: '',
          depth: this.depth,
          line: [bestMove],
          multipv: 1
        };
        
        this.currentResolve([fallbackEval]);
      }
      
      this.isAnalyzing = false;
      this.currentResolve = null;
      this.currentReject = null;
      return;
    }
    
    // Parse evaluation info
    if (message.startsWith('info') && message.includes('multipv')) {
      try {
        console.log('Processing info message:', message);
        const depth = this.extractDepth(message);
        const { type, value } = this.extractScore(message);
        const pv = this.extractPv(message);
        const multipv = this.extractMultiPV(message);
        
        // Only process messages at our target depth
        if (depth >= this.depth) {
          console.log(`Found evaluation at depth ${depth}:`, { type, value, pv });
          // Create an evaluation object for this line
          const evaluation: StockfishEvaluation = {
            type,
            value,
            bestMove: pv[0] || '',
            bestMoveSan: '', // We'll convert this later
            depth,
            line: pv,
            multipv
          };
          
          // Add or update evaluation for this multipv
          const existingIndex = StockfishService.evaluations.findIndex(e => e.multipv === multipv);
          if (existingIndex >= 0) {
            StockfishService.evaluations[existingIndex] = evaluation;
          } else {
            StockfishService.evaluations.push(evaluation);
          }
          
          // If we have all 3 lines at target depth, stop analysis
          if (StockfishService.evaluations.length === 3 && StockfishService.evaluations.every(e => e.depth >= this.depth)) {
            console.log('Got all evaluations, stopping analysis');
            this.engine?.postMessage('stop');
          }
        }
      } catch (error) {
        console.error('Error processing Stockfish message:', error);
        if (this.currentReject) {
          this.currentReject(error);
        }
      }
    }
  }
  
  private extractDepth(message: string): number {
    const depthMatch = message.match(/depth (\d+)/);
    return depthMatch ? parseInt(depthMatch[1], 10) : 0;
  }
  
  private extractScore(message: string): { type: 'cp' | 'mate', value: number } {
    try {
      if (message.includes('score cp')) {
        const cpMatch = message.match(/score cp ([-\d]+)/);
        return { type: 'cp', value: cpMatch ? parseInt(cpMatch[1], 10) : 0 };
      } else if (message.includes('score mate')) {
        const mateMatch = message.match(/score mate ([-\d]+)/);
        return { type: 'mate', value: mateMatch ? parseInt(mateMatch[1], 10) : 0 };
      }
    } catch (error) {
      console.error('Error extracting score:', error, 'from message:', message);
    }
    return { type: 'cp', value: 0 };
  }
  
  private extractPv(message: string): string[] {
    // Extract everything after 'pv' until the next 'bestmove' or end of message
    const pvMatch = message.match(/pv\s+([^]*?)(?=\s+bestmove|$)/);
    if (!pvMatch) return [];
    
    // Split the PV into individual moves and filter out invalid ones
    return pvMatch[1]
      .trim()
      .split(/\s+/)
      .filter(move => /^[a-h][1-8][a-h][1-8][nbrq]?$/.test(move));
  }
  
  private extractMultiPV(message: string): number {
    const multipvMatch = message.match(/multipv (\d+)/);
    return multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
  }
  
  public async evaluatePosition(fen: string, depth: number = 25): Promise<StockfishEvaluation[]> {
    if (!this.engine) {
      await this.initEngine();
    }

    if (!this.engine) {
      throw new Error('Failed to initialize Stockfish engine');
    }

    if (this.isAnalyzing) {
      this.stopAnalysis();
    }

    this.depth = depth;
    this.isAnalyzing = true;
    StockfishService.evaluations = []; // Clear previous evaluations

    console.log(`Starting analysis of position ${fen} at depth ${depth}`);

    return new Promise<StockfishEvaluation[]>((resolve, reject) => {
      try {
        this.currentResolve = resolve;
        this.currentReject = reject;

        // Set position and analysis options
        this.engine!.postMessage('setoption name MultiPV value 3'); // Get top 3 moves
        this.engine!.postMessage('setoption name Threads value 4'); // Use 4 threads
        this.engine!.postMessage('setoption name Hash value 128'); // Use 128MB hash
        this.engine!.postMessage('position fen ' + fen);
        
        // Start analysis with specified depth and minimum time
        this.engine!.postMessage(`go depth ${depth} movetime 5000`); // Minimum 5 seconds
        
        // Set a timeout to stop analysis if it takes too long
        setTimeout(() => {
          if (this.isAnalyzing) {
            console.log('Analysis timeout - stopping');
            this.engine!.postMessage('stop');
          }
        }, 30000); // 30 second timeout
      } catch (error) {
        console.error('Error in evaluatePosition:', error);
        this.isAnalyzing = false;
        reject(error);
      }
    });
  }
  
  public stopAnalysis() {
    if (this.isAnalyzing && this.engine) {
      console.log('Stopping ongoing analysis');
      this.engine.postMessage('stop');
      this.isAnalyzing = false;
    }
  }
  
  public cleanup() {
    this.stopAnalysis();
    this.engine?.postMessage('quit');
    this.engine = null;
  }

  /**
   * Get detailed evaluation metrics for the current position
   * @param fen The FEN string of the position to evaluate
   * @returns Detailed evaluation with material balance, pawn structure, etc.
   */
  public async getDetailedEvaluation(fen: string): Promise<DetailedEvaluation> {
    
    if (!this.engine || !this.isReady) {
      await this.initEngine();
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Set up variables to collect evaluation data
        let evalOutput = '';
        let isCapturingEval = false;
        let evalComplete = false;
        
        // Store the original onmessage handler
        const originalOnMessage = this.engine!.onmessage;
        
        // Set a temporary onmessage handler to capture eval output
        this.engine!.onmessage = (event: MessageEvent) => {
          const message = event.data as string;
          
          // Collect all output for debugging
          evalOutput += message + '\n';
          
          // Check if we've received the evaluation header
          if (message.includes('Term') && message.includes('White') && message.includes('Black') && message.includes('Total')) {
            isCapturingEval = true;
          }
          
          // Check if we've captured the complete evaluation output (looking for the Total evaluation line)
          if (isCapturingEval && message.includes('Total evaluation:')) {
            evalComplete = true;
            
            // Reset handler and resolve
            this.engine!.onmessage = originalOnMessage;
            
            // Wait a bit to make sure we capture any additional output
            setTimeout(() => {
              // Parse the evaluation output
              const evaluation = this.parseEvaluationOutput(evalOutput);
              resolve(evaluation);
            }, 100);
          }
        };
        
        // Set position and run eval command
        this.engine!.postMessage('position fen ' + fen);
        this.engine!.postMessage('eval');
        
        // Add a timeout to prevent hanging
        setTimeout(() => {
          if (!evalComplete) {
            this.engine!.onmessage = originalOnMessage;
            reject(new Error('Timeout while waiting for evaluation'));
          }
        }, 5000);
      } catch (error) {
        console.error('Error in getDetailedEvaluation:', error);
        reject(error);
      }
    });
  }

  /**
   * Parse the raw evaluation output from Stockfish
   * @param output The raw evaluation output
   * @returns Structured evaluation data
   */
  private parseEvaluationOutput(output: string): DetailedEvaluation {    
    // Default evaluation structure
    const evaluation: DetailedEvaluation = {
      totalEvaluation: 0,
      materialScore: 0,
      pawnStructure: 0,
      kingAttack: {
        white: 0,
        black: 0,
      },
      mobility: {
        white: 0,
        black: 0,
      },
      pieceSquares: {
        white: 0,
        black: 0,
      },
      tempo: 0,
      passed: 0,
      space: 0,
      otherFactors: 0,
      raw: output,
    };
    
    // Parse total evaluation
    const totalMatch = output.match(/Total evaluation: ([-+]?[0-9]*\.?[0-9]+)/);
    if (totalMatch) {
      evaluation.totalEvaluation = parseFloat(totalMatch[1]) * 100; // Convert to centipawns
    }
    
    // Helper function to extract values from the table
    const extractTableValue = (term: string): { total: number, white: number, black: number } => {
      const regex = new RegExp(`${term}.*?\\|\\s*([-+]?[0-9]*\\.?[0-9]+)\\s+([-+]?[0-9]*\\.?[0-9]+)\\s*\\|\\s*([-+]?[0-9]*\\.?[0-9]+)\\s+([-+]?[0-9]*\\.?[0-9]+)\\s*\\|\\s*([-+]?[0-9]*\\.?[0-9]+)\\s+([-+]?[0-9]*\\.?[0-9]+)`, 'i');
      const match = output.match(regex);
      
      if (match) {
        // Extract MG values (midgame is more relevant for most positions)
        const whiteMg = parseFloat(match[1]);
        const blackMg = parseFloat(match[3]);
        const totalMg = parseFloat(match[5]);
        
        return {
          total: totalMg * 100, // Convert to centipawns
          white: whiteMg * 100,
          black: blackMg * 100
        };
      }
      
      return { total: 0, white: 0, black: 0 };
    };
    
    // Parse material
    const materialValues = extractTableValue('Material');
    evaluation.materialScore = materialValues.total;
    
    // Parse pawns
    const pawnValues = extractTableValue('Pawns');
    evaluation.pawnStructure = pawnValues.total;
    
    // Parse mobility 
    const mobilityValues = extractTableValue('Mobility');
    evaluation.mobility.white = mobilityValues.white;
    evaluation.mobility.black = mobilityValues.black;
    
    // Parse king safety
    const kingSafetyValues = extractTableValue('King safety');
    evaluation.kingAttack.white = kingSafetyValues.white;
    evaluation.kingAttack.black = kingSafetyValues.black;
    
    // Parse initiative/tempo
    const initiativeValues = extractTableValue('Initiative');
    evaluation.tempo = initiativeValues.total;
    
    // Parse bishops, knights, rooks, queens for piece placement
    const bishopsValues = extractTableValue('Bishops');
    const knightsValues = extractTableValue('Knights');
    const rooksValues = extractTableValue('Rooks');
    const queensValues = extractTableValue('Queens');
    
    evaluation.pieceSquares.white = bishopsValues.white + knightsValues.white + rooksValues.white + queensValues.white;
    evaluation.pieceSquares.black = bishopsValues.black + knightsValues.black + rooksValues.black + queensValues.black;
    
    // Parse threats
    const threatsValues = extractTableValue('Threats');
    evaluation.otherFactors = threatsValues.total;
    
    // Parse passed pawns
    const passedValues = extractTableValue('Passed');
    evaluation.passed = passedValues.total;
    
    // Parse space
    const spaceValues = extractTableValue('Space');
    evaluation.space = spaceValues.total;
    
    return evaluation;
  }
}

// Create a singleton instance
export const stockfishService = StockfishService.getInstance();
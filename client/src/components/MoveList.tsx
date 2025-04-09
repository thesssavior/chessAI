import React from 'react';
import { ChessMove } from '@shared/types';

interface MoveListProps {
  history: ChessMove[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  result?: string;
  temporaryBranch?: {
    baseMoveIndex: number;
    moves: ChessMove[];
  } | null;
}

export function MoveList({
  history,
  currentMoveIndex,
  onMoveClick,
  result,
  temporaryBranch
}: MoveListProps) {
  // Create move pairs (white and black) for main game
  const createMovePairs = (moves: ChessMove[], startIndex: number = 0) => {
    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor((i + startIndex) / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
        whiteIndex: i + startIndex,
        blackIndex: i + 1 + startIndex,
      });
    }
    return pairs;
  };

  // Main line moves (all moves if no branch, or moves up to branch point if branched)
  let mainLineHistory = history;
  if (temporaryBranch) {
    // Only show main line up to the branch point
    mainLineHistory = history.slice(0, temporaryBranch.baseMoveIndex + 1);
  }
  
  const mainLinePairs = createMovePairs(mainLineHistory);
  
  // Get the matching temporary branch pairs if they exist
  let tempBranchPairs: any[] = [];
  if (temporaryBranch && temporaryBranch.moves.length > 0) {
    const startMoveIndex = temporaryBranch.baseMoveIndex + 1;
    const startPairIndex = Math.floor(startMoveIndex / 2);
    
    // Check if we need to create a half-pair (if branch starts on black's move)
    const isBlackMove = startMoveIndex % 2 === 1;
    
    if (isBlackMove && mainLinePairs.length > 0) {
      // The branch starts with a black move, so we need special handling
      const lastMainPair = mainLinePairs[mainLinePairs.length - 1];
      
      // Create the first pair with white from main line and black from branch
      tempBranchPairs.push({
        number: startPairIndex + 1,
        white: lastMainPair.white,
        black: temporaryBranch.moves[0],
        whiteIndex: lastMainPair.whiteIndex,
        blackIndex: startMoveIndex,
        isTemporaryBlack: true
      });
      
      // Then create the rest of the branch pairs (shifted by 1)
      const restOfBranch = createMovePairs(temporaryBranch.moves.slice(1), startMoveIndex + 1);
      tempBranchPairs = [...tempBranchPairs, ...restOfBranch.map(pair => ({
        ...pair,
        isTemporaryWhite: true,
        isTemporaryBlack: true
      }))];
    } else {
      // The branch starts with a white move, so we can just create pairs normally
      tempBranchPairs = createMovePairs(temporaryBranch.moves, startMoveIndex).map(pair => ({
        ...pair,
        isTemporaryWhite: true,
        isTemporaryBlack: true
      }));
    }
  }
  
  // Get the rest of the main line if there's a branch
  let restOfMainLinePairs: any[] = [];
  if (temporaryBranch && history.length > temporaryBranch.baseMoveIndex + 1) {
    const restOfMainLine = history.slice(temporaryBranch.baseMoveIndex + 1);
    restOfMainLinePairs = createMovePairs(restOfMainLine, temporaryBranch.baseMoveIndex + 1);
  }

  // Determine if we're in a temporary branch
  const isInTemporaryBranch = 
    temporaryBranch && 
    currentMoveIndex > temporaryBranch.baseMoveIndex && 
    currentMoveIndex <= temporaryBranch.baseMoveIndex + temporaryBranch.moves.length &&
    // Make sure we're not looking at the main line moves
    !(currentMoveIndex < history.length);

  return (
    <div className="overflow-y-auto max-h-[300px]">
      <div className="grid grid-cols-[50px_1fr_1fr] gap-2">
        <div className="text-neutral-400 font-medium">Move</div>
        <div className="text-neutral-400 font-medium">White</div>
        <div className="text-neutral-400 font-medium">Black</div>
        
        {/* Main line moves */}
        {mainLinePairs.map((pair) => (
          <React.Fragment key={`main-${pair.number}`}>
            <div className="text-neutral-300">{pair.number}.</div>
            <div 
              className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100 
                ${pair.whiteIndex === currentMoveIndex && !isInTemporaryBranch ? 'bg-blue-200 hover:bg-blue-200' : ''}`}
              onClick={() => onMoveClick(pair.whiteIndex)}
            >
              {pair.white.san}
            </div>
            <div 
              className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100
                ${pair.blackIndex === currentMoveIndex && !isInTemporaryBranch ? 'bg-blue-200 hover:bg-blue-200' : 
                  pair.black ? '' : 'invisible'}`}
              onClick={() => pair.black ? onMoveClick(pair.blackIndex) : null}
            >
              {pair.black?.san}
            </div>
          </React.Fragment>
        ))}

        {/* Temporary branch */}
        {temporaryBranch && temporaryBranch.moves.length > 0 && (
          <>
            <div className="col-span-3 pt-2 pb-1 text-sm text-orange-600 font-medium border-t mt-2">
              Variation:
            </div>
            
            {tempBranchPairs.map((pair, i) => {
              // Calculate the actual move index in the temporary branch
              const actualWhiteIndex = pair.whiteIndex;
              const actualBlackIndex = pair.blackIndex;
              
              return (
                <React.Fragment key={`branch-${pair.number}`}>
                  <div className="text-orange-500">{pair.number}.</div>
                  <div 
                    className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100 
                      ${pair.isTemporaryWhite ? 'text-orange-700' : ''}
                      ${actualWhiteIndex === currentMoveIndex && isInTemporaryBranch ? 'bg-orange-200 hover:bg-orange-200' : ''}`}
                    onClick={() => onMoveClick(actualWhiteIndex)}
                  >
                    {pair.white.san}
                  </div>
                  <div 
                    className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100
                      ${pair.isTemporaryBlack || i > 0 ? 'text-orange-700' : ''}
                      ${actualBlackIndex === currentMoveIndex && isInTemporaryBranch ? 'bg-orange-200 hover:bg-orange-200' : 
                        pair.black ? '' : 'invisible'}`}
                    onClick={() => pair.black ? onMoveClick(actualBlackIndex) : null}
                  >
                    {pair.black?.san}
          </div>
                </React.Fragment>
              );
            })}
          </>
        )}
        
        {/* Rest of main line (if there's a branch) */}
        {restOfMainLinePairs.length > 0 && (
          <>
            <div className="col-span-3 pt-2 pb-1 text-sm text-blue-600 font-medium border-t mt-2">
              Main line continues:
      </div>
      
            {restOfMainLinePairs.map((pair) => (
              <React.Fragment key={`rest-${pair.number}`}>
                <div className="text-neutral-300">{pair.number}.</div>
                <div 
                  className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100 
                    ${pair.whiteIndex === currentMoveIndex && !isInTemporaryBranch ? 'bg-blue-200 hover:bg-blue-200' : ''}`}
                  onClick={() => onMoveClick(pair.whiteIndex)}
                >
                  {pair.white.san}
                </div>
                <div 
                  className={`cursor-pointer px-2 py-1 rounded hover:bg-neutral-100
                    ${pair.blackIndex === currentMoveIndex && !isInTemporaryBranch ? 'bg-blue-200 hover:bg-blue-200' : 
                      pair.black ? '' : 'invisible'}`}
                  onClick={() => pair.black ? onMoveClick(pair.blackIndex) : null}
                >
                  {pair.black?.san}
                </div>
              </React.Fragment>
            ))}
          </>
        )}
        
        {result && (
          <div className="col-span-3 pt-2 font-medium">{result}</div>
        )}
      </div>
    </div>
  );
}


define([], function() { // requirejs
//
//// Browser Variables
//if (!assert) {
//  assert = window.assert;
//}

// Global Variables
var SOLDIER_WIDTH = 8;
var SOLDIER_HEIGHT = 8;
var GUERRILLA_WIDTH = 7;
var GUERRILLA_HEIGHT = 7;

/**
 * Validates the position of a generic piece.
 */
function validatePosition(context, position, xMin, xMax, yMin, yMax) {
//  assert.ok(position, "no position provided to " + context);
//  assert.ok(typeof position === 'object', context + " position must be an object e.g. { x: 1, y: 3 }");
//  assert.ok(typeof position.x === 'number', "non-numeric x position provided to " + context);
//  assert.ok(typeof position.y === 'number', "non-numeric y position provided to " + context);
//  assert.ok(position.x >= xMin && position.x <= xMax, "invalid x position provided to " + context);
//  assert.ok(position.y >= yMin && position.y <= yMax, "invalid y position provided to " + context);
  if (position.x < xMin || position.x > xMax) return false;
  if (position.y < yMin || position.y > yMax) return false;
  return true;
}

/**
 * Validates the position of a soldier piece.
 */
function validateSoldierPosition(position) {
  return validatePosition("soldier piece", position, 0, SOLDIER_WIDTH - 1, 0, SOLDIER_HEIGHT - 1);
}

/**
 * Validates the position of a guerrilla piece.
 */
function validateGuerrillaPosition(position) {
  return validatePosition("guerrilla piece", position, 0, GUERRILLA_WIDTH - 1, 0, GUERRILLA_HEIGHT - 1);
}

/**
 * Generic 2D position.
 */
function Position(x, y) {
  this.x = x;
  this.y = y;
}

/**
 * A soldier piece.
 */
function SoldierPiece(position) {
  validateSoldierPosition(position);
  this.position = position;
}

/**
 * A guerrilla piece.
 */
function GuerrillaPiece(position) {
  validateGuerrillaPosition(position);
  this.position = position;
}

/**
 * The current state of a guerrilla checkers game.
 */
function GameState() {
  var me = this;
  var soldierStartPositions = arguments[0] || [
    new Position(3, 2),
    new Position(2, 3),
    new Position(4, 3),
    new Position(3, 4),
    new Position(5, 4),
    new Position(4, 5)
  ];

  me.validatePhases = false; // properly initialized after baord setup

  var STARTING_GUERRILLA_PIECES = 66;

  me.currentPhase = 0;
  me.remainingGuerrillaPieces = STARTING_GUERRILLA_PIECES;
  me.arrPhases = ["GUERRILLA", "GUERRILLA", "SOLDIER"];
  me.arrGuerrillaPieces = []; // Array<GuerrillaPiece>
  me.arrSoldierPieces = [];  // Array<SoldierPiece>

  me.movedSoldier = null;
  me.placedGuerrilla = null;
  me.arrCapturedSoldiers = [];
  me.capturedGuerrilla = null;

  me.pieceAt = function(arrPieces, validate) {
    return function(position) {
      validate(position);
      var numPieces = arrPieces.length;
      for (var idx = 0; idx < numPieces; ++idx) {
        var piece = arrPieces[idx];
        var piecePosition = piece.position;
        if (piecePosition.x === position.x && piecePosition.y === position.y) {
          return piece;
        }
      }
      return null;
    };
  };

  /**
   * Retrieves the soldier piece at the specified position.
   * @param position The zero-based position to check for a piece
   * @return {SoldierPiece} The piece at the specified position, 
   *         or null if not found.
   */
  this.soldierPieceAt = this.pieceAt(me.arrSoldierPieces, validateSoldierPosition);

  /**
   * Retrieves the soldier piece at the specified position.
   * @param position The zero-based position to check for a piece
   * @return {SoldierPiece} The piece at the specified position, 
   *         or null if not found.
   */
  this.guerrillaPieceAt = this.pieceAt(me.arrGuerrillaPieces, validateGuerrillaPosition);

  soldierStartPositions.forEach(function(position) {
    var piece = me.createSoldierPiece(position);
  });
  me.validatePhases = arguments.length > 1 ? arguments[1] : true;

  me.getCurrentPhase = function() {
    return me.arrPhases[me.currentPhase];
  };

  me.isSoldierTurn = function() {
    return me.arrPhases[me.currentPhase] === 'SOLDIER';
  };

  me.isGuerrillaTurn = function() {
    return me.arrPhases[me.currentPhase] === 'GUERRILLA';
  };

  me.getCurrentPhaseIndex = function() {
    return me.currentPhase;
  };

  me.getRemainingGuerrillaPieces = function() {
    return me.remainingGuerrillaPieces;
  };


  var removePiece = function(arrPieces, piece) {
    if (piece) {
      //console.log('removing: ', guerrillaPiece);
      for(idx = 0; idx < arrPieces.length; ++idx) {
        var maybePiece = arrPieces[idx];
        if (maybePiece.position.x === piece.position.x &&
            maybePiece.position.y === piece.position.y) {

          //console.log('match found: ', this.arrGuerrillaPieces[idx], guerrillaPiece);
          arrPieces.splice(idx, 1);
          break;
        }
      }
    }
    return arrPieces;
  };

  me.removeGuerrillaPiece = function(guerrillaPiece) {
    var originalCount = me.arrGuerrillaPieces.length;
    me.arrGuerrillaPieces = removePiece(me.arrGuerrillaPieces, guerrillaPiece);
    return originalCount === me.arrGuerrillaPieces.length;
  };

  me.removeSoldierPiece = function(soldierPiece) {
    var originalCount = me.arrSoldierPieces.length;
    me.arrSoldierPieces = removePiece(me.arrSoldierPieces, soldierPiece);
    return originalCount === me.arrSoldierPieces.length;
  };
}

GameState.prototype.asDTO = function() {
  return {
    currentPhase: this.currentPhase,
    arrGuerrillaPieces: this.arrGuerrillaPieces,
    arrSoldierPieces: this.arrSoldierPieces,
    remainingGuerrillaPieces: this.remainingGuerrillaPieces,
    placedGuerrilla: this.placedGuerrilla,
    movedSoldier: this.movedSoldier,
    arrCapturedSoldiers: this.arrCapturedSoldiers,
    capturedGuerrilla: this.capturedGuerrilla
  };
};

// TODO this should really be a factory style method
GameState.prototype.fromDTO = function(data) {
  this.currentPhase = data.currentPhase;
  this.arrGuerrillaPieces = data.arrGuerrillaPieces;
  this.arrSoldierPieces = data.arrSoldierPieces;
  this.remainingGuerrillaPieces = data.remainingGuerrillaPieces;
  this.placedGuerrilla = data.placedGuerrilla;
  this.movedSoldier = data.movedSoldier;
  this.arrCapturedSoldiers = data.arrCapturedSoldiers;
  this.capturedGuerrilla = data.capturedGuerrilla;
  this.soldierPieceAt = this.pieceAt(this.arrSoldierPieces, validateSoldierPosition);
  this.guerrillaPieceAt = this.pieceAt(this.arrGuerrillaPieces, validateGuerrillaPosition);
};

GameState.prototype.advancePhase = function() {
    this.currentPhase = (this.currentPhase + 1) % this.arrPhases.length;
    return this.getCurrentPhase();
};
/**
 * Create a soldier piece at the given position.
 * If there is already a piece there, this will fail and return null.
 * @param position The position to create a new soldier piece at.
 * @return {SoldierPiece} The newly created soldier piece, or null.
 */
GameState.prototype.createSoldierPiece = function(position) {
  if (!validateSoldierPosition(position)) { return null; }
  if (this.soldierPieceAt(position)) { return null; }

  var piece = new SoldierPiece(new Position(position.x, position.y));
  this.arrSoldierPieces.push(piece);
  return piece;
};

/**
 * Filters out just the game pieces from a game state.
 * @return The guerrilla and soldier pieces as arrays in an object.
 */
GameState.prototype.getPieces = function() {
  return {
    arrGuerrillaPieces: this.arrGuerrillaPieces,
    arrSoldierPieces: this.arrSoldierPieces
  };
};

GameState.prototype.getGuerrillaPieces = function() {
  return this.arrGuerrillaPieces;
};

GameState.prototype.getSoldierPieces = function() {
  return this.arrSoldierPieces;
};

/**
 * Checks whether the destination is clear.
 * @return {boolean} Whether the move can be performed.
 */
GameState.prototype.isValidNewSoldierPosition = function(soldierPiece, destination) {
  if (!validateSoldierPosition(destination)) { return false; }
  if (!soldierPiece) {
    return false;
  }
  var blockingPiece = this.soldierPieceAt(destination);
  if (blockingPiece) {
    return false;
  }
  var xDiff = Math.abs(soldierPiece.position.x - destination.x);
  var yDiff = Math.abs(soldierPiece.position.y - destination.y);
  return xDiff === 1 && yDiff === 1;
};

/**
 * Checks whether the destination is clear, and whether the move is legal.
 * @return {boolean} Whether the move can be performed.
 */
GameState.prototype.isValidSoldierMove = function(soldierPiece, destination) {
  if (!this.isValidNewSoldierPosition(soldierPiece, destination)) return false;
  //console.log('testing move ', soldierPiece.position, ' -> ', destination);
  var arrMoves =  this.getSoldierCapturingMoves(soldierPiece);
  if (this.movedSoldier === null || arrMoves.length === 0) {
    arrMoves = this.getPotentialSoldierMoves(soldierPiece);
  }

  //console.log('capturing moves: ', arrMoves);

  for(idx = 0; idx < arrMoves.length; ++idx) {
    if (destination.x == arrMoves[idx].x && destination.y == arrMoves[idx].y) return true;
  }
  return false;
};


/**
 * List of open positions a COIN piece may move to.  Only validates
 * position based on it being on the board, and not already containing
 * another COIN piece.
 * @return {array} Array of valid move destinations.
 */
GameState.prototype.getPotentialSoldierMoves = function(soldierPiece) {
  var arrMoves = [];
  var testPositions = [
    new Position(soldierPiece.position.x + 1, soldierPiece.position.y + 1),
    new Position(soldierPiece.position.x + 1, soldierPiece.position.y - 1),
    new Position(soldierPiece.position.x - 1, soldierPiece.position.y - 1),
    new Position(soldierPiece.position.x - 1, soldierPiece.position.y + 1)
  ];

  for(idx = 0; idx < testPositions.length; ++idx) {
    var position = testPositions[idx];
    if (this.isValidNewSoldierPosition(soldierPiece, position)) {
      arrMoves.push(position);
    }
  }
  return arrMoves;
};

// TODO refactor. this method is unacceptably long
GameState.prototype.getPotentialGuerrillaMoves = function() {
  var x,y,i;
  var moves = [];
  var testPositions;
  if (this.getGuerrillaPieces().length === 0) {
    //Game just started. They can play anywhere.
    for (x = 0; x < GUERRILLA_WIDTH; x++) {
      for (y = 0; y < GUERRILLA_HEIGHT; y++) {
        moves.push(new Position(x, y));
      }
    }
  } else if (this.placedGuerrilla !== null) {
    //They've already placed a piece. It must be adjacent to this one.
    x = this.placedGuerrilla.position.x;
    y = this.placedGuerrilla.position.y;
    testPositions = [
      new Position(x + 1,     y),
      new Position(    x, y - 1),
      new Position(x - 1,     y),
      new Position(    x, y + 1)
    ];
    for (i = 0; i < testPositions.length; i++) {
      piece = testPositions[i];
      result = this.isValidGuerrillaPlacement(piece);
      if (result === true) {
        moves.push(piece);
      }
    }
  } else {
    //They can play anywhere adjacent to an existing piece.
    // http://25.media.tumblr.com/tumblr_m7g9f7NMqW1rzupqxo1_500.png
    var positions = [];
    //initialise
    for (x = 0; x < GUERRILLA_WIDTH; x++) {
      positions[x] = [];
      for (y = 0; y < GUERRILLA_HEIGHT; y++) {
        positions[x][y] = false;
      }
    }

    //check neighbours of existing pieces for moves
    for (i = 0; i < this.getGuerrillaPieces().length; i++) {
      piece = this.getGuerrillaPieces()[i];
      x = piece.position.x;
      y = piece.position.y;
      testPositions = [
        new Position(x + 1,     y),
        new Position(    x, y - 1),
        new Position(x - 1,     y),
        new Position(    x, y + 1)
      ];
      for (j = 0; j < testPositions.length; j++) {
        piece = testPositions[j];
        result = this.isValidGuerrillaPlacement(piece);
        if (result === true) {
          positions[piece.x][piece.y] = piece;
        }
      }
    }

    //convert the above to actual moves
    for (x = 0; x < GUERRILLA_WIDTH; x++) {
      for (y = 0; y < GUERRILLA_HEIGHT; y++) {
        if (positions[x][y] !== false) {
          moves.push(positions[x][y]);
        }
      }
    }

  }
  return moves;
};


/**
 * For a given soldier piece, determine which moves will capture a guerrilla piece.
 * @return {array} Array of capturable guerrilla pieces.
 */
GameState.prototype.getSoldierCapturingMoves = function(soldierPiece) {
  var arrMoves = this.getPotentialSoldierMoves(soldierPiece);
  //console.log('getSoldierCapturingMoves');
  //console.log('  potential moves: ', arrMoves);
  var arrCapturingMoves = [];
  for(idx = 0; idx < arrMoves.length; ++idx) {
    var capture = this.getCapturedGuerrilla(soldierPiece.position, arrMoves[idx]);
    if (capture) {
      arrCapturingMoves.push(arrMoves[idx]);
    }
  }
  //console.log('determined capturing moves: ', arrCapturingMoves);
  return arrCapturingMoves;
};

/**
 * Move a soldier piece at piecePosition to the given destination.
 * @return {boolean} Whether the piece was successfully moved.
 */
GameState.prototype.moveSoldierPiece = function(piecePosition, destination) {
  if (!this.verifyPhase("SOLDIER")) return false;
  var soldierPiece = this.soldierPieceAt(piecePosition);
  if (!this.isValidSoldierMove(soldierPiece, destination)) {
    return false;
  }
  
  this.capturedGuerrilla = null;
  var guerrillaPiece = this.getCapturedGuerrilla(piecePosition, destination);
  //console.log('captured guerrilla: ', guerrillaPiece);
  if (guerrillaPiece) {
    this.removeGuerrillaPiece(guerrillaPiece);
    this.capturedGuerrilla = guerrillaPiece;
  }
  soldierPiece.position.x = destination.x;
  soldierPiece.position.y = destination.y;
  var possibleCaptures = this.getSoldierCapturingMoves(soldierPiece);
  //console.log('followup captures: ', possibleCaptures);
  this.movedSoldier = soldierPiece;
  if (guerrillaPiece) {
    if (possibleCaptures.length === 0) {
      this.movedSoldier = null;
      this.advancePhase();
    }
  } else {
    this.movedSoldier = null;
    this.advancePhase();
  }
  return true;
};



/**
 * Get guerrilla piece a soldier move may have captured.
 * @return {object} Guerrilla piece of a capture occured, null otherwise.
 */
GameState.prototype.getCapturedGuerrilla = function(soldierPosition, destination) {
  //console.log('guerrillas in play: ', this.arrGuerrillaPieces);
  var guerrillaPiece = null;
  var deltaX = destination.x - soldierPosition.x;
  var deltaY = destination.y - soldierPosition.y;

  if (deltaX === 1 && deltaY === 1) {
    guerrillaPiece = this.guerrillaPieceAt(soldierPosition);
  } else if (deltaX === 1 && deltaY === -1) {
    guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x, soldierPosition.y - 1));
  } else if (deltaX === -1 && deltaY === -1) {
    guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x - 1, soldierPosition.y - 1));
  } else if (deltaX === -1 && deltaY === 1) {
    guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x - 1, soldierPosition.y));
  }
  return guerrillaPiece;
};



/**
 * Place a new guerrilla piece at piecePosition.
 * @return {boolean} Whether the piece was succesfully placed.
 */
GameState.prototype.isValidGuerrillaPlacement = function(piecePosition) {
  if (!validateGuerrillaPosition(piecePosition)) return false;
  if (this.getRemainingGuerrillaPieces() <= 0) return false;
  if (this.guerrillaPieceAt(piecePosition)) return false;
  if (this.arrGuerrillaPieces.length > 0) {
    // if pieces are in play
    // guerrilla must be placed adjacent to one
    if (this.guerrillaPieceAt(new Position(piecePosition.x - 1, piecePosition.y))) return true;
    else if (this.guerrillaPieceAt(new Position(piecePosition.x + 1, piecePosition.y))) return true;
    else if (this.guerrillaPieceAt(new Position(piecePosition.x, piecePosition.y - 1))) return true;
    else if (this.guerrillaPieceAt(new Position(piecePosition.x, piecePosition.y + 1))) return true;
    else return false;
  } else {
    return true;
  }
};

GameState.prototype.placeGuerrillaPiece = function(piecePosition) {
  if (!this.verifyPhase('GUERRILLA')) return false;
  if (!this.isValidGuerrillaPlacement(piecePosition)) return false;
  var piece = new GuerrillaPiece(piecePosition);
  this.remainingGuerrillaPieces--;
  this.arrGuerrillaPieces.push(piece);
  this.capturedGuerrilla = null;
  this.arrCapturedSoldiers = [];
  var arrPotentialCaptures = this.threatenedSoldierPieces(piece.position);
  for(idx = 0; idx < arrPotentialCaptures.length; ++idx) {
    var soldier = this.soldierPieceAt(arrPotentialCaptures[idx]);
    if (this.captureSoldierPiece(soldier)) {
      arrCapturedSoldiers.push(soldier);
    }
  }
  if (this.placedGuerrilla) {
    this.placedGuerrilla = null;
  } else {
    this.placedGuerrilla = piece;
  }
  this.advancePhase();
  if (this.getCurrentPhase() === 'GUERRILLA') {
    if (this.getPotentialGuerrillaMoves().length === 0) {
      // no possible moves
      // forfeit turn
      this.advancePhase();
      this.placedGuerrilla = null;
    }
  }
  return true;
};


/*
 * Return array of COINs which guerrilla piece could potentially capture
 * @return {array} COINs which could be potentially captured due to
 *                 given placement.
 */
GameState.prototype.threatenedSoldierPieces = function(piecePosition) {
  var arrSoldierPositions = [];
  var offsets = [
    new Position(1,1),
    new Position(1,0),
    new Position(0,0),
    new Position(0,1)
  ];
  for(idx = 0; idx < offsets.length; ++idx) {
    var soldierPosition = new Position(piecePosition.x + offsets[idx].x,
                                       piecePosition.y + offsets[idx].y);
    if (this.soldierPieceAt(soldierPosition)) {
      arrSoldierPositions.push(soldierPosition);
    }
  }
  console.log(piecePosition, ' threatens ', arrSoldierPositions);
  return arrSoldierPositions;
};

/*
 * Capture COIN piece of possible.
 * @return {booolean} True if piece was captured, false otherwise.
 */
GameState.prototype.captureSoldierPiece = function(soldierPiece) {
  if (!soldierPiece) return false;
  var offsets = [
    new Position(0,0),
    new Position(0,-1),
    new Position(-1,-1),
    new Position(-1,0)
  ];
  var capturePoints = 0;
  for(idx = 0; idx < offsets.length; ++idx) {
    var guerrillaPosition = new Position(soldierPiece.position.x + offsets[idx].x,
                                        soldierPiece.position.y + offsets[idx].y);
    // treat 'off board' guerrilla positions are having a piece
    // to allow captuers of soldier peices on the outer edges of the board
    if (!validateGuerrillaPosition(guerrillaPosition)) {
      capturePoints +=1;
    }
    else if (this.guerrillaPieceAt(guerrillaPosition)) {
      capturePoints +=1;
    }
  }
  if (capturePoints === 4) {
    this.removeSoldierPiece(soldierPiece);
    return true;
  }
  return false;
};

GameState.prototype.verifyPhase = function(phase) {
  if (this.validatePhases) {
    return this.getCurrentPhase() === phase;
  } else {
    return true;
  }
};

GameState.prototype.getWinner = function() {
  var me = this;
  if (me.remainingGuerrillaPieces <= 0) {
    return 'coin';
  } else if (me.arrSoldierPieces.length === 0) {
    return 'guerrilla';
  }
};

// exports
return {
  GameState: GameState,
  SoldierPiece: SoldierPiece,
  GuerrillaPiece: GuerrillaPiece,
  Position: Position
};

}); // end requirejs

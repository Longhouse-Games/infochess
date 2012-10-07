define([], function() { // requirejs

function Position(x, y) {
  this.x = x;
  this.y = y;
}

function keyToPosition(key) {
  var vals = key.split(',');
  return new Position(parseInt(vals[0]), parseInt(vals[1]));
};

Position.prototype.asKey = function() {
  return this.x + "," + this.y;
};

Position.prototype.colour = function() {
  return ((this.x + this.y) % 2) === 0 ? 'white' : 'black';
};

function Piece(type, colour) {
  var BACK_ROW = 0;
  var BLACK_BACK_ROW = 7;
  var FRONT_ROW = 1;

  var TYPES = [
    'king',
    'queen',
    'knight',
    'rook',
    'bishop',
    'pawn'
  ];

  var pieces = {
    king: {
      cost: 0,
      limit: 1,
      starting_row: BACK_ROW
    },
    queen: {
      cost: 3,
      limit: 1,
      starting_row: BACK_ROW
    },
    knight: {
      cost: 2,
      limit: 2,
      starting_row: BACK_ROW
    },
    rook: {
      cost: 2,
      limit: 2,
      starting_row: BACK_ROW
    },
    bishop: {
      cost: 1,
      limit: 2,
      starting_row: BACK_ROW
    },
    pawn: {
      cost: 1,
      limit: 8,
      starting_row: FRONT_ROW
    }
  };

  // TODO not all browsers support indexOf
  if (TYPES.indexOf(type) === -1) {
    throw new Error("Invalid type: " + type);
  }
  var piece = pieces[type];

  switch(colour) {
    case 'white':
      break;
    case 'black':
      piece.starting_row = BLACK_BACK_ROW - piece.starting_row;
      break;
    default:
      throw new Error("Invalid colour: "+colour);
  }
  piece.type = type;
  piece.colour = colour;
  return piece;
}

function BuildingBoard(colour) {
  this.max_points = 10;
  this.pieces = [];
}

BuildingBoard.prototype.validatePosition = function(position) {
  return position.x >= 0 && position.x <= 7 &&
    position.y >= 0 && position.y <=7;
};

BuildingBoard.prototype.points = function() {
  var points = 0;
  for(var pos_key in this.pieces) {
    if (this.pieces.hasOwnProperty(pos_key)) {
      points = points + this.pieces[pos_key].cost;
    }
  }
  return points;
};

// Gets the count of types of pieces on this board
BuildingBoard.prototype.count = function(type) {
  if (!type) {
    throw new Error("Type required.");
  }

  var count = 0;
  for(var pos_key in this.pieces) {
    if (this.pieces.hasOwnProperty(pos_key) &&
        this.pieces[pos_key].type === type) {
      count = count + 1;
    }
  }
  return count;
};

BuildingBoard.prototype.isValidArmy = function() {
  return this.count('king') > 0;
};

BuildingBoard.prototype.getPossiblePlacements = function(piece) {
  var results = [];
  var row = piece.starting_row;
  for (var i = 0; i < 8; i++) {
    var pos = new Position(i, row);
    if (this.canAddPiece(piece, pos)) {
      results.push(pos);
    }
  }
  return results;
};

BuildingBoard.prototype.addPiece = function(piece, position) {
  if (!this.canAddPiece(piece, position)) {
    throw new Error("Cannot add piece at this position: " + position.asKey());
  }
  this.pieces[position.asKey()] = piece;
  return piece;
};

BuildingBoard.prototype.canAddPiece = function(piece, position) {
  var pos_key;
  var count = 0;
  var points = 0;

  if (!position || !this.validatePosition(position)) {
    throw new Error ("Invalid position argument: " + position);
  }

  if (this.pieces[position.asKey()]) {
    return false;
  }

  // check piece limits
  if ((this.count(piece.type) + 1) > piece.limit) {
    return false;
  }

  // check army cost limit
  if ((this.points() + piece.cost) > this.max_points) {
    return false;
  }

  // check special bishop rule
  if (piece.type === 'bishop') {
    // Second bishops can only be placed on squares of a colour different from
    // the first

    for(pos_key in this.pieces) {
      if (this.pieces.hasOwnProperty(pos_key) &&
          this.pieces[pos_key].type === 'bishop') {
        var pos2 = keyToPosition(pos_key);

        if (position.colour() === pos2.colour()) {
          return false;
        }

        break;
      }
    }
  }

  return position.y === piece.starting_row;
};


//return BuildingBoard;

return {
  BuildingBoard: BuildingBoard,
  Piece: Piece,
  Position: Position
};
});


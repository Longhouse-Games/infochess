define([], function() {

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
      starting_row: BACK_ROW,
      invisible: true
    },
    queen: {
      cost: 3,
      limit: 1,
      starting_row: BACK_ROW,
      invisible: false
    },
    knight: {
      cost: 2,
      limit: 2,
      starting_row: BACK_ROW,
      invisible: true
    },
    rook: {
      cost: 2,
      limit: 2,
      starting_row: BACK_ROW,
      invisible: false
    },
    bishop: {
      cost: 1,
      limit: 2,
      starting_row: BACK_ROW,
      invisible: false
    },
    pawn: {
      cost: 1,
      limit: 8,
      starting_row: FRONT_ROW,
      invisible: true
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

return {
  Position: Position,
  Piece: Piece,
  keyToPosition: keyToPosition
};

});

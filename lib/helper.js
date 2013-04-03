define([], function() {

var InvalidMessageError = function(msg) {
  this.message = msg;
};
InvalidMessageError.prototype = new Error;

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

//Calculates the walking distance as a king from this piece to the other
//EG: from "0,0".distanceTo("5,5") is 5, as the king moves diagonally
//EG: from "0,0".distanceTo("2,1") is 2. The king can diagonally once, then right once.
Position.prototype.distanceTo = function(other) {
  var distance = 0;
  // Move diagonally until one of the axis matches, then move along that axis
  // to the target.

  var x = this.x;
  var y = this.y;
  var x_mod = this.x - other.x < 0 ? 1 : -1;
  var y_mod = this.y - other.y < 0 ? 1 : -1;

  while(x !== other.x && y !== other.y) {
    x += 1 * x_mod;
    y += 1 * y_mod;
    distance++;
  }

  if (y === other.y) {
    while (x !== other.x) {
      x += 1 * x_mod;
      distance++;
    }
  }

  if (x === other.x) {
    while (y !== other.y) {
      y += 1 * y_mod;
      distance++;
    }
  }

  return distance;
}

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
    throw new InvalidMessageError("Invalid type: " + type);
  }
  var piece = pieces[type];

  switch(colour) {
    case 'white':
      break;
    case 'black':
      piece.starting_row = BLACK_BACK_ROW - piece.starting_row;
      break;
    default:
      throw new InvalidMessageError("Invalid colour: "+colour);
  }
  piece.type = type;
  piece.colour = colour;
  return piece;
}

return {
  Position: Position,
  Piece: Piece,
  keyToPosition: keyToPosition,
  InvalidMessageError: InvalidMessageError
};

});

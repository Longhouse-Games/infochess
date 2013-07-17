define(['lib/helper'], function(HelperModule) { // requirejs

var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var keyToPosition = HelperModule.keyToPosition;
var InvalidMessageError = HelperModule.InvalidMessageError;

function BuildingBoard(json) {
  this.max_points = 10;
  this.pieces = {};

  if (json) {
    var bb = JSON.parse(json);
    if (bb.max_points) {
      throw new InvalidMessageError("Max points is a protected attribute! Will not deserialize");
    }
    var pos, piece;
    var first_colour = null;
    for (var pos_key in bb.pieces) {
      if (bb.pieces.hasOwnProperty(pos_key)) {
        pos = keyToPosition(pos_key);
        piece = new Piece(bb.pieces[pos_key].type, bb.pieces[pos_key].colour);
        if (first_colour === null) {
          first_colour = piece.colour;
        }
        if (piece.colour !== first_colour) {
          throw new InvalidMessageError("BuildingBoards can only contain pieces of the same colour");
        }
        this.addPiece(piece, pos);
      }
    }
  }
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
    throw new InvalidMessageError("Type required.");
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
    throw new InvalidMessageError("Cannot add piece at this position: " + position.asKey());
  }
  this.pieces[position.asKey()] = piece;
  return this;
};

BuildingBoard.prototype.removePiece = function(position) {
  var piece = this.pieces[position.asKey()]
  if (!piece) {
    throw new InvalidMessageError("No piece at: " + position.asKey());
  }
  delete this.pieces[position.asKey()];
  return piece;
};

BuildingBoard.prototype.canAddPiece = function(piece, position) {
  var pos_key;
  var count = 0;
  var points = 0;

  if (!position || !this.validatePosition(position)) {
    throw new InvalidMessageError("Invalid position argument: " + position);
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

BuildingBoard.prototype.serialize = function() {
  return JSON.stringify({ pieces: this.pieces }, null, 2);
};

return {
  BuildingBoard: BuildingBoard,
};
});


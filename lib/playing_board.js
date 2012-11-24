define(['./helper.js'], function(HelperModule) { // requirejs

var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var keyToPosition = HelperModule.keyToPosition;

function PlayingBoard() {
  if (arguments.length === 2) {
    var whiteBuildingBoard = arguments[0];
    var blackBuildingBoard = arguments[1];

    if (!whiteBuildingBoard || !blackBuildingBoard) {
      throw new Error("Both white and black armies must be supplied");
    }

    var black_pieces = blackBuildingBoard.pieces;
    var white_pieces = whiteBuildingBoard.pieces;

    this.max_points = 10;
    this.pieces = {};
    var piece, pos_key;
    for (pos_key in white_pieces) {
      if (white_pieces.hasOwnProperty(pos_key)) {
        this.pieces[pos_key] = white_pieces[pos_key];
      }
    }
    for (pos_key in black_pieces) {
      if (black_pieces.hasOwnProperty(pos_key)) {
        this.pieces[pos_key] = black_pieces[pos_key];
      }
    }
  } else {
    this.pieces = arguments[0];
  }
}

PlayingBoard.prototype.getPieces = function() {
  return this.pieces;
};

PlayingBoard.prototype.getViewPieces = function(colour) {
  if (colour !== 'black' && colour !== 'white') {
    throw new Error("Invalid value for color: "+colour);
  }

  var viewPieces = {};
  for (var pos_key in this.pieces) {
    if (this.pieces.hasOwnProperty(pos_key)) {
      var piece = this.pieces[pos_key];
      if (piece.colour === colour) {
        viewPieces[pos_key] = piece;
      } else if (piece.invisible === false) {
        viewPieces[pos_key] = piece;
      }
    }
  }
  return viewPieces;
};

PlayingBoard.prototype.validatePosition = function(position) {
  return position.x >= 0 && position.x <= 7 &&
    position.y >= 0 && position.y <=7;
};

PlayingBoard.prototype.getPossibleMoves = function(piece, position) {
  var me = this;
  var pieces = this.getPieces();
  var moves = [];

  var add = function(position) {
    if (me.validatePosition(position)) {
      moves.push(position.asKey());
      return true;
    }
    return false;
  };

  var addIfOccupied = function(position) {
    var target = pieces[position.asKey()];
    if (target && target.colour !== piece.colour) {
      return add(position);
    }
    return false;
  };

  var addIfUnoccupied = function(position) {
    if (!pieces[position.asKey()]) {
      return add(position);
    }
    return false;
  };

  var addUnlessFriendly = function(position) {
    var target = pieces[position.asKey()];
    if (!target || target.colour !== piece.colour) {
      return add(position);
    }
    return false;
  };

  var addUntilObstructed = function(position, next) {
    var thing = next(position);
    while (addUnlessFriendly(thing)) {
      var target = pieces[thing.asKey()];
      if (target) {
        break;
      }
      thing = next(thing);
    }
  };

  if (piece.type === 'pawn') {
    var direction = piece.colour === 'white' ? 1 : -1;

    addIfUnoccupied(new Position(position.x, position.y+(1*direction)));
    if (position.y === piece.starting_row) {
      // Pawns can move two from the starting row
      addIfUnoccupied(new Position(position.x, position.y+(2*direction)));
    }
    //Attack vectors!
    addIfOccupied(new Position(position.x+1, position.y+(1*direction)));
    addIfOccupied(new Position(position.x-1, position.y+(1*direction)));
  } else if (piece.type === 'king') {
    var potentials = [
      new Position(position.x-1, position.y+1),
      new Position(position.x  , position.y+1),
      new Position(position.x+1, position.y+1),
      new Position(position.x-1, position.y  ),
      new Position(position.x+1, position.y  ),
      new Position(position.x-1, position.y-1),
      new Position(position.x  , position.y-1),
      new Position(position.x+1, position.y-1)
    ];
    for (var i = 0; i < potentials.length; i++) {
      addUnlessFriendly(potentials[i]);
    }
  } else if (piece.type === 'knight') {
    var potentials = [
      new Position(position.x-2, position.y+1),
      new Position(position.x-1, position.y+2),
      new Position(position.x+1, position.y+2),
      new Position(position.x+2, position.y+1),
      new Position(position.x-2, position.y-1),
      new Position(position.x-1, position.y-2),
      new Position(position.x+1, position.y-2),
      new Position(position.x+2, position.y-1)
    ];
    for (var i = 0; i < potentials.length; i++) {
      addUnlessFriendly(potentials[i]);
    }
  }

  if (piece.type === 'rook' || piece.type === 'queen') {
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x, pos.y+1);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x+1, pos.y);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x-1, pos.y);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x, pos.y-1);
    });
  }
  if (piece.type === 'bishop' || piece.type === 'queen') {
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x-1, pos.y+1);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x-1, pos.y-1);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x+1, pos.y+1);
    });
    addUntilObstructed(position, function(pos) {
      return new Position(pos.x+1, pos.y-1);
    });
  }
  // TODO castling
  return moves;
};


PlayingBoard.prototype.validateMove = function(role, src, dest) {
  if (src.x === dest.x && src.y === dest.y) {
    throw "Not actually a move! Src and dest are the same!"
  }
  // TODO proper validation as we can't trust clients
};

PlayingBoard.prototype.move = function(role, src, dest) {
  this.validateMove(role, src, dest);

  var moving_piece = this.pieces[src.asKey()];

  var result = {
    type: "move",
    src: src,
    dest: dest
  };

  var target;
  if (moving_piece.type !== "knight") {
    // Knights teleport. Let's walk.

    // Calculates the change in x or y direction to walk us towards the dest
    var direction_modifier = function(src_val, dest_val) {
      var diff = src_val - dest_val;
      if (diff === 0) {
        return diff;
      }
      return diff < 0 ? 1 : -1;
    }

    var x_mod = direction_modifier(src.x, dest.x);
    var y_mod = direction_modifier(src.y, dest.y);

    var walk = function(x, y) {
      return new Position(x+x_mod, y+y_mod);
    }
    var square = walk(src.x, src.y);
    while (square.x !== dest.x || square.y !== dest.y) {
      if (this.pieces[square.asKey()]) {
        target = this.pieces[square.asKey()];
        dest = square;
        break;
      }
      square = walk(square.x, square.y);
    }
  } else {
    target = this.pieces[dest.asKey()];
  }

  console.log("Target:");
  console.log(target);
  if (target) {
    if (moving_piece.type === 'pawn' && target.invisible) {
      // TODO: if pawn moves from starting position to y-+2 and bumps into
      // something, it should still advance one square, just not two.
      result.type = "pawnbump";
      // TODO: verify that the opponent's client is never sent the pawnbump bit.
    } else {
      result.captured_piece = this.pieces[dest.asKey()];
      result.type = "capture";
      moving_piece.invisible = false;
      delete this.pieces[dest.asKey()];
    }
  }

  if (result.type !== "pawnbump") {
    this.pieces[dest.asKey()] = moving_piece;
    delete this.pieces[src.asKey()];
  }

  // TODO if pawn lands on the furthest row, it can be upgraded

  return result;
};

return {
  PlayingBoard: PlayingBoard
};
});


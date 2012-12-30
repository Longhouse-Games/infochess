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

PlayingBoard.prototype.getPawnCaptures = function(role) {
  var me = this;
  var captures = []; // array of moves: [ { src: Position, dest: Position } ]
  var pieces = this.getPieces();
  console.log(role);
  console.log("Wat");
  console.log(pieces);

  var piece, position;

  for (var pos_key in pieces) {
    if (pieces.hasOwnProperty(pos_key)) {
      piece = pieces[pos_key];
      position = keyToPosition(pos_key);

      console.log("Piece:");
      console.log(piece);
      console.log(position);

      if (piece.type === 'pawn' && piece.colour === role) {
        console.log("fnerP");
        var direction = piece.colour === 'white' ? 1 : -1;

        var addIfOccupied = function(target_pos) {
          if (!me.validatePosition(target_pos)) {
            return false;
          }

          var target = pieces[target_pos.asKey()];
          if (target && target.invisible && target.colour !== piece.colour) {
            var move = {
              src: position,
              dest: target_pos
            }
            console.log("Created move.");
            console.log(move);
            captures.push(move);
            return true;
          }
          return false;
        };

        var left = new Position(position.x-1, position.y+(1*direction));
        var right = new Position(position.x+1, position.y+(1*direction));
        console.log(left);
        console.log(right);
        addIfOccupied(left);
        addIfOccupied(right);
      }
    }
  }

  return captures;
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

  return moves;
};

PlayingBoard.prototype.getCastlingMoves = function(piece, position) {
  var moves = {};
  var pieces = this.getPieces();

  if (piece.type === 'king' || piece.type === 'rook') {
    var king = pieces[new Position(4, piece.starting_row).asKey()];
    if (king && king.type === 'king') {
      var left_corner = pieces[new Position(0,piece.starting_row).asKey()];
      var right_corner = pieces[new Position(7,piece.starting_row).asKey()];

      var i = 0;
      if (left_corner && left_corner.type === 'rook') {
        if (!pieces[new Position(1, piece.starting_row).asKey()] &&
            !pieces[new Position(2, piece.starting_row).asKey()] &&
            !pieces[new Position(3, piece.starting_row).asKey()]) {
          moves.queenside = {
            king: new Position(2, piece.starting_row).asKey(),
            rook: new Position(3, piece.starting_row).asKey()
          };
        }
      }
      if (right_corner && right_corner.type === 'rook') {
        if (!pieces[new Position(5, piece.starting_row).asKey()] &&
            !pieces[new Position(6, piece.starting_row).asKey()]) {
          moves.kingside = {
            king: new Position(6, piece.starting_row).asKey(),
            rook: new Position(5, piece.starting_row).asKey()
          };
        }
      }
    }
  }
  return moves;
};

PlayingBoard.prototype.validateMove = function(role, src, dest) {
  if (src.x === dest.x && src.y === dest.y) {
    throw "Not actually a move! Src and dest are the same!"
  }
  // TODO proper validation as we can't trust clients
};

PlayingBoard.prototype.move = function(role, src, dest, state) {
  this.validateMove(role, src, dest);

  var moving_piece = this.pieces[src.asKey()];

  var result = {
    type: "move",
    src: src,
    dest: dest
  };

  // Calculates the change in x or y direction to walk us towards the dest
  var direction_modifier = function(src_val, dest_val) {
    var diff = src_val - dest_val;
    if (diff === 0) {
      return diff;
    }
    return diff < 0 ? 1 : -1;
  }

  var target;
  if (moving_piece.type !== "knight") {
    // Knights teleport. Let's walk.

    var x_mod = direction_modifier(src.x, dest.x);
    var y_mod = direction_modifier(src.y, dest.y);

    var walk = function(x, y) {
      return new Position(x+x_mod, y+y_mod);
    }
    var square = src;
    do {
      square = walk(square.x, square.y);
      if (this.pieces[square.asKey()]) {
        target = this.pieces[square.asKey()];
        dest = square;
        break;
      }
    } while (square.x !== dest.x || square.y !== dest.y)
  } else {
    target = this.pieces[dest.asKey()];
  }

  // Back rows make opposing pieces visible
  if ((moving_piece.colour === 'white' && dest.y >= 5) || (moving_piece.colour === 'black' && dest.y <= 2)) {
    moving_piece.invisible = false;
  }

  console.log("Target:");
  console.log(target);
  if (target) {
    if (moving_piece.type === 'pawn' && target.invisible && state !== 'pawn-capture') {
      // TODO: if pawn moves from starting position to y-+2 and bumps into
      // something, it should still advance one square, just not two.
      result.type = "pawnbump";
      // TODO: verify that the opponent's client is never sent the pawnbump bit.
    } else if (target.colour === role) {
      // Castling!
      var king, king_pos;
      var rook, rook_pos;

      if (target.type === 'king') {
        king = target;
        king_pos = dest;
      } else if (target.type === 'rook') {
        rook = target;
        rook_pos = dest;
      }

      if (moving_piece.type === 'king') {
        king = moving_piece;
        king_pos = src;
      } else if (moving_piece.type === 'rook') {
        rook = moving_piece;
        rook_pos = src;
      }

      if (!king || !rook || !king_pos || !rook_pos) {
        throw new "Invalid move for role: " + role + ", src: " + src.asKey() + ", dest: " + dest.asKey();
      }
      if (king_pos.x !== 4 && king_pos.y !== king.starting_row) {
        throw new "Invalid position for king for performing a castling move";
      }
      if (rook_pos.y !== rook.starting_row && (rook_pos.x !== 0 || rook_pos.x !== 7)) {
        throw new "Invalid position for rook for performing a castling move";
      }
      result.type = "castling";

      var x_mod = direction_modifier(src.x, dest.x);

      delete this.pieces[king_pos.asKey()];
      delete this.pieces[rook_pos.asKey()];

      // King moves two squares towards the rook
      this.pieces[new Position(king_pos.x + (2*x_mod), king_pos.y).asKey()] = king;

      // Rook teleports to the first square that the king moved onto.
      this.pieces[new Position(king_pos.x + (1*x_mod), king_pos.y).asKey()] = rook;

    } else {
      result.captured_piece = this.pieces[dest.asKey()];
      result.type = "capture";
      moving_piece.invisible = false;
      delete this.pieces[dest.asKey()];
    }
  }

  if (result.type !== "pawnbump" && result.type !== "castling") {
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


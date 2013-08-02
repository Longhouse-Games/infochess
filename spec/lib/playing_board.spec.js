define(['spec/spec_helper', 'lib/helper', 'lib/playing_board', 'lib/building_board'],
    function(SpecHelper, HelperModule, PlayingBoardModule, BuildingBoardModule) {

var PlayingBoard = PlayingBoardModule.PlayingBoard;
var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var makeBuildingBoard = SpecHelper.makeBuildingBoard;

describe("player views", function() {
  var board;

  beforeEach(function() {
    var whiteArmy = makeBuildingBoard('black');
    var blackArmy = makeBuildingBoard('white');

    board = new PlayingBoard(whiteArmy, blackArmy);
  });

  it("should not expose invisible opponent pieces", function() {
    var pieces = board.getViewPieces('white');

    expect(pieces).not.toBeUndefined();

    expect(pieces['0,0']).not.toBeUndefined();
    expect(pieces['0,0'].invisible).toBe(true);

    expect(pieces['0,7']).toBeUndefined();
    expect(pieces['1,7']).not.toBeUndefined();

    for(var pos_key in pieces) {
      if (pieces.hasOwnProperty(pos_key)) {
        var piece = pieces[pos_key];
        if (piece.colour === 'black') {
          expect(piece.invisible).toBe(false);
        }
      }
    }

  });
});

describe("move", function() {
  var board;

  it("should permit one-step attacks", function() {
    board = new PlayingBoard({
      "4,5": new Piece('king', 'white'),
      "5,6": new Piece('pawn', 'black')
    });

    var result = board.move('white', new Position(4,5), new Position(5,6));

    expect(result.type).toBe('capture');
    expect(board.pieces["5,6"].type).toBe('king');
    expect(board.pieces["4,5"]).toBeUndefined();
  });

  it("should interrupt long moves when an invisible piece is captured", function() {
    board = new PlayingBoard({
      "2,0": new Piece('rook', 'white'),
      "2,4": new Piece('pawn', 'black')
    });

    var result = board.move('white', new Position(2,0), new Position(2,7));

    expect(result.type).toBe('capture');
    expect(board.pieces["2,4"].type).toBe('rook');
    expect(board.pieces["2,0"]).toBeUndefined();
  });

});

describe("pawn capture", function() {
  it("should report capturing spots if multiple captures are available", function() {
    board = new PlayingBoard({
      "1,5": new Piece('pawn', 'white'),
      "3,5": new Piece('pawn', 'white'),
      "0,6": new Piece('pawn', 'black'),
      "2,6": new Piece('pawn', 'black')
    });

    var captures = board.getPawnCaptures('white');

    expect(captures.length).toBe(3);
    expect(captures[0].src.x).toEqual(1);
    expect(captures[0].src.y).toEqual(5);
    expect(captures[1].src.x).toEqual(1);
    expect(captures[1].src.y).toEqual(5);
    expect(captures[2].src.x).toEqual(3);
    expect(captures[2].src.y).toEqual(5);
    expect(captures[0].dest.x).toEqual(0);
    expect(captures[0].dest.y).toEqual(6);
    expect(captures[1].dest.x).toEqual(2);
    expect(captures[1].dest.y).toEqual(6);
    expect(captures[2].dest.x).toEqual(2);
    expect(captures[2].dest.y).toEqual(6);

    expect(board.pieces['0,6'].colour).toBe('black');
    expect(board.pieces['2,6'].colour).toBe('black');
    expect(board.pieces['1,5'].colour).toBe('white');
    expect(board.pieces['3,5'].colour).toBe('white');
  });

  it("should not perform the capture immediately if only one capture is possible", function() {
    board = new PlayingBoard({
      "1,5": new Piece('pawn', 'white'),
      "0,6": new Piece('pawn', 'black')
    });

    var captures = board.getPawnCaptures('white');
    expect(captures.length).toBe(1);
    expect(captures[0].src.x).toEqual(1);
    expect(captures[0].src.y).toEqual(5);
    expect(captures[0].dest.x).toEqual(0);
    expect(captures[0].dest.y).toEqual(6);
    expect(board.pieces['0,6'].colour).toBe('black');
    expect(board.pieces['1,5'].colour).toBe('white');

    var result = board.move('white', new Position(1,5), new Position(0,6), 'pawn-capture');
    expect(result.type).toBe('capture');
    expect(board.pieces['1,5']).toBeUndefined();
    expect(board.pieces['0,6']).not.toBeUndefined();
    expect(board.pieces['0,6'].colour).toBe('white');
    expect(board.pieces['0,6'].type).toBe('pawn');
  });
});

describe("iw attack", function() {
  it("should target the pawn farthest from the king", function() {
    var target = new Piece('pawn', 'white');
    var board = new PlayingBoard({
      "0,4": new Piece('king', 'white'),
      "7,7": new Piece('queen', 'white'),
      "5,5": target
    });
    var attack = {
      attacker: 'black',
      type: 'psyop',
      strength: 'normal'
    };
    var result = board.psyop_attack(attack);
    expect(result).not.toBeUndefined();
    expect(result.type).toBe('capture');
    expect(result.captured_piece).toBe(target);
    expect(board.pieces['5,5']).toBeUndefined();
    expect(board.pieces['7,7']).not.toBeUndefined();
  });

  // TODO handle case where two pawns are equidistant from king

  it("should target the piece farthest from the king if there are no pawns", function() {
    var target = new Piece('pawn', 'white');
    var board = new PlayingBoard({
      "0,4": new Piece('king', 'white'),
      "5,5": new Piece('knight', 'white'),
      "7,7": target
    });
    var attack = {
      attacker: 'black',
      type: 'psyop',
      strength: 'normal'
    };
    var result = board.psyop_attack(attack);
    expect(result).not.toBeUndefined();
    expect(result.type).toBe('capture');
    expect(result.captured_piece).toBe(target);
    expect(board.pieces['5,5']).not.toBeUndefined();
    expect(board.pieces['7,7']).toBeUndefined();
  });

  it("should target the king if it is the only remaining piece", function() {
    var target = new Piece('king', 'white');
    var board = new PlayingBoard({
      "0,4": target
    });
    var attack = {
      attacker: 'black',
      type: 'psyop',
      strength: 'normal'
    };
    var result = board.psyop_attack(attack);
    expect(result).not.toBeUndefined();
    expect(result.type).toBe('capture');
    expect(result.captured_piece).toBe(target);
    expect(board.pieces['0,4']).toBeUndefined();
  });
});

describe("castling", function() {
  it("should report a potential move if castling is possible", function() {
    var king = new Piece('king', 'white');
    board = new PlayingBoard({
      "4,0": king,
      "0,0": new Piece('rook', 'white'),
      "7,0": new Piece('rook', 'white')
    });

    var castling_king = null;
    var castling_rook = null;
    var moves = board.getCastlingMoves(king, new Position("5,0"));
    expect(moves.kingside).not.toBeUndefined();
    expect(moves.queenside).not.toBeUndefined();

    var result = board.move('white', new Position(4,0), new Position(0,0));

    expect(result.type).toBe('castling');
    expect(board.pieces["0,0"]).toBeUndefined();
    expect(board.pieces["4,0"]).toBeUndefined();
    expect(board.pieces["2,0"]).not.toBeUndefined();
    expect(board.pieces["3,0"]).not.toBeUndefined();
    expect(board.pieces["2,0"].type).toBe('king');
    expect(board.pieces["3,0"].type).toBe('rook');
  });

  it("should not report a move if king and rook are not in position", function() {
    var king = new Piece('king', 'white');
    board = new PlayingBoard({
      "3,0": king,
      "0,0": new Piece('rook', 'white')
    });

    var castling_king = null;
    var moves = board.getCastlingMoves(king, new Position("3,0"));
    expect(moves.kingside).toBeFalsy();
    expect(moves.queenside).toBeFalsy();

    expect(function() {
      board.move('white', new Position(3,0), new Position(0,0));
    }).toThrow();
  });

  it("should not report a move another piece are between king and rook", function() {
    var king = new Piece('king', 'white');
    board = new PlayingBoard({
      "4,0": king,
      "3,0": new Piece('knight', 'white'),
      "0,0": new Piece('rook', 'white')
    });

    var castling_king = null;
    var moves = board.getCastlingMoves(king, new Position("4,0"));
    expect(moves.kingside).toBeFalsy();
    expect(moves.queenside).toBeFalsy();

    var do_it = function() {
      board.move('white', new Position(5,0), new Position(0,0));
    };
    expect(do_it).toThrow();
  });
});

return {
  name: "playing_board_spec"
};
});

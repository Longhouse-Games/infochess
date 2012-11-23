define(['lib/helper', 'lib/building_board'], function(HelperModule, BuildingBoardModule) {

var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;

describe("validatePosition", function() {
  var pos, board;

  beforeEach(function() {
    board = new BuildingBoard();
  });

  it("should return true for valid positions", function() {
    pos = new Position(0, 0);
    expect(board.validatePosition(pos)).toBe(true);

    pos = new Position(7, 7);
    expect(board.validatePosition(pos)).toBe(true);
  });

  it("should return false for invalid positions", function() {
    pos = new Position(-1, 0);
    expect(board.validatePosition(pos)).toBe(false);

    pos = new Position(0, 8);
    expect(board.validatePosition(pos)).toBe(false);
  });
});

describe("getPossiblePlacements", function() {

  var board;
  var pos;

  beforeEach(function() {
    board = new BuildingBoard();
    colour = "white";
  });

  describe("with an empty board", function() {
    it("should return all back row squares for a back row piece", function() {
      piece = new Piece('king', colour);
      results = board.getPossiblePlacements(piece);
      expect(results.length).toBe(8);
      for(var i = 0; i < 8; i++) {
        pos = results[i];
        expect(pos.x).toBe(i);
        expect(pos.y).toBe(piece.starting_row);
      }
    });

    it("should return all front row squares for a front row piece", function() {
      piece = new Piece('pawn', colour);
      results = board.getPossiblePlacements(piece);
      expect(results.length).toBe(8);
      for(var i = 0; i < 8; i++) {
        pos = results[i];
        expect(pos.x).toBe(i);
        expect(pos.y).toBe(piece.starting_row);
      }
    });
  });

  describe("with a piece already on the board", function() {
    it("should not return that occupied square", function() {
      piece = new Piece('rook', colour);
      pos = new Position(0,0);
      board.addPiece(piece, pos);

      var positions = board.getPossiblePlacements(piece);
      expect(positions.length).toBe(7);
      for (var i = 0; i < 7; i++) {
        pos = positions[i];
        expect(pos.x).toBe(i+1);
        expect(pos.y).toBe(piece.starting_row);
      }
    });
  });

  describe("when a piece type has already reached limits", function() {
    it("should return an empty array", function() {
      piece = new Piece('king', colour);
      pos = new Position(0,0);
      board.addPiece(piece, pos);

      expect(board.getPossiblePlacements(piece).length).toBe(0);
    });
  });
});

describe("removePiece", function() {
  var board, pos, piece;
  beforeEach(function() {
    board = new BuildingBoard();
  });

  it("should raise when removing a piece that's not there", function() {
    pos = new Position(0,0);
    var remove_it = function() {
      board.removePiece(pos);
    };
    expect(remove_it).toThrow();
  });

  it("should return the piece removed", function() {
    piece = new Piece('king', 'white');
    pos = new Position(0,0);

    board.addPiece(piece, pos);
    expect(board.removePiece(pos)).toBe(piece);
  });

  it("should remove the piece from the board", function() {
    piece = new Piece('king', 'white');
    pos = new Position(0,0);

    board.addPiece(piece, pos);
    expect(board.removePiece(pos)).toNotBe(false);
    expect(board.canAddPiece(piece, pos)).toBe(true);
  });
});

describe("canAddPiece", function() {

  var piece;
  var pos;
  var row;
  var colour;
  var board;

  beforeEach(function() {
    board = new BuildingBoard();
    colour = "white";
  });

  it("should return true if the board position is unoccupied", function() {
    piece = new Piece('king', colour);
    pos = new Position(0,piece.starting_row);

    expect(board.canAddPiece(piece, pos)).toBe(true);
  });

  it("should return false if the board position is occupied", function() {
    piece = new Piece('king', colour);
    pos = new Position(0,piece.starting_row);

    board.addPiece(piece, pos);
    expect(board.canAddPiece(piece, pos)).toBe(false);
  });

  describe("with a bishop", function() {
    it("should reject a bishop on another white square", function() {
      piece = new Piece('bishop', 'white');
      first = new Position(0,0);
      second = new Position(2,0);

      board.addPiece(piece, first);

      expect(board.canAddPiece(piece, second)).toBe(false);
    });

    it("should reject a bishop on another black square", function() {
      piece = new Piece('bishop', 'white');
      first = new Position(1,0);
      second = new Position(3,0);

      board.addPiece(piece, first);

      expect(board.canAddPiece(piece, second)).toBe(false);
    });

    it("should permit a bishop on a different coloured square", function() {
      piece = new Piece('bishop', 'white');
      first = new Position(0,0);
      second = new Position(1,0);

      board.addPiece(piece, first);

      expect(board.canAddPiece(piece, second)).toBe(true);
    });
  });

  describe("with a back row piece", function() {
    it("should return false is position isn't in back row", function() {
      piece = new Piece('king', colour);
      pos = new Position(1,1);

      expect(board.canAddPiece(piece, pos)).toBe(false);
    });

    it("should return true when position is in back row", function() {
      piece = new Piece('king', colour);
      pos = new Position(0,piece.starting_row);

      expect(board.canAddPiece(piece, pos)).toBe(true);
    });
  });

  describe("with a front row piece", function() {
    it("should return false when position isn't in front row", function() {
      piece = new Piece('pawn', colour);
      pos = new Position(0, piece.starting_row + 1);

      expect(board.canAddPiece(piece, pos)).toBe(false);
    });

    it ("should return true when position is in front row", function() {
      piece = new Piece('pawn', colour);
      pos = new Position(0, piece.starting_row);

      expect(board.canAddPiece(piece, pos)).toBe(true);
    });
  });

  it("should reject too many of the same pieces", function() {
    piece = new Piece('king', colour);
    pos1 = new Position(0, piece.starting_row);
    pos2 = new Position(1, piece.starting_row);

    board.addPiece(piece, pos1);

    expect(board.canAddPiece(piece, pos2)).toBe(false);
  });

  it("should reject a piece that cost over the point limit", function() {
    piece = new Piece('pawn', colour);
    for (var i = 0; i < 8; i++) {
      pos = new Position(i, piece.starting_row);
      board.addPiece(piece, pos);
    }

    piece = new Piece('queen', colour);
    pos = new Position(0, piece.starting_row);
    expect(board.canAddPiece(piece, pos)).toBe(false);
  });
});

describe("serialization", function() {
  var board;
  it("should not serialize certain attributes", function() {
    board = new BuildingBoard();

    board.addPiece(new Piece('king', 'white'), new Position(0, 0));
    board.addPiece(new Piece('queen', 'white'), new Position(1, 0));

    dto_string = board.serialize();
    dto = JSON.parse(dto_string);
    expect(dto).not.toBeUndefined();
    expect(dto).not.toBeNull();
    expect(dto['max_points']).toBeUndefined();
    var king = dto['pieces']['0,0'];
    expect(king).not.toBeUndefined();
    var queen = dto['pieces']['1,0'];
    expect(queen).not.toBeUndefined();
  });
});

describe("deserialisation", function() {

  var json;

  it("should reject garbage", function() {
    json = "NOT VALID JSON";
    var do_it = function() {
      board = new BuildingBoard(json);
    };
    expect(do_it).toThrow();
  });

  it("should ignore unknown attributes", function() {
    json = '{ "pieces": [], "foo": "bar" }';
    board = new BuildingBoard(json);
    expect(board.foo).toBeUndefined();
  });

  it("should explode when given protected attributes", function() {
    json = '{ "pieces": [], "max_points": 5000000 }';

    var do_it = function() {
      board = new BuildingBoard(json);
    };
    expect(do_it).toThrow();
  });

  it("should throw when given a set of pieces of different colours", function() {
    json = '{ "pieces": { "0,0": { "type": "king", "cost": 0, "limit": 1, "colour": "white", "starting_row": 0 },' +
      '"0,7": {"type": "queen", "cost": 3, "limit": 1, "colour": "black", "starting_row": 7} } }';
    var do_it = function() {
      board = new BuildingBoard(json);
    };
    expect(do_it).toThrow();
  });

  it("should accept valid attributes", function() {
    json = '{ "pieces": { "0,0": { "type": "king", "cost": 0, "limit": 1, "colour": "white", "starting_row": 0 } } }';
    board = new BuildingBoard(json);
    var king = board.pieces["0,0"];
    expect(king).not.toBeUndefined();
    expect(king.type).toBe("king");
    expect(king.cost).toBe(0);
    expect(king.limit).toBe(1);
    expect(king.colour).toBe("white");
    expect(king.starting_row).toBe(0);
  });
});

return {
  name: "building_board_spec"
};
});

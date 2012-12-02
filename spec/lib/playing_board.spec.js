define(['spec/spec_helper', 'lib/helper', 'lib/playing_board', 'lib/building_board'],
    function(SpecHelper, HelperModule, PlayingBoardModule, BuildingBoardModule) {

var PlayingBoard = PlayingBoardModule.PlayingBoard;
var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var makeArmy = SpecHelper.makeArmy;

describe("player views", function() {
  var board;

  beforeEach(function() {
    var whiteArmy = makeArmy('black');
    var blackArmy = makeArmy('white');

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

return {
  name: "playing_board_spec"
};
});

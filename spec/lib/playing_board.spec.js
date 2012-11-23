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

return {
  name: "playing_board_spec"
};
});

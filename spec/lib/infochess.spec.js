define(
    ['spec/spec_helper', 'lib/helper', 'lib/building_board', 'lib/playing_board', 'lib/infochess'],
    function(SpecHelper, HelperModule, BuildingBoardModule, PlayingBoardModule, InfoChess) {

var BuildingBoard = BuildingBoardModule.BuildingBoard;
var PlayingBoard = PlayingBoardModule.PlayingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var InfoChess = InfoChess.InfoChess;
var makeBuildingBoard = SpecHelper.makeBuildingBoard;

describe("setArmy", function() {
  var infochess;
  beforeEach(function() {
    infochess = new InfoChess();
  });

  it("should throw if the game has started", function() {
    infochess.currentPhase = infochess.PHASES.DEFENSE;

    var do_it = function() {
      infochess.setArmy(infochess.ROLES.WHITE, new BuildingBoard().serialize());
    };

    expect(do_it).toThrow();
  });

  it("should start the game once both armies are set", function() {
    infochess.setArmy(infochess.ROLES.WHITE, makeBuildingBoard('white').serialize());
    infochess.setArmy(infochess.ROLES.BLACK, makeBuildingBoard('black').serialize());
    expect(infochess.currentPhase).toBe(infochess.PHASES.MOVE);
    expect(infochess.currentRole).toBe(infochess.ROLES.WHITE);
  });
});

describe("validateRole", function() {

  var infochess;
  beforeEach(function() {
    infochess = new InfoChess();
  });

  it("should throw when given a bad role", function() {
    var do_it = function() {
      infochess.validateRole('jklfdjalkfjdakljflk');
    };
    expect(do_it).toThrow();
  });

  it("should not throw when given a correct role", function() {
    var do_it = function() {
      infochess.validateRole('white');
    };
    expect(do_it).not.toThrow();
  });

});

return {
  name: "infochess_spec"
};
});

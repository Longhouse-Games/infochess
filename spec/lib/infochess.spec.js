define(
    ['spec/spec_helper', 'lib/helper', 'lib/building_board', 'lib/playing_board', 'lib/infochess'],
    function(SpecHelper, HelperModule, BuildingBoardModule, PlayingBoardModule, InfoChess) {

var context = describe;
var WHITE = InfoChess.metadata.roles[0].slug;
var BLACK = InfoChess.metadata.roles[1].slug;
var ROLES = {
  WHITE: WHITE,
  BLACK: BLACK
};
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
      infochess.setArmy(WHITE, new BuildingBoard().serialize());
    };

    expect(do_it).toThrow();
  });

  it("should start the game once both armies are set", function() {
    infochess.setArmy(WHITE, makeBuildingBoard('white').serialize());
    infochess.setArmy(BLACK, makeBuildingBoard('black').serialize());
    expect(infochess.currentPhase).toBe(infochess.PHASES.MOVE);
    expect(infochess.currentRole).toBe(WHITE);
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

describe("getPawnCaptures()", function() {
  var infochess;
  beforeEach(function() {
    infochess = new InfoChess();
    infochess.setArmy(WHITE, makeBuildingBoard('white').serialize());
    infochess.setArmy(BLACK, makeBuildingBoard('black').serialize());
  });

  context("when no targets can be captured", function() {
    it("should not set the phase to be pawn_capture", function() {
      var captures = infochess.getPawnCaptures();
      expect(captures.length).toBe(0);
      expect(infochess.getCurrentPhase()).toBe(infochess.PHASES.MOVE);
    });
  });
});

context("as a restricted instance that can't see all the pieces", function() {
  describe("getWinner()", function() {
    var infochess;
    beforeEach(function() {
      infochess = new InfoChess();
    });

    it("should return the winner if a king is captured", function() {
      infochess.setArmy(WHITE, (new BuildingBoard()).addPiece(new Piece('king', WHITE), new Position(0,0)).serialize());
      infochess.setArmy(BLACK, (new BuildingBoard()).addPiece(new Piece('king', BLACK), new Position(0,7)).serialize());
      infochess.move(WHITE, new Position(0,0), new Position(0,1));
      infochess.iw_attack(WHITE, {type: 'psyop', strength: 'reinforced'});
      infochess.iw_defense(BLACK, {defend: false});

      expect(infochess.getCurrentPhase()).toBe(infochess.PHASES.GAMEOVER);
      expect(infochess.getWinner()).toBe(WHITE);
    });

    it("should not report a winner just because it can't see the opponent's king", function() {
      infochess.setArmy(WHITE, makeBuildingBoard('white').serialize());
      infochess.setArmy(BLACK, makeBuildingBoard('black').serialize());
      var client_infochess = new InfoChess();
      client_infochess.fromDTO(infochess.asDTO(WHITE));
      expect(client_infochess.getCurrentPhase()).toBe(infochess.PHASES.MOVE);
      expect(client_infochess.getWinner()).toBe(null);
    });
  });
});

describe("IW attacks", function() {
  var infochess;
  describe("when a player has run out of IW points", function() {
    beforeEach(function() {
      infochess = new InfoChess();
    });
    it("should reject the message", function() {
      infochess.setArmy(WHITE, makeBuildingBoard('white').serialize());
      infochess.setArmy(BLACK, makeBuildingBoard('black').serialize());
      infochess.board.remainingIW = { white: 0, black: 0 };
      infochess.move(WHITE, new Position(0,1), new Position(0,2));
      expect(function() {
        infochess.iw_attack('white', { type: 'psyop', strength: 'reinforced' });
      }).toThrow();
      expect(infochess.getCurrentPhase()).toBe(infochess.PHASES.IW);
    });
  });
});

describe("IW defense", function() {
  var infochess;
  describe("when the defender has run out of IW points", function() {
    beforeEach(function() {
      infochess = new InfoChess();
    });
    it("should reject the message", function() {
      infochess.setArmy(WHITE, makeBuildingBoard('white').serialize());
      infochess.setArmy(BLACK, makeBuildingBoard('black').serialize());
      infochess.board.remainingIW = { white: 10, black: 0 };
      infochess.move(WHITE, new Position(0,1), new Position(0,2));
      infochess.iw_attack('white', { type: 'psyop', strength: 'reinforced' });
      expect(function() {
        infochess.iw_defense('black', { defend: true });
      }).toThrow();
    });
  });
});

return {
  name: "infochess_spec"
};
});

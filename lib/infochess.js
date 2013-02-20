define(['underscore', 'lib/helper', 'lib/playing_board', 'lib/building_board'],
    function(_, HelperModule, PlayingBoardModule, BuildingBoardModule) {

var ROLES = {
  WHITE: 'white',
  BLACK: 'black'
};

var Metadata = function() {
  this.name = "InfoChess";
  this.slug = "infochess";
  this.roles = [
    { name: "White", slug: ROLES.WHITE },
    { name: "Black", slug: ROLES.BLACK }
  ];
};

var PlayingBoard = PlayingBoardModule.PlayingBoard;
var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var InvalidMessageError = HelperModule.InvalidMessageError;

/**
 * The current state of a guerrilla checkers game.
 */
function InfoChess() {
  var me = this;
  me.initialArmies = {};

  me.ROLES = ROLES;

  me.PHASES = {
    SETUP: 'setup',
    DEFENSE: 'defense',
    PAWNCAPTURE: 'pawn-capture',
    MOVE: 'move',
    PAWNUPGRADE: 'pawn-upgrade',
    IW: 'iw',
    GAMEOVER: 'gameover'
  };

  me.currentPhase = me.PHASES.SETUP;
  me.currentRole = me.ROLES.WHITE;

  me.getCurrentPhase = function() {
    return me.currentPhase;
  };

  me.getCurrentRole = function() {
    return me.currentRole;
  };
}

InfoChess.prototype.isWhiteTurn = function() {
  return this.currentRole === this.ROLES.WHITE;
};

InfoChess.prototype.isBlackTurn = function() {
  return this.currentRole === this.ROLES.BLACK;
};

InfoChess.prototype.asDTO = function(role) {
  var dto = {
    currentPhase: this.currentPhase,
    currentRole: this.currentRole,
  };
  if (this.board) {
    dto.currentPsyOpAttackCost = this.board.getCurrentPsyOpAttackCost();
    dto.currentPsyOpDefendCost = this.board.getCurrentPsyOpDefendCost();
    dto.currentEWAttackCost = this.board.getCurrentEWAttackCost();
    dto.currentEWDefendCost = this.board.getCurrentEWDefendCost();
    dto.feintCost = this.board.getFeintCost();

    if (role && this.board) {
      dto.board = this.board.getViewPieces(role);
      dto.remainingIW = this.board.getRemainingIW(role);
      dto.last_move = this.board.getLastMove(role);
    } else {
      dto.board = this.board.getPieces();
      dto.remainingIW = this.board.remainingIW;
      dto.last_move = this.board.last_move;
    }
  }
  return dto;
};

InfoChess.prototype.fromDTO = function(data) {
  this.currentPhase = data.currentPhase;
  this.currentRole = data.currentRole;
  this.currentPsyOpAttackCost = data.currentPsyOpAttackCost;
  this.currentPsyOpDefendCost = data.currentPsyOpDefendCost;
  this.currentEWAttackCost = data.currentEWAttackCost;
  this.currentEWDefendCost = data.currentEWDefendCost;
  this.feintCost = data.feintCost;
  this.remainingIW = data.remainingIW;
  this.board = new PlayingBoard(data.board);
  this.board.last_move = data.last_move;
};

InfoChess.prototype.validateRole = function(role) {
  if (!_.contains(this.ROLES, role)) throw new InvalidMessageError("Invalid role: " + role);
};

InfoChess.prototype.setArmy = function(role, serializedArmy) {
  var me = this;

  this.validateRole(role);
  if (this.currentPhase !== this.PHASES.SETUP) {
    console.log("Current Phase: " + this.currentPhase);
    throw new InvalidMessageError("Initial armies cannot be changed after the setup phase.");
  }

  this.initialArmies[role] = new BuildingBoard(serializedArmy);
  console.log("Got army for " + role + ", saving it");
  var thing = _.select(this.ROLES, function(value) {
    return me.initialArmies[value] === undefined;
  });
  if (thing.length === 0) {
    this.startGame();
  }
};

InfoChess.prototype.startGame = function() {
  this.currentPhase = this.PHASES.MOVE;
  this.currentRole = this.ROLES.WHITE;
  this.board = new PlayingBoard( this.initialArmies[this.ROLES.WHITE], this.initialArmies[this.ROLES.BLACK]);
};

InfoChess.prototype.nextPhase = function() {
  console.log("NextPhase() called. Current Phase: " + this.currentPhase);
  var phase = this.currentPhase;
  var PHASES = this.PHASES;

  var new_phase;

  if (phase === PHASES.DEFENSE) {
    if (this.current_iw_attack && this.current_iw_attack.type === 'ew') {
      new_phase = PHASES.IW;
    } else {
      new_phase = PHASES.MOVE;
    }
  } else if (phase === PHASES.MOVE || phase === PHASES.PAWNCAPTURE || phase === PHASES.PAWNUPGRADE) {
    new_phase = PHASES.IW;
  } else if (phase === PHASES.IW) {
    if (this.current_iw_attack) {
      new_phase = PHASES.DEFENSE;
    } else {
      new_phase = PHASES.MOVE;
    }
    this.nextPlayer();
  } else {
    throw "Invalid phase for nextPhase(): " + phase;
  }

  this.currentPhase = new_phase;
  console.log("New phase is " + this.currentPhase);
  return this.currentPhase;
};

InfoChess.prototype.nextPlayer = function() {
  if (this.currentRole === this.ROLES.WHITE) {
    this.currentRole = this.ROLES.BLACK;
  } else {
    this.currentRole = this.ROLES.WHITE;
  }
};

InfoChess.prototype.verifyPhase = function(phase) {
  return this.getCurrentPhase() === phase;
};

InfoChess.prototype.getWinner = function() {
  if (this.getCurrentPhase() === this.PHASES.SETUP) {
    return null;
  }

  var white_king, black_king;
  var pieces = this.getPieces();
  for (var pos_key in pieces) {
    if (pieces.hasOwnProperty(pos_key)) {
      if (pieces[pos_key].type === 'king') {
        if (pieces[pos_key].colour === 'white') {
          white_king = pieces[pos_key];
        } else if (pieces[pos_key].colour === 'black') {
          black_king = pieces[pos_key];
        }
      }
    }
  }

  if (!white_king || !black_king) {
    this.currentPhase = this.PHASES.GAMEOVER;
    if (!white_king) {
      return 'black';
    }
    if (!black_king) {
      return 'white';
    }
  }

  return null;
};

InfoChess.prototype.getPieces = function() {
  if (this.pieces) {
    return this.pieces;
  }
  if (this.board) {
    return this.board.getPieces();
  }
  return {};
}

InfoChess.prototype.getPossibleMoves = function(piece, position) {
  return this.board.getPossibleMoves(piece, position);
};

InfoChess.prototype.getPawnCaptures = function(role) {
  if (this.currentPhase !== this.PHASES.MOVE && this.currentPhase !== this.PHASES.PAWNCAPTURE) {
    throw new InvalidMessageError("Invalid phase for pawn capturing: "+this.currentPhase);
  }
  var captures = this.board.getPawnCaptures(role);
  this.currentPhase = this.PHASES.PAWNCAPTURE;
  return captures;
};

InfoChess.prototype.getCastlingMoves = function(piece, position) {
  return this.board.getCastlingMoves(piece, position);
};

InfoChess.prototype.validateCurrentRole = function(role) {
  this.validateRole(role);
  if (this.getCurrentRole() !== role) {
    throw new InvalidMessageError("It is not your turn!");
  };
};

InfoChess.prototype.validateIWAttackOptions = function(options) {
  var type = options.type;
  if (!type || (type !== 'psyop' && type !== 'ew' && type !== 'feint')) {
    throw new InvalidMessageError("Invalid IW attack type '"+type+"'. Must be one of 'psyop','ew' or 'feint'");
  }
  var reinforced = options.reinforced;
  if (type !== 'feint' && typeof reinforced === 'undefined') {
    throw new InvalidMessageError("Invalid IW attack. Reinforcment choice is not present.");
  }
};

InfoChess.prototype.validateIWPhase = function() {
  // check to ensure that the player has moved already
  if (this.currentPhase !== this.PHASES.IW) {
    throw new InvalidMessageError("IW attacks may not be performed during this phase. Current phase is "+this.currentPhase);
  }
};

InfoChess.prototype.endTurn = function(role) {
  this.validateCurrentRole(role);
  this.validateIWPhase();
  this.nextPhase();
};

InfoChess.prototype.getIWCost = function(options, ewFunc, psyFunc) {
  var me = this;
  var type = options.type;
  if (type === 'feint') {
    return 1;
  } else if (type === 'ew') {
    return ewFunc.apply(me.board);
  } else if (type === 'psyop') {
    return psyFunc.apply(me.board);
  } else {
    throw new InvalidMessageError("Invalid IW attack type: " + type);
  }
};

InfoChess.prototype.getIWAttackCost = function(options) {
  var me = this;
  return this.getIWCost(options, function() {
    return me.board.getCurrentEWAttackCost() + (options.reinforced ? 1 : 0);
  }, function() {
    return me.board.getCurrentPsyOpAttackCost() + (options.reinforced ? 1 : 0);
  });
};

InfoChess.prototype.getIWDefendCost = function(options) {
  var me = this;
  var value = this.getIWCost(options, me.board.getCurrentEWDefendCost, me.board.getCurrentPsyOpDefendCost);
  console.log("IW Defend cost: " + value);
  return value;
};

InfoChess.prototype.pawn_upgrade = function(role, new_type) {
  this.validateCurrentRole(role);

  if (this.currentPhase !== this.PHASES.PAWNUPGRADE) {
    throw InvalidMessageError("Invalid phase for pawn-upgrade. Current phase: " + this.currentPhase);
  }

  this.nextPhase();

  return this.board.pawn_upgrade(role, new_type);
};

InfoChess.prototype.iw_attack = function(role, options) {
  console.log("IW attack from "+role+"! Options:");
  console.log(options);
  // check to ensure that it is actually the players turn
  this.validateCurrentRole(role);

  this.validateIWPhase();
  this.validateIWAttackOptions(options);

  var type = options.type;
  var reinforced = options.reinforced;

  var cost = this.getIWAttackCost(options);

  // check if enough IW points are available
  if (this.board.getRemainingIW(role) < cost) {
    throw InvalidMessageError("You do not have enough remaining IW points to perform that attack.");
  }

  // record that this player is doing a psyop attack
  this.current_iw_attack = options;
  this.current_iw_attack.attacker = role;
  this.nextPhase();
  // if (opposing player has enough IW to try to defend)
    // notify the opposing player that he must choose to defend or not
  // else TODO
    // skip prompting and perform the psyop attack directly
  var result = {
    defense_cost: this.getIWDefendCost(options)
  };
  return result;
};

InfoChess.prototype.iw_defense = function(role, options) {
  this.validateCurrentRole(role);
  if (typeof options.defend === 'undefined') {
    throw new InvalidMessageError("Invalid parameters for 'iw_defense' message. 'Defend' must be specified.");
  }
  // check that this player should have been prompted to defend (there is an iw attack happening)
  if (this.currentPhase !== this.PHASES.DEFENSE) {
    throw new InvalidMessageError("Invalid phase for IW defense. Current phase: " + this.currentPhase);
  }

  var attack_cost = this.getIWAttackCost({type: this.current_iw_attack.type, reinforced: false});
  var defense_cost = 0;

  this.board.remainingIW[this.current_iw_attack.attacker] -= attack_cost;

  if (options.defend === true) {
    defense_cost = this.getIWDefendCost(this.current_iw_attack);
    console.log(role + " has chosen to defend. Defense cost: " + defense_cost);
    console.log(role + " has " + this.board.remainingIW[role] + " IW points left before defending");
    // check if this player has enough IW left to defend
    if (this.board.getRemainingIW(role) < defense_cost) {
      throw new InvalidMessageError("You do not have enough remaining IW points to defend against this attack!");
    }

    this.board.remainingIW[role] -= defense_cost;
    console.log(role + " has " + this.board.remainingIW[role] + " IW points left after defending");

    if (!this.current_iw_attack.reinforced) {
      // defense successful
      if (this.current_iw_attack.type === 'psyop') {
        this.board.psyop_defense();
      } else if (this.current_iw_attack.type === 'ew') {
        this.board.ew_defense();
      } else if (this.current_iw_attack.type !== 'feint') {
        throw new InvalidMessageError("Unknown IW attack type: " + this.current_iw_attack.type);
      }
      this.current_iw_attack = null;
      this.nextPhase();
      return { defense: true };
    }
  }
  var result;
  if (this.current_iw_attack.type === 'psyop') {
    result = this.board.psyop_attack(this.current_iw_attack);
    result.attack = 'psyop';
  } else if (this.current_iw_attack.type === 'ew') {
    result = { attack: 'ew', defender: role };
  } else if (this.current_iw_attack.type === 'feint') {
    result = { attack: 'feint' };
  }
  this.nextPhase();
  this.current_iw_attack = null;
  return result;
};

InfoChess.prototype.move = function(role, src, dest) {
  var src_pos = new Position(src.x, src.y);
  var dest_pos = new Position(dest.x, dest.y);

  var pieces = this.board.getPieces();

  if (!pieces[src_pos.asKey()] || pieces[src_pos.asKey()].colour !== role) {
    throw new InvalidMessageError("Invalid move given. There is no "+role+" piece at "+src_pos.asKey());
  }

  console.log("Moving. Phase: " + this.currentPhase);
  console.log(arguments);

  if (this.currentPhase === this.PHASES.PAWNCAPTURE) {
    if (!pieces[dest_pos.asKey()] && !this.board.isLastMoveEnPassant()) {
      throw new InvalidMessageError("Invalid pawn-capturing move. The given target "+dest_pos.asKey()+" is not a valid pawn-capture target.");
    }
    if (pieces[src_pos.asKey()].type !== 'pawn' &&
        !this.board.isLastMoveEnPassant() &&
        (pieces[dest_pos.asKey()] && pieces[dest_pos.asKey()].invisible !== true)) {
      throw new InvalidMessageError("After pawn capture has been started, only those moves can be chosen.");
    }
  }

  var result = this.board.move(role, src, dest, this.currentPhase);

  if (result.pawn_upgrade) {
    this.currentPhase = this.PHASES.PAWNUPGRADE;
  } else {
    this.nextPhase();
  }

  return result;
};

return {
  InfoChess: InfoChess,
  Metadata: Metadata
};

});

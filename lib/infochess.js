define(['underscore', 'lib/helper', 'lib/playing_board', 'lib/building_board'],
    function(_, HelperModule, PlayingBoardModule, BuildingBoardModule) {

var ROLES = {
  WHITE: 'white',
  BLACK: 'black'
};

var create = function(gamestate) {
  var game = new InfoChess();
  if (gamestate) {
    game.fromDTO(gamestate);
  }
  return game;
};

var metadata = {
  name: "InfoChess",
  slug: "infochess",
  roles: [
    { name: "White", slug: ROLES.WHITE },
    { name: "Black", slug: ROLES.BLACK }
  ]
};

var PlayingBoard = PlayingBoardModule.PlayingBoard;
var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;
var InvalidMessageError = HelperModule.InvalidMessageError;

function InfoChess() {
  var me = this;
  me.initialArmies = {};
  me.winner = null;
  me.turn_count = 1;

  me.ROLES = ROLES;
  me.history = {
    game: []
  };
  _.each(me.ROLES, function(role) {
    me.history[role] = [];
  });

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
  me.previousTurn = null; // Records outcome of previous turn, for easy presentation in the client

  /*
   * Records the outcome of a turn
   * `role` is the player's turn. One of 'white' or 'black'.
   *
   * `move` contains the outcome of the player's physical move. If they didn't
   * get a physical move because they experienced an e-warfare attack, this
   * will be `null`. If a pawnbump occured during this move, it is not noted here.
   * If a pawn was upgraded, `move.upgraded_type` will be presented and will
   * contain the pawn's new type. If a piece was captured, `move.captured_piece`
   * will contain the type of the piece that was captured.
   *
   * `iw_attack` contains the outcome of the IW attack. `iw_attack.type` will be
   * one of `psyop`, `ew`, or `null`, indicating that no attack was made. The
   * strength of the initial attack is not present.
   *
   * The outcome of the IW attack will be given in `iw_attack.outcome`, and 
   * structured depending on the attack type. For `psyop`:
   * {
   *   success: boolean (true if undefended/defense failed, or if they defended a feint),
   *   outcome: {
   *     type: piece_type,  // type of the captured piece
   *     location: Position // where the piece was captured
   *   }
   * }
   *
   * `ew` outcomes are structured the same as `psyop`, just without the `captured_piece`
   * entry.
   */
  me.currentTurn = this.initTurnReport();

  me.getCurrentPhase = function() {
    return me.currentPhase;
  };

  me.getCurrentRole = function() {
    return me.currentRole;
  };
}

InfoChess.prototype.initTurnReport = function() {
  return {
    role: null,
    move: {
      moving_piece: null,
      src: null,
      dest: null,
      upgraded_type: null,
      captured_piece: null,
      invisible: false
    },
    iw_attack: {
      outcome: null
    }
  };
};

InfoChess.prototype.cycleTurnReport = function() {
  this.last_turn_report = this.currentTurn;
  this.currentTurn = this.initTurnReport();
};

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
    winner: this.winner,
    history: this.history
  };
  if (this.board) {
    dto.currentPsyOpAttackCost = this.board.getCurrentPsyOpAttackCost();
    dto.currentPsyOpDefendCost = this.board.getCurrentPsyOpDefendCost();
    dto.currentEWAttackCost = this.board.getCurrentEWAttackCost();
    dto.currentEWDefendCost = this.board.getCurrentEWDefendCost();
    dto.feintCost = this.board.getFeintCost();
    dto.turn_count = this.turn_count;

    if (role && this.board) {
      dto.board = this.board.getViewPieces(role);
      dto.remainingIW = this.board.getRemainingIW(role);
      dto.castlingState = {};
      dto.castlingState[role] = this.board.castlingState[role];
      dto.last_move = this.board.getLastMove(role);
      dto.history = this.history[role];
      if (this.last_turn_report && this.last_turn_report.move.invisible && role !== this.last_turn_report.role) {
        dto.last_turn_report = this.last_turn_report;
        delete dto.last_turn_report.move.moving_piece;
        delete dto.last_turn_report.move.src;
        delete dto.last_turn_report.move.dest;
      } else {
        dto.last_turn_report = this.last_turn_report;
      }
      if (this.current_iw_attack) {
        dto.current_iw_attack = {
          attacker: this.current_iw_attack.attacker,
          type: this.current_iw_attack.type,
          defense_cost: this.getIWDefendCost(this.current_iw_attack)
        };
      }
    } else {
      dto.board = this.board.getPieces();
      dto.remainingIW = this.board.remainingIW;
      dto.castlingState = this.board.castlingState;
      dto.last_move = this.board.last_move;
      dto.current_iw_attack = this.current_iw_attack;
      dto.currentTurn = this.currentTurn;
      dto.last_turn_report = this.last_turn_report;
    }
  }
  return dto;
};

InfoChess.prototype.fromDTO = function(data) {
  this.winner = data.winner;
  this.turn_count = data.turn_count;
  this.last_turn_report = data.last_turn_report;
  this.currentTurn = data.currentTurn;
  this.currentPhase = data.currentPhase;
  this.currentRole = data.currentRole;
  this.current_iw_attack = data.current_iw_attack;
  this.feintCost = data.feintCost;
  this.board = new PlayingBoard(data.board);
  this.board.currentPsyOpAttackCost = data.currentPsyOpAttackCost;
  this.board.currentPsyOpDefendCost = data.currentPsyOpDefendCost;
  this.board.currentEWAttackCost = data.currentEWAttackCost;
  this.board.currentEWDefendCost = data.currentEWDefendCost;
  if (data.remainingIW || data.remainingIW === 0) {
    this.board.remainingIW = data.remainingIW;
  }
  if (data.castlingState) {
    this.board.castlingState = data.castlingState;
  } else {
    this.board.initCastlingState();
  }
  this.board.last_move = data.last_move;
  if (data.history) {
    this.history = data.history;
  }
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

InfoChess.prototype.clearArmy = function(role) {
  if (this.currentPhase !== this.PHASES.SETUP) {
    throw new InvalidMessageError("Initial armies cannot be changed after the setup phase.");
  }
  delete this.initialArmies[role];
};

InfoChess.prototype.startGame = function() {
  this.currentPhase = this.PHASES.MOVE;
  this.currentRole = this.ROLES.WHITE;
  this.currentTurn.role = this.currentRole;
  this.board = new PlayingBoard( this.initialArmies[this.ROLES.WHITE], this.initialArmies[this.ROLES.BLACK]);
  this.addHistory(this.HISTORY_TYPES.GAME_STARTED, "Game started.");
};

InfoChess.prototype.nextPhase = function() {
  console.log("NextPhase() called. Current Phase: " + this.currentPhase);
  var phase = this.currentPhase;
  var PHASES = this.PHASES;

  var new_phase;

  var winner;
  if (winner = this.checkForWinner()) {
    this.winner = winner;
    new_phase = PHASES.GAMEOVER;
    this.cycleTurnReport();
  } else if (phase === PHASES.DEFENSE) {
    if (this.current_iw_attack && this.current_iw_attack.type === 'ew' && this.current_iw_attack.strength !== 'feint') {
      new_phase = PHASES.IW;
    } else {
      new_phase = PHASES.MOVE;
    }
    this.cycleTurnReport();
    this.currentTurn.role = this.currentRole;
  } else if (phase === PHASES.MOVE || phase === PHASES.PAWNCAPTURE || phase === PHASES.PAWNUPGRADE) {
    new_phase = PHASES.IW;
  } else if (phase === PHASES.IW) {
    this.nextPlayer();
    this.turn_count += 1;
    if (this.current_iw_attack) {
      new_phase = PHASES.DEFENSE;
    } else {
      this.cycleTurnReport();
      this.currentTurn.role = this.currentRole;
      new_phase = PHASES.MOVE;
    }
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

InfoChess.prototype.getScores = function() {
  //InfoChess don't score.
  var scores = {};
  scores[this.ROLES.WHITE] = 0;
  scores[this.ROLES.BLACK] = 0;
  return scores;
};

// Declare the game a draw. No one wins. Game state is GAME_OVER
InfoChess.prototype.draw = function() {
  if (this.isGameOver()) {
    throw new Error("Game has already ended");
  }
  console.log("Draw has been offered and accepted. Game over.");
  this.currentPhase = this.PHASES.GAMEOVER;
  this.addHistory(this.HISTORY_TYPES.DRAW, "The game has ended in a draw.");
  return;
};

InfoChess.prototype.forfeit = function(role) {
  if (role !== metadata.roles[0].slug && role !== metadata.roles[1].slug) {
    throw new Error("Invalid role: " + role);
  }
  if (this.isGameOver()) {
    throw new Error("Game has already ended");
  }

  for (var i = 0; i < metadata.roles.length; i++) {
    if (metadata.roles[i].slug !== role) {
      this.winner = metadata.roles[i].slug;
      this.addHistory(this.HISTORY_TYPES.FORFEIT, role + " has forfeit the game.");
      return;
    }
  }
};

InfoChess.prototype.checkForWinner = function() {
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
    var winning_role;
    if (!white_king) {
      winning_role = 'black';
    }
    if (!black_king) {
      winning_role = 'white';
    }
    this.addHistory(this.HISTORY_TYPES.GAMEOVER, "Game is over. Winner: " + winning_role+".");
    this.winner = winning_role;
    return winning_role;
  }

  return null;
}

InfoChess.prototype.isGameOver = function() {
  if (this.getCurrentPhase() === this.PHASES.GAMEOVER) {
    return null;
  }
};

InfoChess.prototype.getWinner = function() {
  if (this.getCurrentPhase() !== this.PHASES.GAMEOVER) {
    return null;
  }

  return this.winner;
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
  if (captures.length > 0) {
    this.currentPhase = this.PHASES.PAWNCAPTURE;
  }
  return captures;
};

InfoChess.prototype.getCastlingMoves = function(piece) {
  return this.board.getCastlingMoves(piece);
};

InfoChess.prototype.validateCurrentRole = function(role) {
  this.validateRole(role);
  if (this.getCurrentRole() !== role) {
    throw new InvalidMessageError("It is not your turn!");
  };
};

InfoChess.prototype.validateIWAttackOptions = function(options) {
  var type = options.type;
  if (!type || (type !== 'psyop' && type !== 'ew')) {
    throw new InvalidMessageError("Invalid IW attack type '"+type+"'. Must be one of 'psyop' or 'ew'");
  }
  var strength = options.strength;
  if (!strength || (strength !== 'normal' && strength !== 'reinforced' && strength !== 'feint')) {
    throw new InvalidMessageError("Invalid IW attack strength '"+strength+"'. Must be one of 'normal', 'reinforced' or 'feint'");
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
  this.addHistory(this.HISTORY_TYPES.END_TURN, role + " ended their turn.");
  this.currentTurn.iw_attack.type = null;
  this.nextPhase();
};

InfoChess.prototype.getIWCost = function(options, ewFunc, psyFunc) {
  var me = this;
  var type = options.type;
  if (type === 'ew') {
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
    if (options.strength === 'feint') {
      return 1;
    } else {
      return me.board.getCurrentEWAttackCost() + (options.strength === 'reinforced' ? 1 : 0);
    }
  }, function() {
    if (options.strength === 'feint') {
      return 1;
    } else {
      return me.board.getCurrentPsyOpAttackCost() + (options.strength === 'reinforced' ? 1 : 0);
    }
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
  this.addHistory(this.HISTORY_TYPES.PAWN_UPGRADE, role + " upgraded their pawn to " + new_type+".");
  this.currentTurn.move.upgraded_type = new_type;

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

  var cost = this.getIWAttackCost(options);

  if (this.getIWAttackCost({type: options.type, strength: 'normal'}) === 1 && options.strength === 'feint') {
    throw new InvalidMessageError("Feints can only be done when the attack cost is 2. It is currently 1.");
  }

  var type = options.type;

  // check if enough IW points are available
  if (this.board.getRemainingIW(role)[type] < cost) {
    throw new InvalidMessageError("You do not have enough remaining IW points to perform that attack.");
  }

  // record that this player is doing a psyop attack
  this.current_iw_attack = options;
  this.current_iw_attack.attacker = role;
  this.currentTurn.iw_attack = {
    attacker: this.current_iw_attack.attacker,
    type: this.current_iw_attack.type
  }

  var attack_cost = this.getIWAttackCost(this.current_iw_attack);
  this.board.remainingIW[this.current_iw_attack.attacker][type] -= attack_cost;

  if (type === 'psyop') {
    this.addHistory(this.HISTORY_TYPES.PSYOP_ATTACK, {
      game: role + " issued a " + options.strength + " psyop attack!",
      actor: "You issued a " + options.strength + " psyop attack!",
      opponent: role + " issued a psyop attack!"
    }, role);
  } else {
    this.addHistory(this.HISTORY_TYPES.PSYOP_ATTACK, {
      game: role + " issued a " + options.strength + " electronic warfare attack!",
      actor: "You issued a " + options.strength + " electronic warfare attack!",
      opponent: role + " issued an electronic warfare attack!"
    }, role);
  }

  this.nextPhase();
  var result = {
    defense_cost: this.getIWDefendCost(options)
  };
  return result;
};

InfoChess.prototype.psyop_attack_targets = function() {
  if (this.current_iw_attack) {
    return this.board.psyop_attack_targets(this.current_iw_attack);
  }
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

  var defense_cost = 0;

  var type = this.current_iw_attack.type;
  var result = {
    msg: "DEFENSE_RESULT",
    type: this.current_iw_attack.type,
    attacker: this.current_iw_attack.attacker,
    defender: role
  }
  if (options.defend === true) {
    defense_cost = this.getIWDefendCost(this.current_iw_attack);
    console.log(role + " has chosen to defend. Defense cost: " + defense_cost);
    console.log(role + " has " + this.board.remainingIW[role] + " IW points left before defending");
    // check if this player has enough IW left to defend
    if (this.board.getRemainingIW(role)[type] < defense_cost) {
      throw new InvalidMessageError("You do not have enough remaining IW points to defend against this attack!");
    }

    this.board.remainingIW[role][type] -= defense_cost;
    console.log(role + " has " + this.board.remainingIW[role] + " IW points left after defending");

    if (this.current_iw_attack.strength !== 'reinforced') {
      // defense successful
      if (this.current_iw_attack.type === 'psyop') {
        this.board.cyclePsyopCosts();
      } else if (this.current_iw_attack.type === 'ew') {
        this.board.cycleEWCosts();
      } else {
        throw new InvalidMessageError("Unknown IW attack type: " + this.current_iw_attack.type);
      }
      this.addHistory(this.HISTORY_TYPES.IW_DEFEND, role + " successfully defended the attack!");
      if (this.current_iw_attack.strength === 'feint') {
        this.currentTurn.iw_attack.success = true;
      } else {
        this.currentTurn.iw_attack.success = false;
      }
      this.current_iw_attack = null;
      this.nextPhase();
      result.result = "defended";
      return result;
    }
  }
  if (this.current_iw_attack.type === 'psyop') {
    var targets = this.board.psyop_attack_targets(this.current_iw_attack);
    if (targets.length > 1 && !options.chosen_position) {
      result.msg = "PSYOP_CHOOSE_VICTIM";
      delete result.strength;
      result.targets = targets;
      return result;
    }
    var attack = this.board.psyop_attack(this.current_iw_attack, options.chosen_position);
    result.captured_piece = attack.captured_piece;
    result.captured_position = attack.captured_position;
    result.type = 'psyop';
    result.msg = "DEFENSE_RESULT";
    this.board.cyclePsyopCosts();
    if (this.current_iw_attack.strength !== 'feint') {
      this.currentTurn.iw_attack.success = true;
      this.currentTurn.iw_attack.outcome = {
        type: result.captured_piece.type,
        location: result.captured_position.humanise()
      };
      this.addHistory(this.HISTORY_TYPES.IW_DEFEND, role + " failed to defend and lost a " + result.captured_piece.type + " at " + result.captured_position.humanise()+"!");
    } else {
      this.currentTurn.iw_attack.success = false;
      this.addHistory(this.HISTORY_TYPES.IW_DEFEND, role + " failed to defend.");
    }
  } else {
    this.board.cycleEWCosts();
    if (this.current_iw_attack.strength !== 'feint') {
      this.currentTurn.iw_attack.success = true;
      this.addHistory(this.HISTORY_TYPES.IW_DEFEND, role + " failed to defend and lost their next move.");
    } else {
      this.currentTurn.iw_attack.success = false;
      this.addHistory(this.HISTORY_TYPES.IW_DEFEND, role + " failed to defend.");
    }
  }
  result.result = "success";
  this.nextPhase();
  this.current_iw_attack = null;
  return result;
};

InfoChess.prototype.move = function(role, src, dest) {
  if (this.currentPhase !== this.PHASES.PAWNCAPTURE && this.currentPhase !== this.PHASES.MOVE) {
    throw new InvalidMessageError("Invalid message. Moves can only be issued during pawn-capture and move phases.");
  }

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

  var default_opponent_msg = role + " made a move.";
  this.currentTurn.move.moving_piece = result.moving_piece.type;
  this.currentTurn.move.src = src.humanise();
  this.currentTurn.move.dest = dest.humanise();
  if (result.type === 'pawnbump') {
    // Don't add history here, as it will show to the opponent as someone moving twice.
  } else if (result.type === 'castling') {
    this.currentTurn.move.castling = true;
    this.addHistory(this.HISTORY_TYPES.MOVE, {
      game: role + " castled its king from " + src.humanise() + " to the rook at " + dest.humanise() + ".",
      actor: "You castled your king from " + src.humanise() + " to the rook at " + dest.humanise() + ".",
      opponent: default_opponent_msg
    }, role);
  } else if (result.type === 'capture') {
    this.currentTurn.move.captured_piece = result.captured_piece.type;
    this.addHistory(this.HISTORY_TYPES.MOVE, role+"'s "+result.moving_piece.type+" moved from "+src.humanise()+ " to "+dest.humanise()+", capturing a "+result.captured_piece.type + "!");
  } else { // Move
    if (result.moving_piece.invisible) {
      this.currentTurn.move.invisible = true;
      this.addHistory(this.HISTORY_TYPES.MOVE, {
        game: role + " moved from " + src.humanise() + " to " + dest.humanise() + ".",
        actor: "You moved from " + src.humanise() + " to " + dest.humanise() + ".",
        opponent: default_opponent_msg
      }, role);
    } else {
      this.addHistory(this.HISTORY_TYPES.MOVE, role + " moved from " + src.humanise() + " to " + dest.humanise() + ".");
    }
  }

  if (result.pawn_upgrade) {
    this.currentPhase = this.PHASES.PAWNUPGRADE;
  } else {
    // Check that the source piece moving actually moved. It may not move when
    // a pawn bumps into a piece but does not move. They should not lose
    // their movement turn.
    if (!this.board.pieces[src_pos.asKey()]) {
      this.nextPhase();
    }
  }

  return result;
};

InfoChess.prototype.getHistory = function(role) {
  this.validateRole(role);
  if (this.isGameOver()) {
    // Game over, send full history
    return this.history.game;
  }
  return this.history[role];
};

/*
 * Accepts either a string or an object. If it's a string, it adds the same
 * message to all histories. If it's an object, it adds different messages to
 * different histories. It must be structured like this:
 * {
 *   game: "Omniscient message here",
 *   actor: "Outcome that is only shown to the actor",
 *   opponent: "Outcome that is only shown to the actor's opponent"
 * }
 */
InfoChess.prototype.addHistory = function(type, messageOrObj, actor_role) {
  var me = this;

  function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  var handleString = function(type, message) {
    message = capitaliseFirstLetter(message);
    me.history.game.push({type: type, text: message});
    _.each(me.ROLES, function(role) {
      me.history[role].push({type: type, text: message});
    });
  }

  var handleObject = function(type, actor_role, options) {
    var opponent_role = actor_role === 'white' ? 'black' : 'white';
    me.history.game.push({type: type, text: capitaliseFirstLetter(options.game)});
    _.each(me.ROLES, function(role) {
      var msg = role === actor_role ? capitaliseFirstLetter(options.actor) : capitaliseFirstLetter(options.opponent)
      me.history[role].push({type: type, text: msg});
    });
  }

  if (typeof messageOrObj == 'string') {
    handleString(type, messageOrObj);
  } else if (typeof messageOrObj == 'object') {
    handleObject(type, actor_role, messageOrObj);
  } else {
    throw "Invalid history message! Must be a string or object.";
  }
};

InfoChess.prototype.HISTORY_TYPES = {
  GAME_STARTED: 'GAME_STARTED',
  FORFEIT: 'FORFEIT',
  DRAW: 'DRAW',
  GAMEOVER: 'GAMEOVER',
  MOVE: 'MOVE',
  PSYOP_ATTACK: 'PSYOP_ATTACK',
  EW_ATTACK: 'EW_ATTACK',
  IW_DEFEND: 'IW_DEFEND',
  IW_IGNORE: 'IW_IGNORE',
  PAWN_UPGRADE: 'PAWN_UPGRADE',
  END_TURN: 'END_TURN'
};

return {
  InfoChess: InfoChess,
  metadata: metadata,
  create: create
};

});

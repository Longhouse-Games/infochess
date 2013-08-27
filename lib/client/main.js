/**
 * Protect window.console method calls, e.g. console is not defined on IE
 * unless dev tools are open, and IE doesn't define console.debug
 * http://stackoverflow.com/a/13817235/21593
 */
(function() {
  if (!window.console) {
    window.console = {};
  }
  // union of Chrome, FF, IE, and Safari console methods
  var m = [
    "log", "info", "warn", "error", "debug", "trace", "dir", "group",
    "groupCollapsed", "groupEnd", "time", "timeEnd", "profile", "profileEnd",
    "dirxml", "assert", "count", "markTimeline", "timeStamp", "clear"
  ];
  // define undefined methods as noops to prevent errors
  for (var i = 0; i < m.length; i++) {
    if (!window.console[m[i]]) {
      window.console[m[i]] = function() {};
    }
  }
})();

requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib',
    underscore: "../js/underscore/underscore"
  },
  shim: {
    underscore: {
      exports: '_'
    }
  }
});

require([
    "underscore",
    "../js/allong.es",
    "../js/ICanHaz.min",
    "lib/helper",
    "lib/infochess",
    "lib/building_board"],
    function(_,
      allong,
      ICanHaz,
      HelperModule,
      InfoChess,
      BuildingBoardModule) {

  var allonges = allong.es;

  function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  if (Array.prototype.forEach === undefined) {
    Array.prototype.forEach = function(callback) {
      for (var idx = 0; idx < this.length; ++idx) {
        callback(this[idx]);
      }
    };
  }

  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(searchElement /*, fromIndex */) {

      "use strict";

      if (this === void 0 || this === null)
        throw new TypeError();

      var t = Object(this);
      var len = t.length >>> 0;
      if (len === 0)
        return -1;

      var n = 0;
      if (arguments.length > 0)
      {
        n = Number(arguments[1]);
        if (n !== n)
          n = 0;
        else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0))
          n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }

      if (n >= len)
        return -1;

      var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);

      for (; k < len; k++) {
        if (k in t && t[k] === searchElement)
          return k;
      }
      return -1;
    };
  }

  var BuildingBoard = BuildingBoardModule.BuildingBoard;
  var Piece = HelperModule.Piece;
  var Position = HelperModule.Position;
  var keyToPosition = HelperModule.keyToPosition;

  var TYPES = [
    'king',
    'queen',
    'rook',
    'knight',
    'bishop',
    'pawn'
  ];

  var metadata = InfoChess.metadata;
  var prefix = /\/(.+\/)play/.exec(window.location.pathname)[1];
  var socket = io.connect(null, {
    'remember transport': false,
    'resource': prefix + 'socket.io'
  });

  var g_ready = false;
  var g_role = 'spectator';
  var g_gameState = null;
  var g_building_board = null;
  var g_last_phase = null;
  var g_selectedType; // Selected piece type when building army
  var g_playSounds = true;
  var g_soundsLoaded = false;
  var g_actions_enabled = {
    pawn_capture: false,
    psyop_normal: false,
    psyop_reinforced: false,
    psyop_feint: false,
    ew_normal: false,
    ew_reinforced: false,
    ew_feint: false,
    end_turn: false
  };

  var ui_pieces = {}; // "x,y" -> div

  function isBlackPlayer() {
    return g_role === metadata.roles[1].slug;
  }

  function isWhitePlayer() {
    return g_role === metadata.roles[0].slug;
  }

  function isSpectator() {
    return g_role === SPECTATOR_ROLE;
  }

  function getPlayerColour() {
    return g_role;
  }

  function isMyTurn() {
    return (g_gameState && g_gameState.getCurrentRole() === g_role);
  }


  var SPECTATOR_ROLE = 'spectator';
  var WHITE_ROLE = 'white';
  var BLACK_ROLE = 'black';
  var SQUARE_SIZE = 74;
  var PIECE_MARGIN = 16;

  function getBuildingBoard() {
    if (!g_building_board) {
      g_building_board = new BuildingBoard();
    }
    return g_building_board;
  }

  function recalculateArmy() {
    // TODO if game has started, die/throw/or something
    var building_board = getBuildingBoard();
    var points = building_board.points();

    TYPES.forEach(function(type) {
      $("#" + type + " .count").text(building_board.count(type));
    });
    renderPointsRemaining($("#army_selector #points_indicator"), building_board.max_points - points);
  }

  function addPiece(container, position, className, margin) {
    var newPieceOnBoard = document.createElement("div");
    var x = position.x;
    var y = position.y;
    if (g_role === 'black') {
      //Our orientation is flipped
      x = 7-x;
      y = 7-y;
    }
    newPieceOnBoard.className += " " + className;
    newPieceOnBoard.style.left = margin + (x * SQUARE_SIZE) + 'px';
    newPieceOnBoard.style.bottom = margin + (y * SQUARE_SIZE) + 'px';
    container.appendChild(newPieceOnBoard);
    return newPieceOnBoard;
  }

  function addNormalPiece(piece, position) {
    var container = document.getElementById('pieces');
    var cssclass = cssClassForPiece(piece) + " normal_piece";
    if (piece.invisible === true) {
      cssclass = cssclass + " invisible";
    }
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);

    if (getPlayerColour() === piece.colour) {
      newPieceOnBoard.onclick = function() {
        if (g_gameState.getCurrentRole() === g_role && g_gameState.getCurrentPhase() === g_gameState.PHASES.MOVE) {
          hideNotification();
          clearSelection();
          this.className += " selected";
          displayPossibleMoves(getPlayerColour(), piece, position);
        }
      };
    }

    return newPieceOnBoard;
  }

  function removeTempPieces() {
    $(".temp_piece").remove();
    _.each(getBuildingBoard().pieces, function(piece, pos_key) {
      getBuildingBoard().removePiece(keyToPosition(pos_key));
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
      recalculateArmy();
    });
  }

  function addPsyopCaptureMarker(position) {
    var container = document.getElementById('pieces');
    var cssclass = "psyop_capture";
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);
    $(newPieceOnBoard).css('background-image', '');
    $(newPieceOnBoard).css('background-image', "url('images/psyop_capture.gif')");
    return newPieceOnBoard;
  }

  function addInvisiblePiece(position) {
    var container = document.getElementById('pieces');
    var cssclass = "invisible_piece";
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);
    $(newPieceOnBoard).css('background-image', '');
    $(newPieceOnBoard).css('background-image', "url('images/invisible_piece.gif')");
    return newPieceOnBoard;
  }

  function addTempPiece(piece, position) {
    var container = document.getElementById('pieces');
    var cssclass = cssClassForPiece(piece) + " temp_piece";
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);

    //Add removal marker
    var removalMarker = document.createElement("div");
    removalMarker.className = "removal_marker";
    removalMarker.onclick = function() {
      container.removeChild(newPieceOnBoard);
      getBuildingBoard().removePiece(position);
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
      recalculateArmy();
    };
    newPieceOnBoard.appendChild(removalMarker);

    return newPieceOnBoard;
  }

  function clearSelection() {
    $("#board .selected").removeClass("selected");
    $("#board .castling_shadow_piece").remove();
  }

  function displayPossibleMoves(role, piece, position) {
    var $pieces = $("#pieces");
    // Clear all shadow pieces
    $("#pieces .shadow_piece").remove();

    var pos_keys = g_gameState.getPossibleMoves(piece, position);

    pos_keys.forEach(function(pos_key) {

      var handler = function(piece, src, dest) {
        return function() {
          clearSelection();
          var move = {
            src: src,
            dest: dest
          };
          socket.emit('move', move);
        };
      }(piece, position, keyToPosition(pos_key));

      createMove($pieces, piece, keyToPosition(pos_key), handler);
    });

    var castling = g_gameState.getCastlingMoves(piece);

    console.log("Castling results");
    console.log(castling);
    // Dirty hack to compensate for weird architecture
    if (piece.type === 'rook') {
      if (castling.kingside && position.asKey() !== new Position(7, piece.starting_row).asKey()) {
        //User has selected the queenside rook
        delete castling.kingside;
      } else if (castling.queenside && position.asKey() !== new Position(0, piece.starting_row).asKey()) {
        //User has selected the kingside rook
        delete castling.queenside;
      }
    }
    createCastlingMoves($pieces, piece, position, castling);
  }

  function createCastlingMoves(container, piece, position, castling) {
    var castlingHandler = function(side, piece) {
      return function() {
        if (side !== 'queenside' && side !== 'kingside') {
          throw "Invalid side for castling: " + side;
        }
        clearSelection();
        var rook_x = side === 'queenside' ? 0 : 7;
        var move = {
          src: new Position(4, piece.starting_row),
          dest: new Position(rook_x, piece.starting_row)
        }
        socket.emit('move', move);
      };
    };
    var queensideHandler = castlingHandler('queenside', piece);
    var kingsideHandler = castlingHandler('kingside', piece);

    if ((castling.queenside || castling.kingside) && piece.type !== "king") {
      //highlight the king
      var king_pos = castling.queenside ? castling.queenside.king : castling.kingside.king;
      var king = new Piece('king', getPlayerColour());
      var handler = null;
      if (position.x === 0) {
        handler = queensideHandler;
      } else if (position.x === 7) {
        handler = kingsideHandler;
      } else {
        throw "Invalid position for castling: " + position.asKey();
      }
      createCastlingMove(container, king, new Position(4, king.starting_row), handler);
    }
    if (castling.queenside && piece.type !== "rook") {
      //highlight queenside rook
      var rook_pos = castling.queenside.rook;
      var rook = new Piece('rook', getPlayerColour());
      createCastlingMove(container, rook, new Position(0, rook.starting_row), queensideHandler);
    }
    if (castling.kingside && piece.type !== "rook") {
      //highlight kingside rook
      var rook_pos = castling.kingside.rook;
      var rook = new Piece('rook', getPlayerColour());
      createCastlingMove(container, rook, new Position(7, rook.starting_row), kingsideHandler);
    }
  }

  function displayValidStartingPositions(side, piece_type) {
    var $pieces = $("#pieces").first();

    // Clear all shadow pieces
    $("#pieces .shadow_piece").remove();

    // Determine if placement of this piece would go over the army limit
    var building_board = getBuildingBoard();
    var piece = new Piece(piece_type, getPlayerColour());
    var positions = building_board.getPossiblePlacements(piece);
    if (positions.length === 0) {
      return;
    }

    for (i = 0; i < positions.length; i++) {
      var position = positions[i];

      var handler = function(position) {
        return function() {
          addTempPiece(piece, position);
          getBuildingBoard().addPiece(piece, position);
          recalculateArmy();
          displayValidStartingPositions(getPlayerColour(), g_selectedType);
        };
      }(position);

      createMove($pieces, piece, position, handler);
    }
  }

  function cssClassForPiece(piece) {
    return piece.type + '_' + piece.colour;
  }

  function createMove($moves, piece, position, clickHandler) {
    var container = $moves.get(0);
    var cssclass = "shadow_piece " + cssClassForPiece(piece);
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);
    newPieceOnBoard.onclick = clickHandler;
  }

  // Add a div to the board at position with the given class. Also attach click handler
  function addToBoard(cssclass, position, clickHandler) {
    var container = $("#pieces").get(0);
    var square = addPiece(container, position, cssclass, PIECE_MARGIN);
    square.onclick = clickHandler;
  }

  function createCastlingMove($moves, piece, position, clickHandler) {
    var container = $moves.get(0);
    var cssclass = "castling_shadow_piece";
    var newPieceOnBoard = addPiece(container, position, cssclass, PIECE_MARGIN);
    newPieceOnBoard.onclick = clickHandler;
  }

  function addPawnCaptureSource(position, clickHandler) {
    console.log("Adding pawn_capture_source for position" + position);
    addToBoard("pawn_capture_source", position, clickHandler);
  }

  function addPawnCaptureTarget(position, clickHandler) {
    console.log("Adding pawn_capture_target for position" + position);
    addToBoard("pawn_capture_target", position, clickHandler);
  }

  function setTransitionProperty($element, value) {
    $element.css('transition', value);
    $element.css('webkitTransition', value);
    $element.css('mozTransition', value);
    $element.css('oTransition', value);
  }

  function clearTransitionProperty($element) {
    $element.css('transition', '');
    $element.css('webkitTransition', '');
    $element.css('mozTransition', '');
    $element.css('oTransition', '');
  }

  function setOverlayText($overlay, $flash, text) {
    text = text || "";
    if ($overlay.text() == text) {
      return;
    }
    var oldBackground = $overlay[0].style.background;
    var timeout = 450;
    $overlay.text(text);
    setTransitionProperty($flash, 'background ' + timeout + 'ms');
    $flash.css('background', '#AA3377');
    setTimeout(function() {
      $flash.css('background', oldBackground);
      setTimeout(function() {
        clearTransitionProperty;
      }, timeout);
    }, timeout);
  }

  function hideArmySelector() {
    $('#army_selector').first().css('display', 'none');
    $('#action_selector').first().css('display', 'block');
    $("#pawn_capture").css('display', 'block');
  }

  function showPawnUpgradeDialog() {
    console.log("Showing pawn upgrade");
    var $dialog = $('#pawn_upgrade_dialog').first();
    $dialog.css('visibility', 'visible');
  }

  function updateArmySelector() {
    var $builder = $('#army_selector').first();
    if (g_gameState.getCurrentPhase() === g_gameState.PHASES.SETUP) {
      $builder.css('display', 'block');
      recalculateArmy();
    } else {
      $(".temp_piece").remove();
      $(".shadow_piece").remove();
      $("#opponent_status").remove();
      hideArmySelector();
    }
  }

  function serializeArmy() {
    return getBuildingBoard().serialize();
  }

  var CHOOSING = "choosing";
  var READY = "ready";
  function update_opponent_status(new_status) {
    console.log("UPDATING STATUS: " + new_status);
    var $status = $('#opponent_status').first();
    if (new_status == CHOOSING) {
      $status.text('Opponent is choosing their army.');
    } else if (new_status == READY) {
      $status.text('Opponent is ready.');
    } else {
      console.log("Invalid status: " + new_status);
    }
  }

  function updateBoard() {
    if (g_gameState.getCurrentPhase() === g_gameState.PHASES.SETUP) {
      // TODO refresh the placed pieces properly once building boards are persisted
      return;
    }
    var pieces = g_gameState.board.getPieces();
    var piecesOnBoard = ui_pieces || {};
    $("#pieces").text("");

    for (var pos_key in pieces) {
      if (pieces.hasOwnProperty(pos_key)) {
        var piece = pieces[pos_key];
        addNormalPiece(piece, keyToPosition(pos_key));
      }
    }
  }

  function updateActions() {
    var phase = g_gameState.getCurrentPhase();
    var phases = g_gameState.PHASES;
    var remainingIW = g_gameState.board.remainingIW;

    g_actions_enabled.pawn_capture = false;
    g_actions_enabled.psyop_main = false;
    g_actions_enabled.psyop_normal = false;
    g_actions_enabled.psyop_reinforced = false;
    g_actions_enabled.psyop_feint = false;
    g_actions_enabled.ew_main = false;
    g_actions_enabled.ew_normal = false;
    g_actions_enabled.ew_reinforced = false;
    g_actions_enabled.ew_feint = false;
    g_actions_enabled.end_turn = false;

    if (g_gameState.getCurrentRole() !== g_role ||
        phase === phases.SETUP ||
        phase === phases.PAWNUPGRADE ||
        phase === phases.DEFENSE ||
        phase === phases.GAMEOVER ||
        phase === phases.PAWNCAPTURE) {
      //disable all
    } else if (phase === phases.MOVE) {
      //enable only pawn capture
      g_actions_enabled.pawn_capture = true;
    } else if (phase === phases.IW) {
      //enable psyop, ew, end_turn, feint
      if (g_gameState.currentPsyOpAttackCost <= remainingIW['psyop']) {
        g_actions_enabled.psyop_normal = true;
      }
      if (g_gameState.currentPsyOpAttackCost+1 <= remainingIW['psyop']) {
        g_actions_enabled.psyop_reinforced = true;
      }
      if (g_gameState.currentEWAttackCost <= remainingIW['ew']) {
        g_actions_enabled.ew_normal = true;
      }
      if (g_gameState.currentEWAttackCost+1 <= remainingIW['ew']) {
        g_actions_enabled.ew_reinforced = true;
      }
      if (g_gameState.currentEWAttackCost != 1 && remainingIW['ew'] >= g_gameState.feintCost) {
        g_actions_enabled.ew_feint = true;
      }
      if (g_gameState.currentPsyOpAttackCost != 1 && remainingIW['psyop'] >= g_gameState.feintCost) {
        g_actions_enabled.psyop_feint = true;
      }
      if (g_actions_enabled.psyop_normal || g_actions_enabled.psyop_reinforced || g_actions_enabled.psyop_feint) {
        g_actions_enabled.psyop_main = true;
      }
      if (g_actions_enabled.ew_normal || g_actions_enabled.ew_reinforced || g_actions_enabled.ew_feint) {
        g_actions_enabled.ew_main = true;
      }
      g_actions_enabled.end_turn = true;
    }

    for (var action in g_actions_enabled) {
      if (g_actions_enabled.hasOwnProperty(action)) {
        var enabled = g_actions_enabled[action];
      }
      var $button = $("#"+action);
      $button.toggleClass("disabled", enabled === false);
      $button.toggleClass("selectable", (enabled !== false && action !== "ew_main" && action !== "psyop_main"));
    }
  }

  function renderPointsRemaining($container, points, title) {
    title = title || "POINTS";
    $container.text('');
    $container.append($("<span class='title'>"+title+"</span>"));
    for (var i = 0; i < points; i++) {
      var $block = $("<div class='point_block full'></div>");
      $container.append($block);
    }
    for (i = points; i < 10; i++) {
      var $block = $("<div class='point_block empty'></div>");
      $container.append($block);
    }
    $container.append($("<span class='points'>"+points+"</span>"));
  }

  function updateIW() {
    points = allonges.callRight(pluralize, "point");
    $("#psyop_normal #value").text(points(g_gameState.currentPsyOpAttackCost));
    $("#psyop_reinforced #value").text(points(g_gameState.currentPsyOpAttackCost + 1));
    $("#psyop_feint #value").text(points(g_gameState.feintCost));
    $("#ew_normal #value").text(points(g_gameState.currentEWAttackCost));
    $("#ew_reinforced #value").text(points(g_gameState.currentEWAttackCost + 1));
    $("#ew_feint #value").text(points(g_gameState.feintCost));

    renderPointsRemaining($("#action_selector #psyop_points_indicator"), g_gameState.board.remainingIW.psyop, "PSYOP");
    renderPointsRemaining($("#action_selector #ew_points_indicator"), g_gameState.board.remainingIW.ew, "E-WARFARE");
  }

  function showNotification(message, timeout) {
    var $container = $("#table_area");
    $("#notification").remove();
    var $notification = $(document.createElement('div')).attr('id', 'notification');
    $notification.text(message);
    $container.append($notification);

    if (timeout) {
      var delayMS = 2000;
      setTimeout(function() {
        hideNotification();
      }, delayMS);
    }
  }

  function hideNotification() {
    $("#notification").remove();
  }

  function enablePsyopVictims(targets) {
    hideIWDefenseDialog();
    showNotification("Choose piece to be captured");
    _.each(targets, function(position) {
      var clickHandler = function() {
        hideNotification();
        socket.emit('iw_defense', { defend: false, chosen_position: position });
        $(".psyop_target").remove();
      };
      addToBoard("psyop_target", new Position(position.x, position.y), clickHandler);
    });
  }

  function showPsyopTargets(targets) {
    showNotification("If you fail to defend, you will lose a highlighed piece.");
    _.each(targets, function(position) {
      var handler = function() {
        hideNotification();
      };
      addToBoard("psyop_target", new Position(position.x, position.y), handler);
    });
  }

  function clearPawnCaptureTargets() {
    $(".pawn_capture_target").remove();
  }

  function updatePawnCaptures(captures) {
    var me = this;
    console.log("Got captures!");
    console.log(captures);
    var sources = [];
    var targets = {};
    var i;
    for (i = 0; i < captures.length; i++) {
      var capture = captures[i];
      if (sources.indexOf(capture.src) === -1) {
        sources.push(capture.src);
      }
      targets[new Position(capture.dest.x, capture.dest.y).asKey()] = capture.dest;
    }

    console.log("SOURCES AND TARGETS");
    console.log(sources);
    console.log(targets);
    showNotification("These pawns can capture. Choose one.");

    for (i = 0; i < sources.length; i++) {
      var sourceHandler = function(src) {
        return function() {
          console.log("Source pawn "+src.x+","+src.y+" clicked");
          var dir_mod = getPlayerColour() === "white" ? 1 : -1;
          var left  = new Position(src.x - 1, src.y + (1*dir_mod));
          var right = new Position(src.x + 1, src.y + (1*dir_mod));
          clearPawnCaptureTargets();
          showNotification("Choose target to capture.");

          var addTarget = function(position) {
            if (targets[position.asKey()]) {
              var handler = function() {
                console.log("Target pawn "+position.x+","+position.y+" clicked. Using src "+src.x+","+src.y);
                var move = {
                  src: src,
                  dest: position
                };
                socket.emit('move', move);
              };
              addPawnCaptureTarget(position, handler);
            }
          };

          addTarget(left);
          addTarget(right);
        };
      }(sources[i]);
      addPawnCaptureSource(new Position(sources[i].x, sources[i].y), sourceHandler);
    }
     // for (i = 0; i < targets.length; i++) {
     //   var destHandler = function() {
     //     console.log("target square clicked");
     //   };
     //   addPawnCaptureTarget(new Position(targets[i].x, targets[i].y), destHandler);
     // }
  }

  function updateLastTurnReport(last_turn_report) {
    if (!last_turn_report) {
      return;
    }

    var report = "";
    var iw_report = "";
    var options = {
      role: last_turn_report.role,
      src: last_turn_report.move.src,
      dest: last_turn_report.move.dest,
      captured_piece: last_turn_report.move.captured_piece,
      moving_piece: last_turn_report.move.moving_piece,
      strength: last_turn_report.iw_attack.strength,
    };
    if (last_turn_report.move) {
      if (last_turn_report.move.invisible) {
        report += Mustache.render("{{role}} made a move.", options);
      } else if (last_turn_report.move.captured_piece) {
        report += Mustache.render("{{role}} moved a {{moving_piece}} from {{src}} to {{dest}}, capturing a {{captured_piece}}.", options);
      } else if (last_turn_report.move.src && last_turn_report.move.dest) {
        report += Mustache.render("{{role}} moved a {{moving_piece}} from {{src}} to {{dest}}.", options);
      } else {
        report += Mustache.render("{{role}} couldn't move.", options);
      }
    }

    if (last_turn_report.iw_attack.type === 'psyop') {
      if (last_turn_report.iw_attack.success) {
        if (last_turn_report.iw_attack.strength === 'feint') {
          iw_report += Mustache.render("{{strength}} psyop attack was successful.", options);
        } else {
          options.position = last_turn_report.iw_attack.outcome.location;
          options.captured_piece = last_turn_report.iw_attack.outcome.type;
          iw_report += Mustache.render("{{strength}} psyop attack was successful, capturing a {{captured_piece}} at {{position}}.", options);
        }
      } else if (last_turn_report.iw_attack.success === false) { // Could be undefined if attack type was null
        iw_report += Mustache.render("{{strength}} psyop attack was unsuccessful.", options);
      }
    } else if (last_turn_report.iw_attack.type === 'ew') {
      if (last_turn_report.iw_attack.success) {
        iw_report += Mustache.render("{{strength}} e-warfare attack was successful.", options);
      } else if (last_turn_report.iw_attack.success === false) { // Could be undefined if attack type was null
        iw_report += Mustache.render("{{strength}} e-warfare attack was unsuccessful.", options);
      }
    }
    iw_report = capitaliseFirstLetter(iw_report);
    report += " " + iw_report;

    $("#last_turn_report #content").text(capitaliseFirstLetter(report));
  }

  function playSound(id) {
    if (g_playSounds) {
      var sound = document.getElementById(id);
      if (sound.readyState === 4 || sound.readyState === 2) { // HAVE_ENOUGH_DATA && HAVE_CURRENT_DATA - aka it's loaded
        sound.play();
      }
    }
  }

  function notifyPlayer() {
    if ((isWhitePlayer() && g_gameState.isWhiteTurn()) ||
        (isBlackPlayer() && g_gameState.isBlackTurn())) {
      playSound('your_turn');
    }
  }

  function phaseHasChanged(old_phase, new_phase) {
    var $overlay = $('#dashboard #status').first();
    var $flash = $('.overlay_flash');
    hideNotification();

    var phases = g_gameState.PHASES;
    if (old_phase === phases.IW || old_phase === phases.DEFENSE) {
      // it's now their turn
      notifyPlayer();
    }

    var msg = "";

    if (new_phase === phases.SETUP) {
      // if army is done
      // msg = "WAITING FOR OPPONENT";
      // else
      msg = "BUILD YOUR ARMY";
    } else if (new_phase === phases.PAWNCAPTURE) {
      if (isMyTurn()) {
        msg = "CAPTURE WITH PAWN";
      } else {
        msg = "OPPONENT'S MOVE";
      }
    } else if (new_phase === phases.MOVE) {
      msg = (isMyTurn() ? "YOUR" : "OPPONENT'S") + " MOVE";
    } else if (new_phase === phases.IW) {
      msg = (isMyTurn() ? "YOUR" : "OPPONENT'S") + " ACTION";
    } else if (new_phase === phases.DEFENSE) {
      if (isMyTurn()) {
        msg = "DEFEND";
      } else {
        msg = "OPPONENT DEFENDING";
      }
    } else if (new_phase === phases.PAWNUPGRADE) {
      if (isMyTurn()) {
        msg = "UPGRADE YOUR PAWN";
      } else {
        msg = "OPPONENT IS UPGRADING";
      }
    } else if (new_phase === phases.GAMEOVER) {
      if (g_gameState.getWinner()) {
        var winner = _.find(metadata.roles, function(role){ return role.slug === g_gameState.getWinner();});
        msg = winner.name.toUpperCase() + " WINS";
      }
    }

    setOverlayText($overlay, $flash, msg);
  }

  function printMessage(user, message, role) {
    var $messages = $("#chat_messages");
    $chat = ich.chat_message({user: user, message: message, role: role});
    $messages.append($chat);
    $messages.scrollTop($messages.prop('scrollHeight'));

    if ($chat.css('display') === 'none') {
      $chat_message_indicator.show();
    }
  }

  function createArmySelector() {
    /*
          <li id="king"><img class="piece" src="images/king_white.100x100.png">King</li>
          <li id="queen"><img class="piece" src="images/queen_white.100x100.png">Queens: <span class="count">0</span> (cost: 3 points)</li>
          <li id="knight"><img class="piece" src="images/knight_white.100x100.png">Knights: <span class="count">0</span> (cost: 2 points)</li>
          <li id="rook"><img class="piece" src="images/rook_white.100x100.png">Rooks: <span class="count">0</span> (cost: 2 points)</li>
          <li id="bishop"><img class="piece" src="images/bishop_white.100x100.png">Bishops: <span class="count">0</span> (cost: 1 point)</li>
          <li id="pawn"><img class="piece" src="images/pawn_white.100x100.png">Pawns: <span class="count">0</span> (cost: 1 point)</li>
    */

    // TODO this data should read from the InfoChess/BuildingBoard class
    var pieces = ["king", "queen", "knight", "rook", "bishop", "pawn"];
    var costs  = [     0,       3,        2,      2,        1,      1];
    var invis  = [  true,   false,     true,  false,    false,   true];
    var container = document.getElementById('piece_selectors');

    // TODO hook up some templating here
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      var cost = costs[i];
      var invisible = invis[i];

      var title = piece.toUpperCase() + ": ";
      if (invisible) {
        title += "This pieces starts the game invisible. If it captures a piece, or moves into the last three rows, it will become visible. ";
      }
      if (piece === 'bishop') {
        title += "Each bishop must be placed on a differently coloured square. ";
      }

      if (piece === 'pawn') {
        title += "Max 8. ";
      } else if (piece === 'queen') {
        title += "Max 1. ";
      } else if (piece === 'king') {
        title += "Required. ";
      } else {
        title += "Max 2. ";
      }

      points = allonges.callRight(pluralize, "point");
      title += "Costs "+points(cost)+".";

      var suffix = invisible ? "-invisible" : '';
      var src = "images/"+piece+"_"+getPlayerColour()+suffix+".100x100.png";
      var div = document.createElement("div");
      div.id = piece;
      div.className = "piece_selector";
      div.title = title;
      div.innerHTML = "<div id='"+piece+"_cost' class='cost_indicator'>"+cost+"p</div><img class='piece' src='"+src+"'>";
      container.appendChild(div);
    }
    $(container).tooltip();

    $('#army_selector #ready').bind('click', function() {
      if (!g_ready) {
        socket.emit('select_army', serializeArmy());
        g_ready = true;
      } else {
        socket.emit('unready');
        g_ready = false;
      }
      $(this).toggleClass("unready");
      $(this).toggleClass("ready");
    }).addClass('selectable');
    $('#army_selector #reset').bind('click', function() {
      removeTempPieces();
    }).addClass('selectable');
    $( "#army_selector #ew_points_slider" ).slider({
      range: "max",
      min: 0,
      max: 10,
      value: 5,
      slide: function( event, ui ) {
        var psyop_points = 10-ui.value;
        var ew_points = ui.value;
        $('#army_selector #psyop #count').text(psyop_points);
        $('#army_selector #ew #count').text(ew_points);
        getBuildingBoard().setEwPoints(ew_points);
      }
    });
    $('#piece_selectors > .piece_selector').addClass('selectable');
    $('#piece_selectors > .piece_selector').bind('click', function(event) {
      var $div = $(this);
      if ($div.hasClass('chosen')) {
        $div.removeClass('chosen');
      } else {
        $('#piece_selectors > .piece_selector').removeClass('chosen');
        $div.addClass('chosen');
      }
      g_selectedType = this.id;
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
    });
  }

  function initPawnUpgradeDialog() {
    var pieces = ["queen", "knight", "rook", "bishop"];
    var container = document.getElementById('upgrade_list');

    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];

      var src = "images/"+piece+"_"+getPlayerColour()+".100x100.png";
      var div = document.createElement("div");
      div.id = piece;
      div.className = "piece_wrapper";
      div.innerHTML = "<img class='piece' src='"+src+"'><div class='piece_name'>"+piece+"</span>";
      div.onclick = function(type) {
        return function() {
          socket.emit('pawn_upgrade', type);
          $dialog = $("#pawn_upgrade_dialog").css('visibility', 'hidden');
        };
      }(piece);
      container.appendChild(div);
    }
  }

  $('#pawn_capture').bind('click', function() {
    if (g_actions_enabled.pawn_capture) {
      socket.emit('pawn_capture_query');
    }
  });
  $('#psyop_normal').bind('click', function() {
    if (g_actions_enabled.psyop_normal) {
      socket.emit('psyop', { strength: 'normal' });
    }
  });
  $('#psyop_reinforced').bind('click', function() {
    if (g_actions_enabled.psyop_reinforced) {
      socket.emit('psyop', { strength: 'reinforced' });
    }
  });
  $('#psyop_feint').bind('click', function() {
    if (g_actions_enabled.psyop_feint) {
      socket.emit('psyop', { strength: 'feint' });
    }
  });
  $('#ew_normal').bind('click', function() {
    if (g_actions_enabled.ew_normal) {
      socket.emit('ew', { strength: 'normal' });
    }
  });
  $('#ew_reinforced').bind('click', function() {
    if (g_actions_enabled.ew_reinforced) {
      socket.emit('ew', { strength: 'reinforced' });
    }
  });
  $('#ew_feint').bind('click', function() {
    if (g_actions_enabled.ew_feint) {
      socket.emit('ew', { strength: 'feint' });
    }
  });
  $('#end_turn').bind('click', function() {
    if (g_actions_enabled.end_turn) {
      socket.emit('end_turn');
    }
  });

  socket.on('connect', function() {
  });

  // receive messages
  socket.on('message', function (data) {
    printMessage(data.user, data.message, data.role);
    window.scrollTo(0, document.body.scrollHeight);
  });
  socket.on('chat_history', function(chat_messages) {
    _.each(chat_messages, function(chat_message) {
      printMessage(chat_message.user, chat_message.message, chat_message.role);
    });
  });
  socket.on('user_online', function(name) {
    printMessage('server', name + " has come online.");
  });
  socket.on('user_offline', function(name) {
    printMessage('server', name + " disconnected.");
  });
  socket.on('error', function(msg) {
    printMessage("server", "Error: " + msg + " - please file a bug report.", "server");
    console.log("Server error: " + msg);
    window.scrollTo(0, document.body.scrollHeight);
  });
  socket.on('session_error', function(data) {
    console.log("Invalid session. Reloading.");
    location.reload();
  });
  socket.on('user_disconnect', function(data) {
    var userSpan = document.getElementById(data.user);
    if (socket.id != data.user && userSpan && userSpan.parentNode) {
      userSpan.parentNode.remove(userSpan);
    }
  });

  socket.on('opponent_ready', function() {
    update_opponent_status(READY);
  });

  socket.on('opponent_choosing', function() {
    update_opponent_status(CHOOSING);
  });

  socket.on('role', function(role) {
    g_role = role;
    if (role === WHITE_ROLE) {
      printMessage("server", "You are the White player!", "server");
    } else if (role === BLACK_ROLE) {
      printMessage("server", "You are the Black player!", "server");
    } else {
      printMessage("server", "You are a spectator", "server");
    }
    $('body').addClass(role);
    createArmySelector();
    initPawnUpgradeDialog();
  });

  socket.on('num_connected_users', function(numConnectedUsers) {
    if (numConnectedUsers >= 1) {
      $('.board').first().show();
    } else {
      $('.board').first().hide();
    }
  });

  socket.on('getVote', function(vote) {
    var choice = confirm(vote.question);
    socket.emit('vote', {name: vote.name, choice: choice ? 'yes' : 'no'});
  });

  socket.on('user_info', function(userInfo) {
    $('#username').val(userInfo.name);
  });

  socket.on('defend', function(data) {
    console.log("Defending! Cost: " + data.defense_cost);
    console.log(data);

    handleDefense(data);
  });

  socket.on('update', function(updateResponse) {
    if (!updateResponse || !updateResponse.gameState) {
      return;
    }

    g_gameState = new InfoChess.InfoChess;
    g_gameState.fromDTO(updateResponse.gameState);

    console.log("REsponse:");
    console.log(updateResponse);

    if (g_last_phase !== g_gameState.getCurrentPhase()) {
      phaseHasChanged(g_last_phase, g_gameState.getCurrentPhase());
      g_last_phase = g_gameState.getCurrentPhase();
    }

    if (g_gameState.getCurrentPhase() === g_gameState.PHASES.SETUP) {
      $("#table_area").removeClass("playing_area");
      $("#table_area").addClass("building_area");
    } else {
      $("#table_area").removeClass("building_area");
      $("#table_area").addClass("playing_area");
    }
    updateArmySelector();
    updateActions();
    updateBoard();
    updateIW();
    updateLastTurnReport(updateResponse.gameState.last_turn_report);
    if (g_gameState.currentPhase === g_gameState.PHASES.PAWNUPGRADE &&
      g_gameState.currentRole == getPlayerColour()) {
      showPawnUpgradeDialog();
    } else if (g_gameState.currentPhase === g_gameState.PHASES.DEFENSE &&
      g_gameState.currentRole == getPlayerColour()) {
      var targets = updateResponse.result ? updateResponse.result.targets : null;
      handleDefense(g_gameState.current_iw_attack, targets);
    }

    if (updateResponse.result && updateResponse.result.pawn_captures) {
      if (updateResponse.result.pawn_captures.length === 0) {
        showNotification("No targets available for pawn capture.");
      } else {
        updatePawnCaptures(updateResponse.result.pawn_captures);
      }
    }

    if (updateResponse.result && updateResponse.result.msg == "PSYOP_CHOOSE_VICTIM") {
      var targets = updateResponse.result.targets;
      enablePsyopVictims(targets);
    }

    if (updateResponse.result && updateResponse.result.msg === "DEFENSE_RESULT") {
      var result = updateResponse.result;

      var flashMessage = function($flash, $msg) {

        $flash.bind('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function() {
          $flash.css("display", "none");
          $msg.css("display", "none");
          $flash.removeClass("flash-animation");
        });

        $("#flashes .message").css("display", "none"); // TODO dirty hack aghh
        $msg.css("display", "block");
        $flash.css("display", "block");
        $flash.addClass("flash-animation");
      };

      if (result.attacker === getPlayerColour()) {
        if (result.strength === 'feint') {
          if (result.result === 'success') {
            var $flash = $("#flashes #"+result.type);
            var $msg = $flash.find(".ineffective_feint .attacker");
            flashMessage($flash, $msg);
          } else if (result.result === 'defended') {
            var $flash = $("#flashes #"+result.type);
            var $msg = $flash.find(".successful_feint .attacker");
            flashMessage($flash, $msg);
          } else {
            console.log("Unknown IW defense result: " + result.result);
          }
        } else if (result.result === "success") {
          if (result.type === 'psyop') {
            var $flash = $("#flashes #psyop");
            var $msg = $flash.find(".success .attacker");
            flashMessage($flash, $msg);
          } else if (result.type === 'ew') {
            var $flash = $("#flashes #ew");
            var $msg = $flash.find(".success .attacker");
            flashMessage($flash, $msg);
          } else {
            console.log("Unknown IW attack type: " + result.type);
          }
        } else if (result.result === "defended") {
          if (result.type === 'psyop') {
            var $flash = $("#flashes #psyop");
            var $msg = $flash.find(".defended .attacker");
            flashMessage($flash, $msg);
          } else if (result.type === 'ew') {
            var $flash = $("#flashes #ew");
            var $msg = $flash.find(".defended .attacker");
            flashMessage($flash, $msg);
          } else {
            console.log("Unknown IW attack type: " + result.type);
          }
        }
      } else if (result.defender === getPlayerColour()) {
        if (result.strength === 'feint') {
          var $flash = $("#flashes #"+result.type);
          var $msg = $flash.find(".successful_feint .defender");
          flashMessage($flash, $msg);
        } else if (result.result === "success") {
          var prefix = "";
          var selector = ".success";
          if (result.strength === 'reinforced') {
            prefix = "The attack was reinforced! ";
            selector = ".reinforced";
          }
          if (result.type === 'psyop') {
            var $flash = $("#flashes #psyop");
            var $msg = $flash.find(selector + " .defender");
            flashMessage($flash, $msg);
          } else if (result.type === 'ew') {
            var $flash = $("#flashes #ew");
            var $msg = $flash.find(selector + " .defender");
            flashMessage($flash, $msg);
          } else {
            console.log("Unknown IW attack type: " + result.type);
          }
        }
      }
    }

    if (updateResponse.result && updateResponse.result.type === "pawnbump") {
      var dest = updateResponse.result.dest;
      addInvisiblePiece(new Position(dest.x, dest.y));
    }

    if (updateResponse.result && updateResponse.result.msg === "DEFENSE_RESULT" && updateResponse.result.type === "psyop" && updateResponse.result.captured_position) {
      var dest = updateResponse.result.captured_position;
      addPsyopCaptureMarker(new Position(dest.x, dest.y));
    }

    if (g_gameState.getWinner()) {
      $("#show_confirm_forfeit").addClass("disabled");
    }

    if (isMyTurn() && g_gameState.getCurrentPhase() === g_gameState.PHASES.PAWNCAPTURE && !updateResponse.result.pawn_captures) {
      // Client refreshed after issuing pawn capture query, but before completing the capture. We've lots the resulting data.
      socket.emit('pawn_capture_query');
    }

    if (updateResponse.notes) {
      $notes_content.val(updateResponse.notes);
    }

    if (updateResponse.history) {
      updateHistoryLog(updateResponse.history);
    }

    if (isMyTurn() && g_gameState.getCurrentPhase() === g_gameState.PHASES.IW) {
      // If the player has no actions to play, automatically end the turn for them
      if (!g_actions_enabled.psyop_main && !g_actions_enabled.ew_main) {
        socket.emit('end_turn');
      }
    }
  });

  // send message functionality
  var messageInput = document.getElementById('chat_input');
  var usernameInput = document.getElementById('username');
  var sendMessage = function() {
    var message = messageInput.value;
    if (!message) {
      return;
    }
    var user = usernameInput.value || 'player';
    // TODO username should be determined on the server.
    socket.emit('message', { user: user, message: message });
    messageInput.value = '';
    messageInput.focus();
  };

  // send messages
  $(messageInput).bind('keypress', function(evt) {
    if (evt.keyCode == 13) { sendMessage(); }
  });

  $(".toggle_sound").bind('click', function() {
    if (g_playSounds) {
      g_playSounds = false;
      $("#toggle_sound").text("Enable Sound");
      $("#volume_control").addClass("volume_control_off");
      $("#volume_control").removeClass("volume_control_on");
    } else {
      g_playSounds = true;
      $("#toggle_sound").text("Disable Sound");
      $("#volume_control").addClass("volume_control_on");
      $("#volume_control").removeClass("volume_control_off");
    }
  });

  function showSettings() {
    $("#settings_dialog").css("visibility", "visible");
    $("#settings_content").css("visibility", "visible");
    $("#settings_dialog").css("z-index", "20000");
  }
  function hideSettings() {
    $("#settings_dialog").css("visibility", "hidden");
    $("#settings_content").css("visibility", "hidden");
    $("#settings_dialog").css("z-index", "0");
  }
  function showForfeitDialog() {
    $("#settings_content").css("visibility", "hidden");
    $("#forfeit_content").css("visibility", "visible");
  }
  function hideForfeitDialog() {
    $("#forfeit_content").css("visibility", "hidden");
    $("#settings_content").css("visibility", "visible");
  }
  function handleDefense(iw_attack, targets) {
    var type = iw_attack.type;
    if (g_gameState.getCurrentPhase() === g_gameState.PHASES.DEFENSE && isMyTurn() && g_gameState.board.remainingIW[type] < iw_attack.defense_cost) {
      //Not enough points to defend!
      if (!targets) { // They need to choose one of multiple targets
        socket.emit('iw_defense', { defend: false });
        console.log("Not enough points for defense. Aborting");
      }
      return;
    }
    showIWDefenseDialog(iw_attack);
    showPsyopTargets(g_gameState.board.psyop_attack_targets(iw_attack));
  }
  function showIWDefenseDialog(context) {
    $dialog = ich.iw_defense_dialog({type: context.type, cost: context.defense_cost});
    renderPointsRemaining($dialog.find("#remaining_points"), g_gameState.board.remainingIW[context.type], " ");
    $dialog.find("#ignore").bind('click', function() {
      socket.emit('iw_defense', { defend: false });
      hideIWDefenseDialog();
    });
    $dialog.find("#defend").bind('click', function() {
      socket.emit('iw_defense', { defend: true });
      hideIWDefenseDialog();
    });
    $("body").append($dialog);
  }
  function hideIWDefenseDialog() {
    $(".iw_defense_dialog").remove();
  }

  $("#settings").bind('click', function() {
    if ($("#settings_dialog").css("visibility") == "visible") {
      hideForfeitDialog();
      hideSettings();
    } else {
      showSettings();
    }
  });
  $("#settings_content .close").bind('click', function() {
    hideSettings();
  });

  $("#show_confirm_forfeit").bind('click', function() {
    if (!g_gameState.getWinner()) {
      showForfeitDialog();
    }
  });
  $("#forfeit_content .close").bind('click', function() {
    hideForfeitDialog();
  });
  $("#confirm_forfeit").bind('click', function() {
    forfeit_game();
    hideForfeitDialog();
    hideSettings();
  });

  var $notes = $("#notes");
  var $chat = $("#chat");
  var $log = $("#log");
  var $chat_message_indicator = $("#chat_message_indicator");

  var tabs = {
    notes: { content: $notes, selector: $("#notes_selector"), bg_url: "images/tab_notes.png" },
    chat: { content: $chat, selector: $("#chat_selector"), indicator: $chat_message_indicator, bg_url: "images/tab_chat.png" },
    log: { content: $log, selector: $("#log_selector"), bg_url: "images/tab_log.png" },
  };

  function showTab(tab) {
    var otherTabs;
    var $tab = tab.content;
    var $tabSelector = tab.selector;

    if ($tab.css('display') === 'none') {
      //Disable other tabs
      otherTabs = _.reject(tabs, function(t) { return t === tab; });
      _.each(otherTabs, function(t) {
        t.content.hide();
        t.selector.removeClass("selected");
        t.selector.addClass("deselected");
      });

      //Enable this one
      $tab.show();
      $tabSelector.addClass("selected");

      // Hide the indicator, if there is one
      if (tab.indicator) {
        tab.indicator.hide();
      }

      // Set the background image
      $("#text_panels").css('background', 'top left no-repeat url("'+tab.bg_url+'")');
    }
  }

  _.each(tabs, function(tab) {
    tab.selector.bind('click', function() {
      showTab(tab);
    });
  });

  var $notes_content = $("#notes_content");
  $notes_content.bind('change', function() {
    socket.emit('notes', $notes_content.val());
  });

  function updateHistoryLog(history) {
    var $content = $("#log_messages");
    $content.text('');
    _.each(history, function(entry) {
      var $entry = ich.history_entry({
        text: entry.text,
        type: entry.type
      });
      $content.append($entry);
      $content.get(0).scrollTop = $content.get(0).scrollHeight;
    });
  }

  function forfeit_game() {
    socket.emit('forfeit');
  }

  $( document ).tooltip();
  $('#pawn_capture').tooltip({ position: { my: "right" }});

  function pluralize(value, noun) {
    if (value === 1) {
      return value + " " + noun;
    }
    return value + " " + noun + "s"; // TODO support other noun forms
  };
});


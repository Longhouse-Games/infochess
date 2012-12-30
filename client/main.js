requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib',
    underscore: "../vendor/underscore/underscore"
  }
});

require(["lib/helper", "lib/infochess", "lib/building_board", 'helpers'], function(HelperModule, InfoChess, BuildingBoardModule, helpers) {

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

  var socket = io.connect();
  var g_role = 'spectator';
  var g_gameState = null;
  var g_building_board = null;
  var g_selectedType; // Selected piece type when building army

  var ui_pieces = {}; // "x,y" -> div

  function isBlackPlayer() {
    return g_role === BLACK_ROLE;
  }

  function isWhitePlayer() {
    return g_role === WHITE_ROLE;
  }

  function isSpectator() {
    return g_role === SPECTATOR_ROLE;
  }

  function getPlayerColour() {
    return g_role;
  }



  var SPECTATOR_ROLE = 'spectator';
  var WHITE_ROLE = 'white';
  var BLACK_ROLE = 'black';
  var SQUARE_SIZE = 70;
  var PIECE_MARGIN = 39;

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

    $("#points_remaining #points").text(building_board.max_points - points);
    TYPES.forEach(function(type) {
      $("#" + type + " .count").text(building_board.count(type));
    });
  }

  function addPiece(container, position, className, margin) {
    var newPieceOnBoard = document.createElement("div");
    newPieceOnBoard.className += " " + className;
    newPieceOnBoard.style.left = margin + ((position.x) * SQUARE_SIZE) + 'px';
    newPieceOnBoard.style.bottom = margin + ((position.y) * SQUARE_SIZE) + 'px';
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

    newPieceOnBoard.onclick = function() {
      if (g_gameState.getCurrentRole() === g_role) {
        clearSelection();
        this.className += " selected";
        displayPossibleMoves(getPlayerColour(), piece, position);
      }
    };

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
    $(".selected").removeClass("selected");
  }

  function displayPossibleMoves(role, piece, position) {
    var $moves = $("#moves");
    // Clear all shadow pieces
    $moves.text("");

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

      createMove($moves, piece, keyToPosition(pos_key), handler);
    });
    $moves.css('visibility', 'visible');

    var castling = g_gameState.getCastlingMoves(piece, position);

    console.log("Castling results");
    console.log(castling);
    createCastlingMoves($moves, piece, position, castling);
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

    var $moves = $("#"+getPlayerColour()+"_moves");

    // Clear all shadow pieces
    $moves.text("");

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

      createMove($moves, piece, position, handler);
    }
    $moves.css('visibility', 'visible');
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
    var container = $("#moves").get(0);
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

  function setOverlayText($overlay, text) {
    text = text || "";
    if ($overlay.text() == text) {
      return;
    }
    var oldBackground = $overlay[0].style.background;
    var timeout = 450;
    $overlay.text(text);
    setTransitionProperty($overlay, 'background ' + timeout + 'ms');
    $overlay.css('background', '#C90');
    setTimeout(function() {
      $overlay.css('background', oldBackground);
      setTimeout(function() {
        clearTransitionProperty;
      }, timeout);
    }, timeout);
  }

  function hideArmySelector() {
    var $builder = $('#army_selector').first();
    $builder.css('display', 'none');
  }

  function updateArmySelector() {
    var $builder = $('#army_selector').first();
    if (g_gameState.getCurrentPhase() === g_gameState.PHASES.SETUP) {
      $builder.css('display', 'block');
    } else {
      $builder.css('display', 'none');
      $(".temp_piece").remove();
      $(".shadow_piece").remove();
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
    var pieces = g_gameState.board.getPieces();
    console.log("Updating board, pieces:" );
    console.log(pieces);
    var piecesOnBoard = ui_pieces || {};
    $("#pieces").text("");
    $("#moves").text("");

    for (var pos_key in pieces) {
      if (pieces.hasOwnProperty(pos_key)) {
        var piece = pieces[pos_key];
        addNormalPiece(piece, keyToPosition(pos_key));
      }
    }
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

    for (i = 0; i < sources.length; i++) {
      var sourceHandler = function(src) {
        return function() {
          console.log("Source pawn "+src.x+","+src.y+" clicked");
          var dir_mod = getPlayerColour() === "white" ? 1 : -1;
          var left  = new Position(src.x - 1, src.y + (1*dir_mod));
          var right = new Position(src.x + 1, src.y + (1*dir_mod));
          clearPawnCaptureTargets();

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

  function updatePlayerTurnOverlay() {
    var $overlay = $('#turn_overlay').first();
    var yourTurn = "YOUR TURN";
    var opponentsTurn = "OPPONENT'S TURN";
    if (isSpectator()) {
      setOverlayText($overlay, g_gameState.getCurrentPhase() + "'S TURN");
      return;
    }
    if (g_gameState.getCurrentRole() === g_role) {
      setOverlayText($overlay, yourTurn);
    } else {
      setOverlayText($overlay, opponentsTurn);
    }
  }

  function printMessage(user, message) {
    var messageDiv = document.createElement('div');
    messageDiv.innerHTML = '<span style="padding-right: 15px; color: red;">' + user +
      '</span>' + message;
    document.getElementById('chatlog').appendChild(messageDiv);
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
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

    var pieces = ["king", "queen", "knight", "rook", "bishop", "pawn"];
    var costs  = [     0,       3,        2,      2,        1,      1];
    var container = document.getElementById('pieces_list');

    // TODO hook up some templating here
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      var cost = costs[i];

      var src = "images/"+piece+"_"+getPlayerColour()+".100x100.png";
      var li = document.createElement("li");
      li.id = piece;
      li.innerHTML = "<img class='piece' src='"+src+"'>"+piece+": <span class='count'>0</span> (cost: "+cost+" points)";
      container.appendChild(li);
    }

    $('#finish_army').bind('click', function() {
      socket.emit('select_army', serializeArmy());
    });
    $('#pieces_list > li').bind('click', function(event) {
      var $li = $(this);
      if ($li.hasClass('chosen')) {
        $li.removeClass('chosen');
      } else {
        $('#pieces_list > li').removeClass('chosen');
        $li.addClass('chosen');
      }
      g_selectedType = this.id;
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
    });
  }

  // reset game handler
  var $reset = $('#reset');
  $reset.bind('click', function() {
    socket.emit('requestReset');
  });

  $('#join_white').bind('click', function() {
    socket.emit('takeRole', WHITE_ROLE);
  });
  $('#join_black').bind('click', function() {
    socket.emit('takeRole', BLACK_ROLE);
  });
  $('#join_spectator').bind('click', function() {
    socket.emit('takeRole', 'spectator');
  });
  $('#pawn_capture').bind('click', function() {
    socket.emit('pawn_capture_query');
  });

  socket.on('connect', function() {

    // receive messages
    socket.on('message', function (data) {
      printMessage(data.user, data.message);
      window.scrollTo(0, document.body.scrollHeight);
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
        printMessage("server", "You are the White player!");
      } else if (role === BLACK_ROLE) {
        printMessage("server", "You are the Black player!");
      } else {
        printMessage("server", "You are a spectator");
      }
      $('.board').addClass('flickering_board');
      createArmySelector();
    });

    socket.on('num_connected_users', function(numConnectedUsers) {
      if (numConnectedUsers >= 2) {
        $('.board').first().show();
        $('#waiting').hide();
      } else {
        $('#waiting').show();
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

    socket.on('update', function(updateResponse) {
      if (!updateResponse || !updateResponse.gameState) {
        return;
      }

      g_gameState = new InfoChess.InfoChess;
      g_gameState.fromDTO(updateResponse.gameState);

      console.log("REsponse:");
      console.log(updateResponse);

      updateArmySelector();
      updatePlayerTurnOverlay();
      updateBoard();
      if (updateResponse.result.pawn_captures) {
        updatePawnCaptures(updateResponse.result.pawn_captures);
      }
    });

    // send message functionality
    var messageInput = document.getElementById('message');
    var usernameInput = document.getElementById('username');
    var sendButton = document.getElementById('send_button');
    var sendMessage = function() {
      var message = messageInput.value;
      if (!message) {
        return;
      }
      var user = usernameInput.value || 'player';
      socket.emit('message', { user: user, message: message });
      messageInput.value = '';
      messageInput.focus();
    };

    // send messages
    $(sendButton).bind('click', sendMessage);
    $(messageInput).bind('keypress', function(evt) {
      if (evt.keyCode == 13) { sendMessage(); }
    });
  });

});


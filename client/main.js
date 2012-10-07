requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib'
  }
});

require(["lib/checkers", "lib/building_board", 'helpers'], function(checkers, BuildingBoardModule, helpers) {

  if (Array.prototype.forEach === undefined) {
    Array.prototype.forEach = function(callback) {
      for (var idx = 0; idx < this.length; ++idx) {
        callback(this[idx]);
      }
    };
  }

  var BuildingBoard = BuildingBoardModule.BuildingBoard;
  var Piece = BuildingBoardModule.Piece;
  var Position = BuildingBoardModule.Position;

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

  var g_piecesOnBoard = {}; // "x,y" -> div


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

  function addPiece(container, piece, position, className, margin) {
    var newPieceOnBoard = document.createElement("div");
    newPieceOnBoard.className += " " + className;
    newPieceOnBoard.style.left = margin + ((position.x) * SQUARE_SIZE) + 'px';
    newPieceOnBoard.style.bottom = margin + ((position.y) * SQUARE_SIZE) + 'px';
    container.appendChild(newPieceOnBoard);
    return newPieceOnBoard;
  }

  function addTempPiece(piece, position) {
    var container = document.getElementById('pieces');
    var cssclass = cssClassForPiece(piece) + " temp_piece";
    var newPieceOnBoard = addPiece(container, piece, position, cssclass, PIECE_MARGIN);

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
      createMove($moves, piece, position);
    }
    $moves.css('visibility', 'visible');
  }

  function cssClassForPiece(piece) {
    return piece.type + '_' + piece.colour;
  }

  function createMove($moves, piece, position) {
    var container = $moves.get(0);
    var cssclass = "shadow_piece " + cssClassForPiece(piece);
    var newPieceOnBoard = addPiece(container, piece, position, cssclass, PIECE_MARGIN);
    newPieceOnBoard.onclick = function() {
      console.log("Adding " + piece.type + " to position '"+position.asKey()+"'");
      addTempPiece(piece, position);
      getBuildingBoard().addPiece(piece, position);
      recalculateArmy();
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
    };
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
    $builder.css('display', 'block');
  }

  function serializeArmy() {
    return {};
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

  function updatePlayerTurnOverlay() {
    var $overlay = $('#turn_overlay').first();
    var yourTurn = "YOUR TURN";
    var opponentsTurn = "OPPONENT'S TURN";
    if (isSpectator()) {
      setOverlayText($overlay, g_gameState.getCurrentPhase() + "'S TURN");
      return;
    }
    if (isWhitePlayer()) {
      setOverlayText($overlay, g_gameState.isGuerrillaTurn() ? yourTurn : opponentsTurn);
      return;
    }
    if (isBlackPlayer()) {
      setOverlayText($overlay, g_gameState.isSoldierTurn() ? yourTurn : opponentsTurn);
      return;
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

    socket.on('start_game', function() {
      hideArmySelector();
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

      g_gameState = new checkers.GameState;
      g_gameState.fromDTO(updateResponse.gameState);

      updateArmySelector();
      updatePlayerTurnOverlay();
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


requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib'
  }
});

require(["lib/checkers", 'helpers'], function(checkers, helpers) {

  if (Array.prototype.forEach === undefined) {
    Array.prototype.forEach = function(callback) {
      for (var idx = 0; idx < this.length; ++idx) {
        callback(this[idx]);
      }
    };
  }

  function Piece(colour, type, position) {
    // TODO move this to /lib/
    // TODO validate position
    this.position = position;
    // TODO validate colour
    this.colour = colour;
    // TODO validate type
    this.type = type;
  }

  var socket = io.connect();
  var g_role = 'spectator';
  var g_gameState = null;
  var g_selectedType; // Selected piece type when building army

  function getPositionKey(position) {
    if (!position) {
      return undefined;
    }
    return position.x + "," + position.y;
  }

  function isSoldierPlayer() {
    return g_role === BLACK_ROLE;
  }

  function isGuerrillaPlayer() {
    return g_role === WHITE_ROLE;
  }

  function isSpectator() {
    return g_role === SPECTATOR_ROLE;
  }

  function getPlayerColour() {
    return g_role;
  }

  var g_piecesOnBoard = {}; // "x,y" -> div
  var g_soldierPiecesOnBoard = {}; // "x,y" -> img
  var g_guerrillaPiecesOnBoard = {}; // "x,y" -> img

  var g_chessBoard = {}; // "x,y" -> Piece

  var SPECTATOR_ROLE = 'spectator';
  var WHITE_ROLE = 'white';
  var BLACK_ROLE = 'black';
  var SQUARE_SIZE = 70;
  var SOLDIER_MARGIN = 39;
  var GUERRILLA_MARGIN = 88;

  function Army() {
    return {
      king: 0,
      queen: 0,
      knight: 0,
      rook: 0,
      bishop: 0,
      pawn: 0
    };
  }

  function ArmyLimits() {
    return {
      king: 1,
      queen: 1,
      knight: 2,
      rook: 2,
      bishop: 2,
      pawn: 8
    };
  }

  function getArmy() {
    var army = new Army();

    for (var key in g_chessBoard) {
      if (g_chessBoard.hasOwnProperty(key)) {
        var piece = g_chessBoard[key];
        army[piece.type] += 1;
      }
    }
    return army;
  }

  function calculatePoints(army) {
    var points = army.queen * 3 +
      (army.knight + army.rook) * 2 +
      (army.bishop + army.pawn);
    return points;
  }

  function recalculateArmy() {
    // TODO if game has started, die/throw/or something
    var army = getArmy();
    var points = calculatePoints(army);

    $("#points_remaining #points").text(10-points);
    for (var type in army) {
      if (army.hasOwnProperty(type)) {
        $("#" + type + " .count").text(army[type]);
      }
    }
  }

  function pieceAt(position) {
    var key = position.x+","+position.y;
    var r = g_piecesOnBoard[key];
    return r;
  }

  function addPiece(container, piece, className, margin, piecesOnBoard) {
    var newPieceOnBoard = document.createElement("div");
    newPieceOnBoard.className += " " + className;
    newPieceOnBoard.style.left = margin + ((piece.position.x) * SQUARE_SIZE) + 'px';
    newPieceOnBoard.style.bottom = margin + ((piece.position.y) * SQUARE_SIZE) + 'px';
    container.appendChild(newPieceOnBoard);
    if (piecesOnBoard) {
      piecesOnBoard[getPositionKey(piece.position)] = newPieceOnBoard;
    }
    return newPieceOnBoard;
  }

  function addTempPiece(piece) {
    var container = document.getElementById('pieces');
    var piecesOnBoard = g_piecesOnBoard;
    var cssclass = cssClassForPiece(piece) + " temp_piece";
    var newPieceOnBoard = addPiece(container, piece, cssclass, SOLDIER_MARGIN, piecesOnBoard);
    // TODO add mechanism to remove this piece from the board - x in corner or drag away

    //Add removal marker
    var removalMarker = document.createElement("div");
    removalMarker.className = "removal_marker";
    removalMarker.onclick = function() {
      container.removeChild(newPieceOnBoard);
      delete piecesOnBoard[getPositionKey(piece.position)];
      delete g_chessBoard[getPositionKey(piece.position)];
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
      recalculateArmy();
    };
    newPieceOnBoard.appendChild(removalMarker);

    return newPieceOnBoard;
  }

  function addSoldierPiece(piece, container) {
    container = container || document.getElementById('pieces');
    var piecesOnBoard = g_soldierPiecesOnBoard;
    var newPieceOnBoard = addPiece(container, piece, 'soldier_piece', SOLDIER_MARGIN, piecesOnBoard);
    addSoldierPieceBehaviour(piece);
    return newPieceOnBoard;
  }

  var g_selectedSoldierPiece = null;
  function getSelectedSoldierPiece() {
    return g_selectedSoldierPiece;
  }

  function setSelectedSoldierPiece(piece) {
    var positionKey = null;
    for (positionKey in g_soldierPiecesOnBoard) {
      var otherPieceOnBoard = g_soldierPiecesOnBoard[positionKey];
      var className = otherPieceOnBoard.className.replace(/\s*selected/g, '');
      otherPieceOnBoard.className = className;
    }
    if (g_gameState.isSoldierTurn() && piece) {
      positionKey = getPositionKey(piece.position);
      var pieceOnBoard = g_soldierPiecesOnBoard[positionKey];
      g_selectedSoldierPiece = pieceOnBoard;
      if (pieceOnBoard) {
        pieceOnBoard.className += " selected";
      }
    } else {
      g_selectedSoldierPiece = null;
    }
    if (piece) {
      updateSoldierMoves(piece);
    } else {
      hideSoldierMoves();
    }
  }

  function addSoldierPieceBehaviour(piece) {
    var positionKey = getPositionKey(piece.position);
    var pieceOnBoard = g_soldierPiecesOnBoard[positionKey];
    if (!pieceOnBoard) {
      return;
    }
    if (isSoldierPlayer()) {
      pieceOnBoard.onclick = function() {
        if (!g_gameState.movedSoldier) {
          setSelectedSoldierPiece(piece);
        }
      };
    }
  }

  function addGuerrillaPiece(piece, container) {
    container = container || document.getElementById('pieces');
    var piecesOnBoard = g_guerrillaPiecesOnBoard;
    var newPieceOnBoard = addPiece(container, piece, 'guerrilla_piece', GUERRILLA_MARGIN, piecesOnBoard);
    return newPieceOnBoard;
  }

  function updatePieces(arrPieces, piecesOnBoard, addPiece) {
    arrPieces = arrPieces || [];
    piecesOnBoard = piecesOnBoard || {};
    var removedPieces = {};
    var positionKey;
    var pieceOnBoard;
    for (positionKey in piecesOnBoard) {
      removedPieces[positionKey] = piecesOnBoard[positionKey];
    }
    // add new pieces
    for (var idxPiece = 0; idxPiece < arrPieces.length; ++idxPiece) {
      var piece = arrPieces[idxPiece];
      positionKey = getPositionKey(piece.position);
      pieceOnBoard = piecesOnBoard[positionKey];
      if (!pieceOnBoard) {
        addPiece(piece);
      }
      delete removedPieces[positionKey];
    }
    // remove extra pieces
    for (positionKey in removedPieces) {
      delete piecesOnBoard[positionKey];
      pieceOnBoard = removedPieces[positionKey];
      var parentNode = pieceOnBoard.parentNode;
      if (parentNode) {
        parentNode.removeChild(pieceOnBoard);
      }
    }
  }

  function updateSoldierPieces() {
    if (g_gameState) {
      var arrPieces = g_gameState.arrSoldierPieces;
      updatePieces(arrPieces, g_soldierPiecesOnBoard, addSoldierPiece);
      if (isSoldierPlayer() && g_gameState.movedSoldier) {
        setSelectedSoldierPiece(g_gameState.movedSoldier);
      }
    }
  }

  function updateGuerrillaPieces() {
    if (g_gameState) {
      var arrPieces = g_gameState.arrGuerrillaPieces;
      updatePieces(arrPieces, g_guerrillaPiecesOnBoard, addGuerrillaPiece);
    }
  }

  function createGuerrillaMove($moves, move) {
    var piece = { position: move };
    var container = $moves.get(0);
    var newPieceOnBoard = addPiece(container, piece, 'guerrilla_piece', GUERRILLA_MARGIN);
    newPieceOnBoard.onclick = function() {
      socket.emit('placeGuerrilla', piece);
    };
  }

  function hideGuerrillaMoves() {
    var $moves = $('#guerrilla_moves');
    $moves.css('visibility', 'hidden');
  }

  function getPieceCost(type) {
    var cost = null;
    switch(type) {
      case 'king':
        cost = 0;
        break;
      case 'queen':
        cost = 3;
        break;
      case 'knight':
      case 'rook':
        cost = 2;
        break;
      case 'bishop':
      case 'pawn':
        cost = 1;
        break;
      default:
        throw new Error("Invalid type: '"+type+"'");
    }
    return cost;
  }

  function displayValidStartingPositions(side, piece_type) {

    var $moves = $("#"+getPlayerColour()+"_moves");

    // Clear all shadow pieces
    $moves.text("");

    // Determine if placement of this piece would go over the army limit
    var army = getArmy();
    var total = calculatePoints(army);
    var piece_cost = getPieceCost(piece_type);
    if ((total + piece_cost) > 10) {
      return;
    }

    // Determine if the limits for thise type have been reached
    var armyLimit = new ArmyLimits();
    if ((army[piece_type] + 1) > armyLimit[piece_type]) {
      return;
    }

    // Determine all possible positions
    var positions = [];
    var i, pos;
    var row = getPlayerColour() === 'white' ? 0 : 7;
    if (piece_type === 'king' || piece_type === 'rook' || piece_type === 'queen' || piece_type === 'knight') {
      // back row
      for (i = 0; i < 8; i++) {
        positions.push({ x: i, y: row });
      }
    } else if (piece_type === 'bishop') {
      var white = null;
      var black = null;
      // Search for black and white pieces first
      for (i = 0; i < 8; i++) {
        pos = { x: i, y: row };
        if (pieceAt(pos) && g_chessBoard[getPositionKey(pos)].type === 'bishop') {
          if ((i+row) % 2 === 0) {
            white = pos;
          } else {
            black = pos;
          }
        }
      }
      // back row
      for (i = 0; i < 8; i++) {
        pos = { x: i, y: row };
        if (!pieceAt(pos)) {
          if (!(white && ((i+row) % 2 === 0)) && !(black && ((i+row) % 2 === 1))) {
            positions.push(pos);
          }
        }
      }
    } else if (piece_type === 'pawn') {
      // second from back row
      for (i = 0; i < 8; i++) {
        row = getPlayerColour() === 'white' ? 1 : 6;
        positions.push({ x: i, y: row });
      }
    } else {
      alert("Error encountered: invalid piece_type '"+piece_type+"'. Try refreshing the page.");
      return;
    }

    // Display shadow pieces on unoccpied squares
    for (i = 0; i < positions.length; i++) {
      var position = positions[i];
      if (!pieceAt(position)) {
        piece = new Piece(getPlayerColour(), piece_type, position);
        createMove($moves, piece, position);
      }
    }
    $moves.css('visibility', 'visible');
  }

  function showGuerrillaMoves() {
    var $moves = $('#guerrilla_moves');
    $moves.text("");
    var arrMoves = g_gameState.getPotentialGuerrillaMoves();
    for (var idx = 0; idx < arrMoves.length; ++idx) {
      var move = arrMoves[idx];
      createGuerrillaMove($moves, move);
    }
    $moves.css('visibility', 'visible');
  }

  function updateGuerrillaMoves() {
    if (!g_gameState) {
      return;
    }
    hideGuerrillaMoves();
    if (!isGuerrillaPlayer()) {
      return;
    }
    if (g_gameState.isGuerrillaTurn()) {
      showGuerrillaMoves();
    }
  }

  function cssClassForPiece(piece) {
    return piece.type + '_' + piece.colour;
  }

  function createMove($moves, piece, position) {
    var move = { piece: piece, position: position };
    var container = $moves.get(0);
    var cssclass = "shadow_piece " + cssClassForPiece(piece);
    var newPieceOnBoard = addPiece(container, move, cssclass, SOLDIER_MARGIN);
    newPieceOnBoard.onclick = function() {
      console.log("Adding " + move.piece.type + " to position '"+move.position.x+","+move.position.y+"'");
      addTempPiece(piece);
      g_chessBoard[position.x+","+position.y] = piece;
      recalculateArmy();
      displayValidStartingPositions(getPlayerColour(), g_selectedType);
    };
  }

  function createSoldierMove($moves, piece, position) {
    var move = { piece: piece.position, position: position };
    var container = $moves.get(0);
    var newPieceOnBoard = addPiece(container, move, 'soldier_piece', SOLDIER_MARGIN);
    newPieceOnBoard.onclick = function() {
      socket.emit('moveCOIN', move);
      setSelectedSoldierPiece(null);
      hideSoldierMoves();
    };
  }

  function hideSoldierMoves() {
    var $moves = $('#soldier_moves');
    $moves.css('visibility', 'hidden');
  }

  function showSoldierMoves(piece) {
    var $moves = $('#soldier_moves');
    $moves.text("");
    var arrMoves;
    if (g_gameState.movedSoldier) {
      arrMoves = g_gameState.getSoldierCapturingMoves(piece);
    } else {
      arrMoves = g_gameState.getPotentialSoldierMoves(piece);
    }
    for (var idx = 0; idx < arrMoves.length; ++idx) {
      var position = arrMoves[idx];
      createSoldierMove($moves, piece, position);
    }
    $moves.css('visibility', 'visible');
  }

  function updateSoldierMoves(piece) {
    if (!g_gameState) {
      return;
    }
    hideSoldierMoves();
    if (!isSoldierPlayer()) {
      return;
    }
    if (piece && g_gameState.isSoldierTurn()) {
      showSoldierMoves(piece);
    }
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
    if (isSoldierPlayer()) {
      setOverlayText($overlay, g_gameState.isSoldierTurn() ? yourTurn : opponentsTurn);
      return;
    }
    if (isGuerrillaPlayer()) {
      setOverlayText($overlay, g_gameState.isGuerrillaTurn() ? yourTurn : opponentsTurn);
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
      updateGuerrillaPieces();
      updateSoldierPieces();
      updateGuerrillaMoves();
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


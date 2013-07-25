define([
  'underscore',
  'lib/logger',
  'lib/infochess',
  'lib/helper'],
  function(
    _,
    logger,
    InfoChess,
    HelperModule) {

  var metadata = InfoChess.metadata;

  var Position = HelperModule.Position;
  var InvalidMessageError = HelperModule.InvalidMessageError;
  var WHITE_ROLE = 'white';
  var BLACK_ROLE = 'black';
  var SPECTATOR = 'spectator';

  var Bridge = function(raven, dbData) {

    var infochess;
    if (dbData && dbData.game_state) {
      infochess = InfoChess.create(dbData.game_state);
    } else {
      infochess = InfoChess.create();
    }

    var notes = {
      white: '',
      black: ''
    };
    if (dbData && dbData.notes) {
      notes = dbData.notes;
    }

    var sockets = {};
    sockets[WHITE_ROLE] = null;
    sockets[BLACK_ROLE] = null;

    function save() {
      raven.save({ notes: notes, game_state: infochess.asDTO()});
    }

    function endOfTurn() {
      //Things that should happen when changing to another player's turn
      raven.notify(infochess.getCurrentRole());
    }

    /*
     * Send a message to player specified by role, if that player is connected
     */
    function notify(role, message, data) {
      if (sockets[role]) {
        sockets[role].emit(message, data);
      }
    }

    /*
     * Send the latest game state to player specified by role
     */
    function updatePlayer(role, result) {
      if (sockets[role]) {
        var data = {
          result: result,
          gameState: infochess.asDTO(role),
          notes: notes[role]
        };
        sockets[role].emit('update', data);
      }
    }

    function checkForWinner() {
      var winner = infochess.getWinner();
      if (winner && infochess.currentPhase === infochess.PHASES.GAMEOVER) {
        raven.broadcast('gameOver', {winner: winner});
        raven.broadcast('message', {user: 'game', message: 'Game Over'});
        var role = _.find(metadata.roles, function(role){ return role.slug === winner });
        raven.broadcast('message', {user: 'game', message: 'Winner: ' + role.name});
        raven.gameover(infochess.getWinner(), infochess.getScores());
      }
    }

    /*
     * Update all players with the latest game state, and check for a winner
     */
    function broadcastUpdate(result) {
      var data = {
        result: result,
        gameState: infochess.asDTO()
      };

      updatePlayer(WHITE_ROLE, result);
      updatePlayer(BLACK_ROLE, result);

      checkForWinner();
    }

    /*
     * Called by Raven when a player connects to the game
     * We should remember their socket, and send them the current game state,
     * as well as listen for relevant messages
     */
    function addPlayer(socket, user, role) {
      var opponent_role;

      if (!socket) {
        throw "Invalid socket!";
      }

      if (!user) {
        throw "Invalid user";
      }

      if (!role || (role !== WHITE_ROLE && role !== BLACK_ROLE)) {
        throw "Invalid role: " + role;
      }

      if (role === WHITE_ROLE) {
        opponent_role = BLACK_ROLE;
      } else {
        opponent_role = WHITE_ROLE;
      }

      sockets[role] = socket;

      socket.emit('user_info', {
        name: user.gaming_id
      });
      socket.emit('role', role);
      updatePlayer(role, null);

      var handleError = function(callback, data) {
        try {
          var result = callback(data);
          return result;
        } catch (e) {
          socket.emit('error', e);
          console.log("Error: ", e);
          console.log(e.stack);
        }
      };

      var logAndHandle = function(message, callback) {
        socket.on(message, function(data) {
          console.log("["+user.gaming_id+"] " + message + ": ", data);

          return handleError(callback, data);
        });
      };

      var logAndHandleAndUpdate = function(message, callback) {
        socket.on(message, function(data) {
          console.log("["+user.gaming_id+"] " + message + ": ", data);

          var result = handleError(callback, data);
          save();
          broadcastUpdate(result);
        });
      };

      logAndHandleAndUpdate('select_army', function(serializedArmy) {
        infochess.setArmy(role, serializedArmy);
        notify(opponent_role, 'opponent_ready', {});
      });

      logAndHandle('move', function(move) {
        var result = infochess.move(role, new Position(move.src.x, move.src.y), new Position(move.dest.x, move.dest.y));
        save();
        checkForWinner();
        updatePlayer(role, result);
        if (result.type === 'pawnbump') {
          result = {
            type: 'move'
          }
        }
        updatePlayer(opponent_role, result);
        return result;
      });

      /*
       * Return a function that can handle incoming messages for IW attacks.
       * Type must be 'ew' or 'psyop'
       */
      var handleIW = function(type) {
        if (type !== 'ew' && type !== 'psyop') {
          throw "Type must be 'ew' or 'psyop'";
        }

        return function(data) {
          if (typeof data.strength === 'undefined') {
            throw new InvalidMessageError("Protocol error: 'strength' must be specified for IW attacks");
          }

          var result = infochess.iw_attack(role, {type: type, strength: data.strength});
          endOfTurn();
          if (infochess.getCurrentPhase() === infochess.PHASES.DEFENSE) {
            return true;
          }
          return result;
        };
      };

      logAndHandleAndUpdate('ew', handleIW('ew'));
      logAndHandleAndUpdate('psyop', handleIW('psyop'));

      logAndHandleAndUpdate('iw_defense', function(data) {
        return infochess.iw_defense(role, data);
      });

      logAndHandleAndUpdate('pawn_upgrade', function(data) {
        return infochess.pawn_upgrade(role, data);
      });

      logAndHandle('pawn_capture_query', function() {
        var results = { pawn_captures: infochess.getPawnCaptures(role) };
        save();
        checkForWinner();
        updatePlayer(role, results);
        // Don't update the other player!
        return results;
      });

      logAndHandleAndUpdate('end_turn', function(data) {
        infochess.endTurn(role);
        endOfTurn();
        return true;
      });

      logAndHandle('notes', function(notes_content) {
        notes[role] = notes_content;
        save();
        return true;
      });

      socket.on('forfeit', function(data) {
        infochess.forfeit(role);
        broadcastUpdate(null);
        raven.forfeit(role);
        raven.broadcast('message', {user: 'game', message: user.gaming_id + " has forfeited the game."});
      });
    };


    function getPlayerCount() {
      return 0;
    };

    return {
      addPlayer: addPlayer,
      getPlayerCount: getPlayerCount
    };
  };

  Bridge.metadata = InfoChess.metadata;
  return Bridge;
});


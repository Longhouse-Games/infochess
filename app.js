// TODO move to config file / environment variables
var CAS_HOST = "cas.littlevikinggames.com"
var CAS_URL = "https://" + CAS_HOST + "/login";

var express = require('express')
  , app = express.createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas')
  , cookie = require('cookie')
  , Server = require('./server/server')
  , logger = require('./server/logger')
  , util = require('util');
// requirejs
var requirejs = require('requirejs');
requirejs.config({
  nodeRequire: require,
  paths: {
    underscore: "./vendor/underscore"
  },
  shim: {
    underscore: {
      exports: '_'
    }
  }
});

requirejs(['underscore', 'moment', './lib/infochess'], function(_, moment, InfoChess) {

// global variables
var connectedUsers = 0;

// global types
var Schema = mongoose.Schema;
var ChatSchema = new Schema({
  time: {type: Date},
  user: {type: String},
  message: {type: String, trim: true}
});
var ChatModel = mongoose.model('Chat', ChatSchema);

var userSchema = new Schema({
  name: String
});
var User = mongoose.model('User', userSchema);

var sessionSchema = new Schema({
  session_id: { type: String, default: null },
  username: {type: String, default: null }
});
var Session = mongoose.model('Session', sessionSchema);

var gameSchema = new Schema({
  is_in_progress: { type: Boolean, default: false },
  coin_player_name: { type: String, default: null },
  guerrilla_player_name: { type: String, default: null },
  gameState: String
});

var gameHasUser = function(dbgame, user) {
  return dbgame.coin_player_name === user.name || dbgame.guerrilla_player_name === user.name;
}

// next takes game found, or null if none were found
gameSchema.statics.findMeAGame = function(user, next) {
  _this = this;

  // Find a game that the player is participating in
  _this.findOne(
    // Mongo queries are truly a highpoint of code beauty.
      {$and: [
        {is_in_progress: true},
        {$or: [
          {coin_player_name: user.name},
          {guerrilla_player_name: user.name}
        ]},
      ]},
    function(err, game) {
      if (err) throw err;
      if (game) {
        logger.debug("Found a game with stoopid query");
        next(game);
      }
      else {
        logger.debug("FindingMeAGame: Couldn't find a game that user '"+user.name+"' is participating in.");
        // Find a game where there is an empty slot
        _this.findOne({$and: [ {is_in_progress: true}, {$or: [{coin_player_name: null},{guerrilla_player_name: null}]}]}, function(err, game) {
            if (err) throw err;
            if (game) next(game);
            else {
              logger.debug("FindingMeAGame: Couldn't find a game for user '"+user.name+"' that has an empty slot.");
              // No open games, create a new one! yay!
              dbgame = new Game({ is_in_progress: true });
              dbgame.save(function (err) {
                if (err) { throw err; }
                next(dbgame);
              });
            }
          });
      }
    });
}
var Game = mongoose.model('Game', gameSchema);

var find_or_create_session = function(username, session_id, next) {
  Session.findOne({ session_id: session_id }, function(err, session) {
    if (err) { throw err; }
    if (session) {
      next(session);
    } else {
      session = new Session({ session_id: session_id, username: username });
      session.save(function(err) {
        if (err) { throw err; }
        next(session);
      });
    }
  });
}
// next takes the found/created user as parameter
var find_or_create_user = function(username, session_id, next) {
  find_or_create_session(username, session_id, function(session) {
    User.findOne({ name: username }, function (err, user) {
      if (err) {
        throw err;
      }
      if (user) {
        next(user);
      } else {
        var user = new User({ name: username });
        user.save(function (err) {
          if (err) {
            throw err;
          }
          next(user);
        });
      }
    });
  });
};

// helper functions 
var fetchRecentMessages = function(callback) {
  var chatModel = mongoose.model('Chat');
  chatModel
    .find()
    .sort('time', -1) // descending
    .limit(5)
    .exec(callback);
};

var saveMessageToMongo = function(data) {
  new ChatModel({time: new Date(), user: data.user, message: data.message}).save();
};

function handleLogin(request, response) {

  console.log("Handling Login!");

  applyHeaders(response);

  var serviceTicket = request.query.ticket;
  var hasServiceTicket = typeof serviceTicket !== 'undefined';

  var hostname = 'http://' + request.headers.host;
  var loginUrl = CAS_URL + '?service=' + encodeURIComponent(hostname);

  var casInstance = new cas({
    base_url: "https://" + CAS_HOST,
    service: hostname
  });

  // initial visit
  if (!hasServiceTicket) {
    console.log("Redirecting to CAS Login");
    response.redirect(loginUrl);
    return;
  } 

  console.log("Got service ticket!");

  // validate service ticket
  casInstance.validate(serviceTicket, function(error, status, username) {
    if (error || !status) {
      response.redirect(loginUrl);
      return;
    }
    console.log(username + " logged in! SessionID: " + request.cookies['express.sid']);
    find_or_create_user(username, request.cookies['express.sid'], function(user) {
      response.sendfile(__dirname + '/index.html');
    });
  });
}

applyHeaders = function(res) {
  res.header('Expires', 'Wed, 11 Jan 1984 05:00:00 GMT');
  res.header("Cache-Control", "no-cache, must-revalidate, max-age=0");
  res.header('Last-Modified', moment().format());
  res.header('Pragma', 'no-cache');
};

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.session({secret: 'secret', key: 'express.sid'}));
});
// routing
sendfile = function(res, file) {
  applyHeaders(res);
  res.sendfile(file);
};
serve_dir = function(req, res) {
  applyHeaders(res);
  res.sendfile(__dirname + req.originalUrl);
}

app.post('/', function (req, res) {
  handleLogin(req, res);
});
app.get('/', function (req, res) {
  handleLogin(req, res);
});
app.get('/debug', function (req, res) {
  sendfile(__dirname + '/debug.html');
});
app.get('/images/*', serve_dir);
app.get('/vendor/*', serve_dir);
app.get('/style/*', serve_dir);
app.get('/lib/*', serve_dir);
app.get('/client/*', serve_dir);
app.get('/scripts/*', serve_dir);

// successful connection
io.set('authorization', function (data, accept) {
  // check if there's a cookie header
  if (data.headers.cookie) {
    // if there is, parse the cookie
    data.cookie = cookie.parse(data.headers.cookie);
    // note that you will need to use the same key to grad the
    // session id, as you specified in the Express setup.
    data.sessionID = data.cookie['express.sid'];
  } else {
   // if there isn't, turn down the connection with a message
   // and leave the function.
   return accept('No cookie transmitted.', false);
  }
  // accept the incoming connection
  accept(null, true);
});

var active_games = [];

var totalUsers = function() {
  return _.reduce(active_games, function(accum, server) {
    return accum + server.getPlayerCount();
  }, 0)
};

var attachPlayerToGame = function(game, socket, user) {
  var player = game.addPlayer(socket, user);

  socket.on('disconnect', function(socket) {
    console.log('connected users: ', totalUsers());
  });

  logger.debug('joined game', util.inspect(game, 1));
  logger.debug('active games: ' + active_games.length);
  logger.debug('connected users: ' + totalUsers());
}

var findActiveGameByUser = function(user) {
  var i = 0;
  for(i = 0; i < active_games.length; i++) {
    dbgame = active_games[i].getDBGame();
    if (gameHasUser(dbgame, user)) {
      return active_games[i];
    }
  }
  return null;
}

var findActiveGameByDBGame = function(dbgame) {
  var i = 0;
  for(i = 0; i < active_games.length; i++) {
    tmp = active_games[i].getDBGame();
    if (tmp._id.equals(dbgame._id)) {
      return active_games[i];
    }
  }
  return null;
}

var loadGame = function(dbgame) {
  var factory = null;
  if (_.isUndefined(dbgame.gameState) || dbgame.gameState === null) {
    logger.debug("Creating new game: "+dbgame._id);
    factory = function() { return new InfoChess.InfoChess(); };
  } else {
    logger.debug("Restoring old game: "+dbgame._id);
    factory = function() {
      gameState = new InfoChess.InfoChess();
      gameState.fromDTO(JSON.parse(dbgame.gameState));
      return gameState;
    };
  }
  return game = new Server.Server(factory, dbgame);
}

io.sockets.on('connection', function (socket) {
  Session.findOne({session_id: socket.handshake.sessionID}, function(err, session) {
    if (err || !session) {
      throw "Unable to look up user by sessionID '"+sessionID+"': "+err;
    }
    User.findOne({name: session.username}, function(err, user) {
      if (err || !user) {
        throw "Unable to look up user by user.name '"+user.name+"': "+err;
      }
      var game = findActiveGameByUser(user);
      logger.debug("Game for user '"+user.name+"': ", game === null ? "not found" : "found");

      if (game) {
        attachPlayerToGame(game, socket, user);
      } else {
        Game.findMeAGame(user, function(dbgame) {
          logger.debug("FoundMeAGame for user '"+user.name+"': " + dbgame._id);
          var game = findActiveGameByDBGame(dbgame);
          if (!game) {
            game = loadGame(dbgame);
            logger.debug("Stuffing game into active_games: " + dbgame._id);
            active_games.push(game);
          }
          attachPlayerToGame(game, socket, user);
        });
      }
    });
  });
});

mongoose.connect('mongodb://localhost/lvg');

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Guerrilla-checkers listening on http://localhost:" + port);
});

});


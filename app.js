var CAS_HOST = process.env.CAS_HOST || "cas.littlevikinggames.com";
var CAS_URL = process.env.CAS_URL || "https://" + CAS_HOST + "/login";
var CAS_HOST_FALLBACK = process.env.CAS_HOST_FALLBACK;
var CAS_URL_FALLBACK = process.env.CAS_URL_FALLBACK || "https://" + CAS_HOST_FALLBACK + "/login";
var PORT = process.env.PORT || 3000;
var EGS_HOST = process.env.EGS_HOST || "globalecco.org";
var EGS_PORT = process.env.EGS_PORT || 443;
var EGS_USERNAME = process.env.EGS_USERNAME;
var EGS_PASSWORD = process.env.EGS_PASSWORD;
var PREFIX = process.env.PREFIX || "";
var AIRBRAKE_API_KEY = process.env.AIRBRAKE_API_KEY;

var KEY_FILE = process.env.KEY_FILE;
var CERT_FILE = process.env.CERT_FILE;

var app;

var use_ssl = false;

var fs = require('fs'),
    express = require('express'),
    logger = require('./server/logger')

if (KEY_FILE && CERT_FILE) {
  logger.info("Using SSL");
  use_ssl = true;

  var server_options = {};
  server_options.key = fs.readFileSync(KEY_FILE);
  server_options.cert = fs.readFileSync(CERT_FILE);

  app = express.createServer(server_options);
} else if ((KEY_FILE && !CERT_FILE) || (CERT_FILE && !KEY_FILE)) {
  throw "If one of KEY_FILE or CERT_FILE are specified, you must supply both of them, not just one";
} else {
  app = express.createServer();
}

var mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas')
  , cookie = require('cookie')
  , Server = require('./server/server')
  , EGSNotifier = require('./server/egs_notifier')
  , http_request = require('request')
  , airbrake = require('airbrake')
  , util = require('util');

if (AIRBRAKE_API_KEY) {
  var client = airbrake.createClient(AIRBRAKE_API_KEY);
  client.handleExceptions();
//  app.error(client.expressHandler()); SEE: https://github.com/felixge/node-airbrake/issues/25
}

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

var metadata = new Server.Metadata();

// global types
var Schema = mongoose.Schema;
var ChatSchema = new Schema({
  time: {type: Date},
  user: {type: String},
  message: {type: String, trim: true}
});
var ChatModel = mongoose.model('Chat', ChatSchema);

var userSchema = new Schema({
  gaming_id: {type: String, default: null },
  cas_handle: {type: String, default: null }
});
var User = mongoose.model('User', userSchema);

var sessionSchema = new Schema({
  session_id: { type: String, default: null },
  gaming_id: {type: String, default: null },
  game_id: {type: String, default: null}
});
var Session = mongoose.model('Session', sessionSchema);

var gameSchema = new Schema({
  is_in_progress: { type: Boolean, default: false },
  roles: function(roles){
    var results = {};
    for (var i = 0; i < roles.length; i++) {
      results[roles[i].slug] = { type: String, default: null };
    }
    return results;
  }(metadata.roles),
  gameState: String
});

var Game = mongoose.model('Game', gameSchema);

var find_or_create_session = function(gaming_id, session_id, next) {
  Session.findOne({ session_id: session_id }, function(err, session) {
    if (err) { throw err; }
    if (session) {
      next(session);
    } else {
      session = new Session({ session_id: session_id, gaming_id: gaming_id });
      session.save(function(err) {
        if (err) { throw err; }
        next(session);
      });
    }
  });
}
// next takes the found/created user as parameter
var find_or_create_user = function(profile, session_id, next) {
  var gaming_id = profile.gamingId;
  find_or_create_session(gaming_id, session_id, function(session) {
    User.findOne({ gaming_id: gaming_id }, function (err, user) {
      if (err) {
        throw err;
      }
      if (user) {
        next(user);
      } else {
        var user = new User({ gaming_id: gaming_id, cas_handle: profile.casId });
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

function handleLogin(request, response, game_id, callback) {

  logger.info("Handling Login!");

  applyHeaders(response);

  var serviceTicket = request.query.ticket;
  var hasServiceTicket = typeof serviceTicket !== 'undefined';

  var host = CAS_HOST;
  var cas_url = CAS_URL;

  if (request.query.cas == "test") {
    host = CAS_HOST_FALLBACK;
    cas_url = CAS_URL_FALLBACK;
  }

  var protocol = use_ssl ? "https://" : "http://";
  logger.debug("Request.url: " + request.url);
  var path = request.url.replace(/[&|\?]?ticket=[\w|-]+/i, "");
  logger.debug("Path: " + path);
  var hostname = protocol + request.headers.host + path;
  logger.debug("CAS service: "+hostname);
  var loginUrl = cas_url + '?service=' + encodeURIComponent(hostname);
  logger.debug("CAS Login URL: "+loginUrl);

  var casInstance = new cas({
    base_url: "https://" + host,
    service: hostname
  });

  // initial visit
  if (!hasServiceTicket) {
    logger.info("Redirecting to CAS Login");
    response.redirect(loginUrl);
    return;
  } 

  logger.info("Got service ticket!");

  // validate service ticket
  casInstance.validate(serviceTicket, function(error, status, cas_handle) {
    if (error || !status) {
      response.redirect(loginUrl);
      return;
    }
    logger.info(cas_handle + " logged in! SessionID: " + request.cookies['express.sid']);
    getPlayerProfile(cas_handle, game_id, function(error, profile) {
      if (error) {
        respond_with_error(response, error);
        return;
      }
      if (!profile) {
        respond_with_error(response, "Unable to retrieve player profile.");
        return;
      }
      find_or_create_user(profile, request.cookies['express.sid'], function(user) {
        callback(user);
      });
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
  var path = __dirname + req.originalUrl.replace(new RegExp(PREFIX, ""), "")
  logger.debug("Serving: " + path);
  res.sendfile(path);
}

authenticateAppServer = function(req, res, callback) {
  //TODO implement
  callback();
};

handleNew = function(req, res) {
  authenticateAppServer(req, res, function() {
    return createGame(req, res);
  });
};

handlePlay = function(req, res) {
  var game_id = req.param('gid');
  if (!game_id) {
    res.send("gid is a required parameter", 400);
    return;
  }
  handleLogin(req, res, game_id, function(user) {
    return playGame(req, res, game_id, user);
  });
};

var egs_response = function(req, res, params, next) {
  if (!params.stat) { throw "Params.stat is required"; }

  var format = "xml";
  if (req.param('fmt')) {
    format = req.param('fmt').toLowerCase();
  }

  var code = params.stat === "ERROR" ? 400 : 200;
  if (format === "xml") {
    var body = "<rslt><stat>"+params.stat+"</stat></rlst>";
    if (params.msg) {
      body = body + "<msg>"+params.msg+"</msg>";
    }
    if (params.game_id) {
      body = body + "<glst><cnt>1</cnt><game><gid>"+params.game_id+"</gid></game></glst>";
    }
    res.send(body, { 'Content-Type': 'application/xml' }, code);
  } else if (format === "json") {
    var json = { rslt: { stat: params.stat } };
    if (params.msg) {
      json.rslt.msg = params.msg;
    }
    if (params.game_id) {
      json.rslt.glst = {
        cnt: 1,
        games: [params.game_id]
      };
    }
    res.json(json, code);
  } else if (format === "html" && req.param("dbg") === "1") {
    var role1 = metadata.roles[0];
    var role2 = metadata.roles[1];
    var html = "";
    html = html + "<b>With ECCO CAS server:</b><br>";
    html = html + "<a href='"+PREFIX+"/play?gid="+params.game_id+"&role="+role1.slug+"&app=BRSR'>Join game '"+params.game_id+"' as "+role1.name+"</a><br>";
    html = html + "<a href='"+PREFIX+"/play?gid="+params.game_id+"&role="+role2.slug+"&app=BRSR'>Join game '"+params.game_id+"' as "+role2.name+"</a><br>";
    html = html + "<hr><b>With test CAS server:</b><br>";
    html = html + "<a href='"+PREFIX+"/play?gid="+params.game_id+"&cas=test&role="+role1.slug+"&app=BRSR'>Join game '"+params.game_id+"' as "+role1.name+"</a><br>";
    html = html + "<a href='"+PREFIX+"/play?gid="+params.game_id+"&cas=test&role="+role2.slug+"&app=BRSR'>Join game '"+params.game_id+"' as "+role2.name+"</a><br>";
    res.send(html, { 'Content-Type': 'text/html' }, code);
  } else {
    res.send("Invalid format: " + req.fmt+". Must be one of 'json' or 'xml'", 400);
  }
  if (typeof next === 'function') {
    next();
  }
};

var egs_error_response = function(req, res, message) {
  return egs_response(req, res, {
    stat: "ERROR",
    msg: message
  });
};

var egs_game_response = function(req, res, game_id, next) {
  egs_response(req, res, {
    stat: "OK",
    game_id: game_id
  }, next);
};

var getPlayerProfile = function(cas_handle, game_id, callback) {
  logger.debug("getPlayerProfile() called with cas_handle: "+cas_handle+", and gameid: " + game_id);
  var path = "/api/secure/jsonws/egs-portlet.gamingprofile/get?ver=1.0&title="+metadata.slug+"&gid="+encodeURIComponent(game_id)+"&email="+encodeURIComponent(cas_handle);

  var auth = (EGS_USERNAME && EGS_PASSWORD) ? (encodeURIComponent(EGS_USERNAME)+":"+EGS_PASSWORD+"@") : "";
  var url = "http://"+auth+EGS_HOST+":"+EGS_PORT+path;
  var opts = {
    url: url,
    method: 'GET'
  };
  logger.debug("Opts for request:", opts);
  http_request(opts, function(error, response, body) {
    if (error) {
      logger.error("Error getting gaming profile from EGS. Error: " + error);
      callback("Unable to retrieve gaming profile for "+cas_handle);
      return;
    }
    if (response.statusCode !== 200) {
      logger.error("Error getting gaming profile from EGS. Response code: " + (response.statusCode || 'none') );
      logger.error(body);
      callback("Unable to retrieve gaming profile for "+cas_handle);
      return;
    }

    logger.debug("Response from EGS: " + body);
/*
     {
       "gameInstanceId": "xxx",
       "gamingId":"xxxxxxx",
       "casId": "some email address"
     }
*/
    var response = JSON.parse(body);
    if (response.exception) {
      callback(response.exception, null);
    } else {
      callback(null, response);
    }
    return;
  });
};

var respond_with_error = function(response, message) {
  logger.error("Error: " + message);
  response.send(message, 400);
};

var createGame = function(req, res) {
  var lang = req.lang;
  var debug = req.debug;
  var app = req.app;
  var role1 = metadata.roles[0];
  var role2 = metadata.roles[1];
  var player1 = req.param('role1') || req.param(role1.slug);
  var player2 = req.param('role2') || req.param(role2.slug);
  if (!player1 || !player2) {
    logger.error("Got invalid request for new game:");
    logger.error(req.query);
    return egs_error_response(req, res, "Both roles must be provided ("+role1.slug+" and "+role2.slug+")");
  }

  var roles = {}
  roles[role1.slug] = player1;
  roles[role2.slug] = player2;
  var dbgame = new Game({
    is_in_progress: true,
    roles: roles
  });
  dbgame.save(function (err, game) {
    if (err) { throw err; }

    logger.debug("Created game: "+game._id+". Roles: "+game.roles);
    egs_game_response(req, res, game._id, function() {
      var egs_notifier = new EGSNotifier.EGSNotifier({
        host: EGS_HOST,
        port: EGS_PORT,
        username: EGS_USERNAME,
        password: EGS_PASSWORD,
        game_id: dbgame._id,
        game_title: metadata.slug,
        game_version: '1.0',
        players: roles
      });
      egs_notifier.move(role1);
    });
  });
};

var playGame = function(req, res, game_id, user) {
  var role = req.param('role');

  if (!role) {
    res.send("role is a required parameter", 400);
    return;
  }
  if (role !== metadata.roles[0].slug && role !== metadata.roles[1].slug) {
    res.send("role must be one of '"+metadata.roles[0].slug+"' or '"+metadata.roles[1].slug+"'");
    return;
  }

  Game.findOne({_id: game_id}, function(err, game) {
    if (err || !game) {
      logger.error("Error looking up game '"+game_id+"'");
      res.send("Could not find game with id: " + game_id, 400);
      return;
    }
    logger.debug("Found game: " + game_id);
    logger.debug(game);

    logger.debug("User:");
    logger.debug(user);

    var requested_nickname = game.roles[role];
    if (user.gaming_id !== requested_nickname) {
      respond_with_error(res, "Requested game role does not match the logged in user ('"+user.gaming_id+"').");
      logger.debug("Requested role: " + role + ", saved handle: " + requested_nickname + ", current handle: " + user.gaming_id);
      return;
    }

    // TODO HACK temporary hack to quickly lookup game_id after they connect with websockets
    Session.findOne({session_id: req.cookies['express.sid']}, function(err, session) {
      if (err) {
        logger.error("Error looking up session for: " + req.cookies['express.sid']);
        res.send("Could not find session. Try reconnecting.", 400);
        return;
      }

      session.game_id = game_id;
      logger.debug("Saved game_id to session.");
      session.save(function(err) {
        if (err) { throw err; }

        logger.debug("Playing game: "+game_id);
        res.sendfile(__dirname + '/index.html');
      });
    });
  });
};

app.post(PREFIX+'/new', function(req, res) {
  handleNew(req, res);
});
app.get(PREFIX+'/new', function(req,res) {
  handleNew(req, res);
});
app.post(PREFIX+'/play', function(req, res) {
  handlePlay(req, res);
});
app.get(PREFIX+'/play', function(req, res) {
  handlePlay(req, res);
});

app.get(PREFIX+'/debug', function (req, res) {
  sendfile(__dirname + '/debug.html');
});
app.get(PREFIX+'/rules.html', function (req, res) {
  res.sendfile(__dirname + '/rules.html');
});
app.get(PREFIX+'/status', function(req, res) {
  res.send("Okay!");
});
app.get(PREFIX+'/images/*', serve_dir);
app.get(PREFIX+'/vendor/*', serve_dir);
app.get(PREFIX+'/sounds/*', serve_dir);
app.get(PREFIX+'/style/*', serve_dir);
app.get(PREFIX+'/lib/*', serve_dir);
app.get(PREFIX+'/client/*', serve_dir);
app.get(PREFIX+'/scripts/*', serve_dir);

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
    logger.info('connected users: ', totalUsers());
  });

  logger.debug('joined game');
  logger.debug('active games: ' + active_games.length);
  logger.info('connected users: ' + totalUsers());
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
  var roles = {};
  _.each(metadata.roles, function(role) {
    roles[role.slug] = dbgame.roles[role.slug]
  });

  var egs_notifier = new EGSNotifier.EGSNotifier({
    host: EGS_HOST,
    port: EGS_PORT,
    username: EGS_USERNAME,
    password: EGS_PASSWORD,
    game_id: dbgame._id,
    game_title: metadata.slug,
    game_version: '1.0',
    players: roles
  });
  var factory = null;
  if (_.isUndefined(dbgame.gameState) || dbgame.gameState === null) {
    logger.info("Creating new game: "+dbgame._id);
    factory = function() {
      return new InfoChess.InfoChess();
    };
  } else {
    logger.debug("Restoring old game: "+dbgame._id);
    factory = function() {
      gameState = new InfoChess.InfoChess();
      gameState.fromDTO(JSON.parse(dbgame.gameState));
      return gameState;
    };
  }
  return game = new Server.Server(factory, dbgame, egs_notifier);
}

var handleSessionError = function(socket) {
  socket.emit('session_error', "Invalid socket session. Please refresh your browser.");
};

io.sockets.on('connection', function (socket) {
  if (!socket.handshake.sessionID) {
    // This occurs when a client reconnects after server restarts
    handleSessionError(socket);
    return;
  }
  Session.findOne({session_id: socket.handshake.sessionID}, function(err, session) {
    if (err) {
      throw "Error looking up session: " + err;
    }
    if (!session) {
      handleSessionError(socket);
      return;
    }
    var game_id = session.game_id;
    Game.findOne({_id: game_id}, function(err, dbgame) {
      if (err || !dbgame) {
        logger.error("Unable to lookup game: "+game_id);
        socket.emit('error', "Unable to lookup requested game. Try refreshing your browser.");
        return;
      }
      User.findOne({gaming_id: session.gaming_id}, function(err, user) {
        if (err || !user) {
          logger.error("Unable to look up user by user.gaming_id '"+user.gaming_id+"': "+err);
          socket.emit('error', "Unable to look up user. Try refreshing your browser.");
          return;
        }
        var game = findActiveGameByDBGame(dbgame);
        if (!game) {
          game = loadGame(dbgame);
          logger.debug("Stuffing game into active_games: " + dbgame._id);
          active_games.push(game);
        }
        attachPlayerToGame(game, socket, user);
      });
    });
  });
});

mongoose.connect('mongodb://localhost/lvg-'+metadata.slug);

app.listen(PORT, function() {
  logger.info("["+new Date()+"] "+metadata.name+" listening on http://localhost:" + PORT + PREFIX);
});

});


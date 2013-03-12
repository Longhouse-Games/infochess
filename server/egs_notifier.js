var requirejs = require('requirejs'),
    logger    = require('./logger'),
    request   = require('request');

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

requirejs([ 'underscore'], function(_) {
  var EGSNotifier = function(options) {
    var req = function(val) {
      if (!options[val]) {
        throw "EGSNotifier(): "+val+" is a required option";
      }
      return options[val];
    };
    this.host = req('host');
    this.port = options.port || 443;
    this.protocol = options.protocol || (this.port === 443 ? 'https' : 'http')
    this.username = options.username;
    this.password = options.password;
    this.game_id = req('game_id');
    this.game_title = req('game_title');
    this.game_version = req('game_version');
    this.players = req('players');
    this.STATES = {
      PEND: "PEND",
      ATTN: "ATTN",
      OVER: "OVER"
    };
    logger.debug("EGS Notifier started for host: "+this.host);

    this.deliver = function(options) {
      var path = "/api/secure/jsonws/egs-portlet.gamebot";

      var auth = (this.username && this.password) ? (encodeURIComponent(this.username)+":"+this.password+"@") : "";
      var url = "http://"+auth+this.host+":"+this.port+path;
      var opts = {
        url: url,
        method: 'POST',
        headers: { "Content-type": "text/plain; charset=utf-8" },
        body: JSON.stringify(this.buildWrapper(options))
      };
      logger.debug("Opts for request:", opts);
      request(opts, function(error, response, body) {
        if (error) {
          logger.error("Error notifying EGS. Error: " + error);
          return;
        }
        if (response.statusCode !== 200) {
          logger.error("Error notifying EGS. Response code: " + (response.statusCode || 'none') );
          logger.error(body);
          return;
        }

        logger.debug("Response from EGS: " + body);
        return;
      });
    }
    this.buildUpdate = function(options) {
      var update = {
       "gameInstanceId": this.game_id,
       "gameTitle": this.game_title,
       "gameVersion": this.game_version,
       "gamingId": options.gamingId,
       "state": options.state
      };
      if ('score' in options) {
        update['score'] = options['score'];
      }
      if (options['outcome']) {
        update['outcome'] = options['outcome'];
      }
      return update;
    };
    this.buildWrapper = function(options) {
      var payload = {}
      if (options.updates) {
        payload.updates = options.updates;
      }
      if (options.outcomes) {
        payload.outcomes = options.outcomes;
      }
      return {
         "method": "game-updates",
         "id": 7224,
         "jsonrpc":"2.0",
         "params": {
            "payload": payload
         }
      }
    };
  };

  EGSNotifier.prototype.move = function(role) {
    var me = this;
    var updates = _.map(
        _.reject(this.players, function(gaming_id, role_slug) {
          return role === role_slug;
        }),
        function(gaming_id) {
          logger.info("EGSNotifier: Notifying EGS that it's not "+gaming_id+"'s turn");
          return me.buildUpdate({gamingId: gaming_id, state: me.STATES.PEND});
        }
    );
    logger.info("EGSNotifier: Notifying EGS that it's "+this.players[role]+"'s turn");
    updates.push(this.buildUpdate({gamingId: this.players[role], state: this.STATES.ATTN}));
    return this.deliver({ updates: updates });
  };

  EGSNotifier.prototype.forfeit = function(forfeiting_role) {
    var me = this;
    logger.info("EGSNotifier: Notifying EGS that "+forfeiting_role+" has forfeited and the game is over.");
    var updates = _.map(this.players, function(gaming_id, role) {
      var options = {
        gamingId: gaming_id,
        state: me.STATES.OVER,
        score: 0
      }
      if (gaming_id === me.players[forfeiting_role]) {
        options.outcome = "Forfeit";
      } else {
        options.outcome = "Win";
      }

      return me.buildUpdate(options);
    });
    return this.deliver({ updates: updates });
  };

  EGSNotifier.prototype.gameover = function(winning_role, scores) {
    var me = this;
    logger.info("EGSNotifier: Notifying EGS that it's gameover.");

    var scores_with_ids = {};
    _.each(scores, function(score, role) {
      scores_with_ids[me.players[role]] = score;
    });

    var updates = _.map(this.players, function(gaming_id, role) {
      var options = {
        gamingId: gaming_id,
        state: me.STATES.OVER,
        score: scores[role]
      }
      if (gaming_id === me.players[winning_role]) {
        options.outcome = "Win";
      } else {
        options.outcome = "Lose";
      }
      return me.buildUpdate(options);
    });

    return this.deliver({ updates: updates });
  };

  module.exports.EGSNotifier = EGSNotifier;
});


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
    this.username = options.username;
    this.password = options.password;
    this.game_id = req('game_id');
    this.game_title = req('game_title');
    this.game_version = req('game_version');
    this.role1 = req('role1');
    this.role2 = req('role2');
    this.STATES = {
      PEND: "PEND",
      ATTN: "ATTN",
      OVER: "OVER"
    };
    logger.debug("EGS Notifier started for host: "+this.host);

    this.deliver = function(updates) {
      var path = "/api/secure/jsonws/egs-portlet.gamebot";

      var auth = (this.username && this.password) ? (encodeURIComponent(this.username)+":"+this.password+"@") : "";
      var url = "http://"+auth+this.host+":"+this.port+path;
      var opts = {
        url: url,
        method: 'POST',
        headers: { "Content-type": "text/plain; charset=utf-8" },
        body: JSON.stringify(this.buildPayload(updates))
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
    this.buildUpdate = function(gamingId, state) {
      return {
       "gameInstanceId": this.game_id,
       "gameTitle": this.game_title,
       "gameVersion": this.game_version,
       "gamingId": gamingId,
       "state": state
      };
    };
    this.buildPayload = function(updates) {
      return {
         "method": "game-updates",
         "id": 7224,
         "jsonrpc":"2.0",
         "params": {
            "payload": {
                "updates": updates
            }
         }
      }
    }
  };

  EGSNotifier.prototype.role1sMove = function() {
    logger.info("EGSNotifier: Notifying EGS that it's "+this.role1+"'s turn");
    logger.info("EGSNotifier: Notifying EGS that it's not "+this.role2+"'s turn");
    return this.deliver([
      this.buildUpdate(this.role1, this.STATES.ATTN),
      this.buildUpdate(this.role2, this.STATES.PEND)
    ]);
  };

  EGSNotifier.prototype.role2sMove = function() {
    logger.info("EGSNotifier: Notifying EGS that it's "+this.role2+"'s turn");
    logger.info("EGSNotifier: Notifying EGS that it's not "+this.role1+"'s turn");
    return this.deliver([
      this.buildUpdate(this.role2, this.STATES.ATTN),
      this.buildUpdate(this.role1, this.STATES.PEND)
    ]);
  };

  EGSNotifier.prototype.gameover = function() {
    logger.info("EGSNotifier: Notifying EGS that it's gameover.");
    return this.deliver([
      this.buildUpdate(this.role2, this.STATES.OVER),
      this.buildUpdate(this.role1, this.STATES.OVER)
    ]);
  }

  module.exports.EGSNotifier = EGSNotifier;
});


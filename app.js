var Raven = require('raven');

var InfoChess = require('./server/server');
ic = Raven.init(InfoChess);

ic.configure({
  send_index: function(request, response) {
    response.sendfile(__dirname + "/index.html");
  },
  send_asset: function(request, response, path) {
    path = __dirname + path;
    response.sendfile(path);
  }
});

ic.run();

var freebase = require("freebase");

exports.getArtistId = function (name, callback) {
  var query = [{
    mid: null,
    name: name,
    type: "/music/artist"
  }];

  var options = {
    html_escape: false,
  };

  // Freebase.js does not use the Node convention of Error object as first callback parameter.
  var myCallback = function (data) {
    if (!data) {
      callback(new Error("unknown error"));
    }
    if (data.result) {
      var result = data.result.map(function (value) {
        return value.mid;
      });
      callback(null, result);
    } else {
      callback(data);
    }
  };

  freebase.mqlread(query, options, myCallback);
};
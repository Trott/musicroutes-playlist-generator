var freebase = require("freebase");

// Freebase.js does not use the Node convention of Error object as first callback parameter.
var callbackify = function (callback) {
  return function (data) {
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
};

exports.getArtistId = function (name, callback) {
  var query = [{
    mid: null,
    name: name,
    type: "/music/artist"
  }];

  var options = {
    html_escape: false,
  };

  var myCallback = callbackify(callback);
  freebase.mqlread(query, options, myCallback);
};
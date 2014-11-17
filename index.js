var freebase = require("freebase");

// Freebase.js does not use the Node convention of Error object as first callback parameter.
var callbackify = function (callback, cleanup) {
  return function (data) {
    if (!data) {
      callback(new Error("unknown error"));
    }
    if (data.result) {
      var result = cleanup(data.result);
      callback(null, result);
    } else {
      callback(data);
    }
  };
};

var options = {
  html_escape: false
};

exports.getArtistMids = function (name, callback) {
  var query = [{
    mid: null,
    name: name,
    type: "/music/artist"
  }];

  var cleanup = function (result) {
    if (result instanceof Array) {
      return result.map(function (value) {
        return value.mid;
      });
    }
  };

  var myCallback = callbackify(callback, cleanup);
  freebase.mqlread(query, options, myCallback);
};

exports.getTracksWithContributors = function (mids, callback) {
  var query = [{
    "mid|=": mids,
    "type": "/music/artist",
    "track_contributions": [{
      "track": {
        mid: null
      },
      limit: 9007199254740992
    }],
  }];

  var cleanup = function (result) {
    if (result instanceof Array) {
      var rv = result.map(function (value) {
        if (value.track_contributions instanceof Array) {
          return value.track_contributions.map(function (value) {
            if (value.track) {
              return value.track.mid;
            }
          });
        }
      });
      return [].concat.apply([], rv);
    }
  };
  var myCallback = callbackify(callback, cleanup);
  freebase.mqlread(query, options, myCallback);
};

exports.getTracksByArtists = function (mids, callback) {
  var query = [{
    mid: null,
    type: "/music/track",
    "artist|=": mids
  }];

  var myCallback = callbackify(callback);
  freebase.mqlread(query, options, myCallback);
};
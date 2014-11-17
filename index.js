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

var callbackify2 = function (callback) {
  return function (data) {
    if (!data) {
      callback(new Error("unknown error"));
    }
    if (data.result instanceof Array) {
      var result = data.result.map(function (value) {
        if (value.track_contributions instanceof Array) {
          return value.track_contributions.map(function (value) {
            if (value.track) {
              return value.track.mid;
            }
          });
        }
      });
      result = [].concat.apply([], result);
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

  var myCallback = callbackify(callback);
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

  var myCallback = callbackify2(callback);
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
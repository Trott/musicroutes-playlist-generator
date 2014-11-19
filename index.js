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

var grabMid = function (value) {
  return value.mid;
};

exports.getArtistMids = function (name, callback) {
  var query = [{
    mid: null,
    name: name,
    type: "/music/artist"
  }];

  var cleanup = function (result) {
    if (result instanceof Array) {
      return result.map(grabMid);
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
    "mid|=": mids,
    "type": "/music/artist",
    track: [{
      mid: null
    }]
  }];

  var cleanup = function (result) {
    if (result instanceof Array) {
      var rv = result.map(function (value) {
        if (value.track instanceof Array) {
          return value.track.map(grabMid);
        }
      });
      return [].concat.apply([], rv);      
    }
  };

  var myCallback = callbackify(callback, cleanup);
  freebase.mqlread(query, options, myCallback);
};

exports.getArtistsAndContributorsFromTracks = function (mids, callback) {
  var query = [{
    "mid|=": mids,
    "type": "/music/track",
    artist: [{
      mid: null
    }],
    contributions: [{
      mid: null,
      contributor: [{ mid: null }]
    }]
  }];

  var cleanup = function (result) {
    if (result instanceof Array) {
      var rv = result.map(function (value) {
        var artists = value.artist instanceof Array ? value.artist.map(grabMid) : [];
        var contributors = [];
        if (value.contributions instanceof Array) {
          value.contributions.forEach(function (value) {
            if (value.contributor instanceof Array) {
              value.contributor.forEach(function (value) {
                contributors.push(value.mid);
              });
            }
          });
        }
        return artists.concat(contributors);
      });
      return [].concat.apply([], rv);
    }
  };

  var myCallback = callbackify(callback, cleanup);
  freebase.mqlread(query, options, myCallback);
};
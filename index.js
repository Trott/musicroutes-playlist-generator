var freebase = require('mqlread');

var options = {
  html_escape: false
};

var grabMid = function (value) {
  return value.mid;
};

exports.getMids = function (name, type, callback) {
  var cleanup = function (err, data) {
    var rv;
    if (data && data.result instanceof Array) {
      rv = data.result.map(grabMid);
    }
    callback(err, rv);
  };

  var query = JSON.stringify([{
    mid: null,
    name: name,
    type: type
  }]);

  freebase.mqlread(query, options, cleanup);
};

exports.getTracksWithContributors = function (mids, callback) {
  var query = JSON.stringify([{
    'mid|=': mids,
    'type': '/music/artist',
    'track_contributions': [{
      'track': {
        mid: null
      },
      limit: 9007199254740992
    }],
  }]);

  var cleanup = function (err, data) {
    var rv = [];
    if (data && data.result instanceof Array) {
      data.result.forEach(function (value) {
        if (value.track_contributions instanceof Array) {
          value.track_contributions.forEach(function (value) {
            if (value.track) {
              rv.push(value.track.mid);
            }
          });
        }
      });
    }
    callback(err, rv);
  };
  freebase.mqlread(query, options, cleanup);
};

exports.getTracksByArtists = function (mids, callback) {
  var query = JSON.stringify([{
    'mid|=': mids,
    'type': '/music/artist',
    track: [{
      mid: null
    }]
  }]);

  var cleanup = function (err, data) {
    var rv;
    if (data && data.result instanceof Array) {
      rv = data.result.map(function (value) {
        if (value.track instanceof Array) {
          return value.track.map(grabMid);
        }
      });
      rv = [].concat.apply([], rv);
    }
    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};

exports.getArtistsAndContributorsFromTracks = function (mids, callback) {
  var query = JSON.stringify([{
    'mid|=': mids,
    'type': '/music/track',
    artist: [{
      mid: null
    }],
    contributions: [{
      mid: null,
      contributor: [{ mid: null }]
    }]
  }]);

  var cleanup = function (err, data) {
    var rv;
    if (data && data.result instanceof Array) {
      rv = data.result.map(function (value) {
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
      rv = [].concat.apply([], rv);
    }
    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};
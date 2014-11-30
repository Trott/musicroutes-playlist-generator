/* global -Promise */
var freebase = require('mqlread');
var Promise = require('promise');
var apikey = require('../.apikey');
var options = {
  html_escape: false,
  key: apikey.key
};

var limit = 9007199254740992;

var grabMid = function (value, prop) {
  if (prop) {
    return value[prop] ? value[prop].mid : undefined;
  }
  return value.mid;
};

var each = function (obj, prop, callback) {
  if (obj && obj[prop] instanceof Array) {
    return obj[prop].forEach(callback);
  }
};

exports.getMids = function (name, type) {
  var query = JSON.stringify([{
    mid: null,
    name: name,
    type: type
  }]);

  return new Promise(function (fulfill, reject) {
    freebase.mqlread(query, options, function (err, data) {
      if (err) {
        return reject(err);
      }
      var rv = [];
      each(data, 'result', function (value) {
        rv.push(grabMid(value));
      });
      fulfill(rv);
    });
  });
};

exports.getTracksWithContributors = function (mids, opts, callback) {
  var query = [{
    'mid|=': mids,
    type: '/music/artist',
    track_contributions: [{
      track: {
        mid: null,
      },
      limit: limit
    }],
  }];

  if (opts.subquery) {
    for (var key in opts.subquery) {
      // shallow copy, we're about to throw it away
      query[0].track_contributions[0].track[key] = opts.subquery[key];
    }
  }

  query = JSON.stringify(query);

  var cleanup = function (err, data) {
    var rv = [];
    each(data, 'result',
      function (value) {
        each(value, 'track_contributions', function (value) { 
          rv.push(grabMid(value, 'track')); 
        });
      }
    );
    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};

exports.getTracksByArtists = function (mids, opts, callback) {
  var query = JSON.stringify([{
    'mid|=': mids,
    type: '/music/artist',
    track: [{
      mid: null,
      limit: limit
    }]
  }]);

  var cleanup = function (err, data) {
    var rv = [];
    each(data, 'result', 
      function (value) {
        each(value, 'track', function (value) {
          rv.push(grabMid(value));
        });
      }
    );
    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};

exports.getArtistsAndContributorsFromTracks = function (mids, callback) {
  var query = JSON.stringify([{
    'mid|=': mids,
    type: '/music/track',
    artist: [{
      mid: null,
      limit: limit
    }],
    contributions: [{
      mid: null,
      contributor: [{ 
        mid: null 
      }],
      limit: limit,
      optional: 'optional'
    }]
  }]);

  var cleanup = function (err, data) {
    var rv = [];
    each(data, 'result', function (value) {
      each(value, 'artist', function (value) {
        rv.push(grabMid(value));
      });
      each(value, 'contributions', function (value) {
        each(value, 'contributor', function (value) {
          rv.push(grabMid(value));
        });
      });
    });

    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};

exports.getArtistDetails = function (mid, callback) {
  var query = JSON.stringify({
    mid: mid,
    name: null,
    type: '/music/artist'
  });

  var cleanup = function (err, data) {
    data = data && data.result;
    callback(err, data);
  };

  freebase.mqlread(query, options, cleanup);
};

exports.getTrackDetails = function (mid, callback) {
  var query = JSON.stringify({
    mid: mid,
    type: '/music/track',
    name: null,
    artist: [{
      mid: null,
      name: null
    }],
    tracks: [{
      release: {
        name: null
      },
    }]
  });

  var cleanup = function (err, data) {
    var rv;
    if (data && data.result) {
      rv = {};
      rv.name = data.result.name;
      rv.artists = data.result.artist;
      rv.releases = [];
      each(data.result, 'tracks', function (value) {
        rv.releases.push(value.release);
      });
    }
    callback(err, rv);
  };

  freebase.mqlread(query, options, cleanup);
};
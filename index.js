var freebase = require('mqlread');

var limit = 9007199254740992;

var options = {
  html_escape: false
};

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

exports.getMids = function (name, type, callback) {
  var cleanup = function (err, data) {
    var rv = [];
    each(data, 'result', function (value) {
      rv.push(grabMid(value));
    });

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
    type: '/music/artist',
    track_contributions: [{
      track: {
        mid: null,
      },
      limit: limit
    }],
  }]);

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

exports.getTracksByArtists = function (mids, callback) {
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
      limit: limit
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
      name: null,
    }],
    releases: [{
      name: null,
    }]
  });

  var cleanup = function (err, data) {
    data = data && data.result;
    callback(err, data);
  };

  freebase.mqlread(query, options, cleanup);
};
/* global -Promise */
var freebase = require('mqlread');
var Promise = require('promise');
var apikey = require('../.apikey');
var _ = require('lodash');

var options = {
  html_escape: false,
  key: apikey.key
};

var limit = 9007199254740992;

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
      fulfill(_.map(data.result, 'mid'));
    });
  });
};

exports.getTracksWithContributors = function (mids, opts) {
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

  _.assign(query[0].track_contributions[0].track, opts.subquery);

  query = JSON.stringify(query);

  return new Promise(function (fulfill, reject) {
    var cleanup = function (err, data) {
      if (err) {
        return reject(err);
      }
      var rv = [];
      _.forEach(data.result, function (value) {
        _.forEach(value.track_contributions, function (value) {
          rv.push(_.result(value.track, 'mid'));
        });
      });
      fulfill(rv);
    };

    freebase.mqlread(query, options, cleanup);
  });
};

exports.getTracksByArtists = function (mids) {
  var query = JSON.stringify([{
    'mid|=': mids,
    type: '/music/artist',
    track: [{
      mid: null,
      limit: limit
    }]
  }]);

  return new Promise(function (fulfill, reject) {
    var cleanup = function (err, data) {
      if (err) {
        return reject(err);
      }
      var rv = [];
      _.forEach(data.result, function (value) {
        _.forEach(value.track, function (value) {
          rv.push(_.result(value, 'mid'));
        });
      });
      fulfill(rv);
    };

    freebase.mqlread(query, options, cleanup);
  });
};

exports.getArtistsAndContributorsFromTracks = function (mids) {
  var query = JSON.stringify([{
    'mid|=': mids,
    type: '/music/track',
    artist: [{
      mid: null,
      limit: limit
    }],
    contributions: [{
      mid: null,
      role: [{
        name: null
      }],
      contributor: {
        mid: null
      },
      limit: limit,
      optional: 'optional'
    }]
  }]);

  return new Promise(function (fulfill, reject) {
    var cleanup = function (err, data) {
      if (err) {
        return reject(err);
      }
      var rv = {artists: [], contributors: []};
      _.forEach(data.result, function (value) {
        _.forEach(value.artist, function (value) {
          rv.artists.push({
            mid: _.result(value, 'mid')
          });
        });

        rv.contributors = _.map(value.contributions, function (value) {
          return {
            mid: _.result(value.contributor, 'mid'),
            roles: _.result(value, 'role')
          };
        });
      });

      fulfill(rv);
    };

    freebase.mqlread(query, options, cleanup);
  });
};

exports.getArtistDetails = function (mid) {
  var query = JSON.stringify({
    mid: mid,
    name: null,
    type: '/music/artist'
  });

  return new Promise(function (fulfill, reject) {
    var cleanup = function (err, data) {
      if (err) {
        return reject(err);
      }
      fulfill(_.result(data, 'result'));
    };

    freebase.mqlread(query, options, cleanup);
  });
};

exports.getTrackDetails = function (mid) {
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
        mid: null,
        name: null
      },
    }]
  });

  return new Promise(function (fulfill, reject) {
    var cleanup = function (err, data) {
      if (err) {
        return reject(err);
      }
      var rv = null;
      if (data && data.result) {
        rv = {};
        rv.mid = mid;
        rv.name = data.result.name;
        rv.artists = data.result.artist;
        rv.releases = [];
        _.forEach(data.result.tracks, function (value) {
          rv.releases.push(value.release);
        });
      }
      fulfill(rv);
    };

    freebase.mqlread(query, options, cleanup);
  });
};

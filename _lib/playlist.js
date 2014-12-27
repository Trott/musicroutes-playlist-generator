/* global -Promise */
var routes = require('./routes.js');
var utils = require('./utils.js');
var Promise = require('promise');
var _ = require('lodash');

var state = {
	seenIndividuals: [],
	seenTracks: [],
	seenArtists: [],
	sourceIndividual: {},
	atDeadEnd: false,
	foundSomeoneElse: false,
  playlist: []
};

var clear = function () {
	state.seenIndividuals = [];
	state.seenTracks = [];
	state.seenArtists = [];
	state.sourceIndividual = {};
  state.playlist = [];
};

var fetchConnectorDetails = function (index) {
  // Get properly rendered name if we don't yet have one for the previous connector.
  
  // If this is the first connection and the user entered 'janelle monae'
  // we want to render it as 'Janelle Monae'. Ditto for missing umlauts and whatnot.
  // So just pull from the track details if it's there.

  var connector = state.playlist[index].connectorToNext;
  if (! connector.name) {
    var matching = _.where(state.playlist[index].artists, {mid: connector.mid});
    if (matching[0]) {
      connector.name = matching[0].name;
      state.playlist[index].connectorToNext = connector;
    }
  }

  // If they are a contributor and not the artist, we have to go out and fetch their details.
  // This will happen on the first track if the user searches for, say, 'berry oakley'.
  if (! connector.name) {
    return routes.getArtistDetails(connector.mid)
    .then(function (value) {
      connector.name = value.name;
      state.playlist[index].connectorToNext = connector;
      return Promise.resolve(state.playlist[index]);
    });
  }
  
  return new Promise(function (resolve) {
    process.nextTick(function () { resolve(state.playlist[index]); });
  });
};

var setSource = function (source) {
  clear();
  state.sourceIndividual.mid = source;
  state.playlist = [{connectorToNext: {mid: source}}];
  return fetchConnectorDetails(0);
};

var setTrackDetails = function (options, details) {
  if (! _.isPlainObject(details)) {
    details = {};
  }

  // Use specified options, else append to end of playlist.
  var index = options.index || state.playlist.length;
  state.playlist[index] = details;
  if (options.release) {
    state.playlist[index].release = _.find(state.playlist[index].releases, options.release);
  } else {
    state.playlist[index].release = _.sample(state.playlist[index].releases) || '';
  }
  return Promise.resolve(state.playlist[index]);
};

var fetchNewTrack = function () {
	state.atDeadEnd = false;

	var getContributors = function (trackMid) {
		return routes.getArtistsAndContributorsFromTracks([trackMid]);
	};

	var pickContributor = function (folks) {
		var contributors = utils.mergeArtistsAndContributors(folks.artists, folks.contributors);
		var notSeen = _.difference(contributors, state.seenIndividuals);
		var contributor = utils.pickContributor(notSeen, contributors, state.sourceIndividual.mid);

		var allFolksDetails = folks.contributors.concat(folks.artists); // Do contributors first because they have roles

		state.sourceIndividual = _.find(allFolksDetails, {mid: contributor});

		return contributor;
	};

	state.foundSomeoneElse = false;

	var trackPicked = false;

	var processTracks = function (mid) {
		// If a previous step picked a track, just pass on through.
		if (trackPicked) {
			return Promise.resolve(mid);
		}

		trackPicked = true;

		var promise = routes.getTrackDetails(mid)
			.then(setTrackDetails.bind(null, {}))
			.then(function (trackDetails) { 
        var currentArtists = _.pluck(trackDetails.artists, 'mid');
				state.seenArtists = state.seenArtists.concat(_.difference(currentArtists, state.seenArtists));
        return trackDetails.mid;
			})
			.then(getContributors)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(function (details) {
        details.roles = state.sourceIndividual.roles;
        _.last(state.playlist).connectorToNext = details;
        return state.playlist;
      });

		return promise;
	};

	state.seenIndividuals.push(state.sourceIndividual.mid);

	var promise = utils.tracksByUnseenArtists(state)
		.then(processTracks, utils.tracksWithContributor.bind(undefined, state))
		.then(processTracks, utils.tracksWithArtist.bind(undefined, state))
		.then(processTracks, utils.giveUpIfNoTracks.bind(undefined, state));

	return promise;
};

var serialize = function () {
  var bareBones = _.map(state.playlist, function (value) {
    var rv = {};
    rv.connectorToNext = _.result(value.connectorToNext, 'mid');
    if (value.mid) {
      rv.mid = value.mid;
    }
    if (value.release) {
      rv.release = _.result(value.release, 'mid');
    }
    return rv;
  });

  return JSON.stringify(_.first(bareBones, 11));
};

var deserialize = function (data) {
  var playlist;
  try {
    playlist = JSON.parse(data);
  } catch (e) {
    return Promise.reject(e);
  }

  _.map(playlist, function (value) {
    value.connectorToNext = {
      mid: value.connectorToNext
    };
    if (value.release) {
      value.release = {
        mid: value.release
      };
    }
  });

  return Promise.resolve(playlist);
};

var hydrate = function (data) {
  return Promise.all(
    _.map(data, function (value, index) {
      state.playlist[index] = state.playlist[index] || {};
      return Promise.resolve()
      .then(function () {
        if (value.mid) {
          return routes.getTrackDetails(value.mid)
            .then(setTrackDetails.bind(null, {release: value.release, index: index}));
        }
        return Promise.resolve(state.playlist[index]);
      })
      .then(function () {
        if (value.connectorToNext) {
          state.playlist[index].connectorToNext = value.connectorToNext;
          return fetchConnectorDetails(index);
        }
        return Promise.resolve(state.playlist[index]);
      });
    })
  );
};

module.exports = {
  clear: clear,
  setSource: setSource,
  fetchNewTrack: fetchNewTrack,
  serialize: serialize,
  deserialize: deserialize,
  fetchConnectorDetails: fetchConnectorDetails,
  setTrackDetails: setTrackDetails,
  hydrate: hydrate
};
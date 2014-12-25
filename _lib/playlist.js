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
	trackDetails: {},
	atDeadEnd: false,
	foundSomeoneElse: false,
	track: undefined,
  playlist: []
};

var clear = function () {
	state.seenIndividuals = [];
	state.seenTracks = [];
	state.seenArtists = [];
	state.sourceIndividual = {};
  state.playlist = [];
};

var setSource = function (source) {
  clear();
	state.sourceIndividual.mid = source;
  state.playlist = [{connectorToNext: {mid: source}}];
};

var fetchConnectorDetails = function () {
  // Get properly rendered name if we don't yet have one for the previous connector.
  
  // If this is the first connection and the user entered 'janelle monae'
  // we want to render it as 'Janelle Monae'. Ditto for missing umlauts and whatnot.
  // So just pull from the track details if it's there.

  var prevIndex = state.playlist.length - 2;
  var connector = state.playlist[prevIndex].connectorToNext;
  if (! connector.name) {
    var matching = _.where(state.playlist[prevIndex].artists, {mid: connector.mid});
    if (matching[0]) {
      connector.name = matching[0].name;
      state.playlist[prevIndex].connectorToNext = connector;
    }
  }

  // If they are a contributor and not the artist, we have to go out and fetch their details.
  // This will happen on the first track if the user searches for, say, 'berry oakley'.
  if (! connector.name) {
    return routes.getArtistDetails(connector.mid)
    .then(function (value) {
      connector.name = value.name;
      state.playlist[prevIndex].connectorToNext = connector;
      return Promise.resolve(connector);
    });
  }
  
  return new Promise(function (resolve) {
    process.nextTick(function () { resolve(connector); });
  });
};

var setTrackDetails = function (details) {
  if (! _.isPlainObject(details)) {
    details = {};
  }
  var index = state.playlist.push(details) - 1;
  state.playlist[index].release = _.sample(state.playlist[index].releases) || '';
  state.playlist[index].mid = state.track;
  return state.playlist[index];
};

var fetchNewTrack = function (domElem, $) {
	var resultsElem = $(domElem);
	var appendToResultsElem = function (elem) {
		resultsElem.append(elem);
	};

	state.atDeadEnd = false;

	var renderTrackDetails = function () {
    var index = state.playlist.length - 1;
		var p = $('<p>').attr('class', 'track-details');
		p.append(utils.trackAnchor($, state.playlist[index]));
		p.append($('<br>'));
		p.append(utils.artistAnchors($, state.playlist[index].artists));
		p.append($('<br>'));
		p.append(utils.releaseAnchor($, state.playlist[index].release));
		return p;
	};

	var getContributors = function () {
		return routes.getArtistsAndContributorsFromTracks([state.track]);
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

	var processTracks = function () {
		// If a previous step picked a track, just pass on through.
		if (trackPicked) {
			return Promise.resolve();
		}

		trackPicked = true;

		var promise = routes.getTrackDetails(state.track)
			.then(setTrackDetails)
			.then(function (trackDetails) { return _.pluck(trackDetails.artists, 'mid');})
			.then(function (currentArtists) { 
				state.seenArtists = state.seenArtists.concat(_.difference(currentArtists, state.seenArtists));
			})
			.then(fetchConnectorDetails)
			.then(getContributors)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(function (details) {
        var index = state.playlist.length - 1;
        state.playlist[index].connectorToNext = details;
        return utils.renderConnector($, details, state);
      })
			.then(appendToResultsElem)
			.then(renderTrackDetails)
			.then(appendToResultsElem)
			.then(function () { return _.last(state.playlist); })
			.then(utils.searchForVideoFromTrackDetails)
			.then(utils.extractVideoId)
			.then(utils.getVideoEmbedCode)
			.then(utils.wrapVideo)
			.then(appendToResultsElem);

		return promise;
	};

	state.seenIndividuals.push(state.sourceIndividual.mid);

	var promise = utils.tracksByUnseenArtists(state)
		.then(processTracks, utils.tracksWithContributor.bind(undefined, state))
		.then(processTracks, utils.tracksWithArtist.bind(undefined, state))
		.then(processTracks, utils.giveUpIfNoTracks.bind(undefined, state, $));

	return promise;
};

var getSerialized = function () {
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

var unserialize = function (data) {
  try {
    state.playlist = JSON.parse(data);
  } catch (e) {
    return Promise.reject(e);
  }

  _.map(state.playlist, function (value) {
    value.connectorToNext = {
      mid: value.connectorToNext
    };
    if (value.release) {
      value.release = {
        mid: value.release
      };
    }
  });

  return Promise.resolve(state.playlist);
};

var length = function () {
  // First item in playlist is just a connector, not a track, so subtract 1.
  return state.playlist.length - 1;
};

module.exports = {
  clear: clear,
  setSource: setSource,
  fetchNewTrack: fetchNewTrack,
  getSerialized: getSerialized,
  unserialize: unserialize,
  fetchConnectorDetails: fetchConnectorDetails,
  setTrackDetails: setTrackDetails,
  length: length
};
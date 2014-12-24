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

var track = function (domElem, $) {
	var resultsElem = $(domElem);
	var appendToResultsElem = function (elem) {
		resultsElem.append(elem);
	};

	state.atDeadEnd = false;

	var renderTrackDetails = function () {
		var p = $('<p>').attr('class', 'track-details');
		p.append(utils.trackAnchor($, state.trackDetails));
		p.append($('<br>'));
		p.append(utils.artistAnchors($, state.trackDetails.artists));
		p.append($('<br>'));
		p.append(utils.releaseAnchor($, state.trackDetails.release));
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
			.then(utils.setTrackDetails.bind(undefined, state))
			.then(function (trackDetails) { return _.pluck(trackDetails.artists, 'mid');})
			.then(function (currentArtists) { 
				state.seenArtists = state.seenArtists.concat(_.difference(currentArtists, state.seenArtists));
				return state;
			})
			.then(utils.formatPreviousConnectorName)
			.then(getContributors)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(function (details) {
        state.connectorToNext = details;
        return utils.renderConnector($, details, state);
      })
			.then(appendToResultsElem)
			.then(renderTrackDetails)
			.then(appendToResultsElem)
			.then(function () {
        state.playlist.push({
          mid: state.trackDetails.mid,
          release: state.trackDetails.release,
          connectorToNext: state.connectorToNext
        });
        return state.trackDetails; })
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
  });

  return Promise.resolve(state.playlist);
};

module.exports = {
  clear: clear,
  setSource: setSource,
  track: track,
  getSerialized: getSerialized,
  unserialize: unserialize
};
/* global -Promise */
var routes = require('./routes.js');
var utils = require('./utils.js');
var Promise = require('promise');
var _ = require('lodash');

var state = {
	seenIndividuals: [],
	seenTracks: [],
	seenArtists: [],
	previousConnector: {},
	sourceIndividual: {},
	trackDetails: {},
	atDeadEnd: false,
	foundSomeoneElse: false,
	track: undefined
};

exports.clear = function () {
	state.seenIndividuals = [];
	state.seenTracks = [];
	state.seenArtists = [];
	state.sourceIndividual = {};
	state.previousConnector = {};
};

exports.setSource = function (source) {
	state.sourceIndividual.mid = source;
};

exports.track = function (domElem, $) {
	if (! state.previousConnector.mid) {
		state.previousConnector = state.sourceIndividual;
	}

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
			.then(function (details) { return utils.renderConnector($, details, state); })
			.then(appendToResultsElem)
			.then(renderTrackDetails)
			.then(appendToResultsElem)
			.then(function () { return state.trackDetails; })
			.then(utils.searchForVideoFromTrackDetails)
			.then(utils.extractVideoId)
			.then(utils.getVideoEmbedCode)
			.then(utils.wrapVideo)
			.then(appendToResultsElem);

		return promise;
	};

	// Give up if we haven't found anything we can use yet
	var giveUpIfNoTracks = function (err) {
		if (err) {
			return Promise.reject(err);
		}
		state.atDeadEnd = true;
		var p = $('<p>')
			.text('Playlist is at a dead end with ')
			.append(utils.anchorFromMid($, state.previousConnector.mid, state.previousConnector.name))
			.append('.');
		var msg = $('<paper-shadow>')
			.addClass('error')
			.append(p);
		msg.deadEnd = true;
		return Promise.reject(msg);
	};

	state.seenIndividuals.push(state.sourceIndividual.mid);

	var promise = utils.tracksByUnseenArtists(state)
		.then(processTracks, utils.tracksWithContributor.bind(undefined, state))
		.then(processTracks, utils.tracksWithArtist.bind(undefined, state))
		.then(processTracks, giveUpIfNoTracks);

	return promise;
};
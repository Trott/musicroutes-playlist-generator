/*global document*/
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
	trackDetails: {}
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
	var individual = state.sourceIndividual.mid;
	if (! state.previousConnector.mid) {
		state.previousConnector = state.sourceIndividual;
	}

	var resultsElem = $(domElem);
	var appendToResultsElem = function (elem) {
		resultsElem.append(elem);
	};

	var deadEnd = false;

	var track;

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
		return routes.getArtistsAndContributorsFromTracks([track]);
	};

	var pickContributor = function (folks) {
		var contributors = utils.mergeArtistsAndContributors(folks.artists, folks.contributors);
		var notSeen = _.difference(contributors, state.seenIndividuals);
		var contributor = utils.pickContributor(notSeen, contributors, state.sourceIndividual.mid);

		state.sourceIndividual = _.find(folks.contributors, {mid: contributor});
		if (!state.sourceIndividual) {
			state.sourceIndividual = _.find(folks.artists, {mid: contributor});
		}

		return contributor;
	};

	var renderNameOrMid = function (details) {
		return utils.anchorFromMid($, details.mid, details.name);
	};

	var renderConnector = function (details) {
		var previous = $('<b>').append(renderNameOrMid(state.previousConnector));
		var current;
		
		var p = $('<p>');

		p.append(previous);

		if (state.previousConnector.mid !== details.mid) {
			current = $('<b>').append(renderNameOrMid(details));
			p.append(' recorded with ').append(current);
			if (state.sourceIndividual.roles) {
				p.append(document.createTextNode(' (' + _.pluck(state.sourceIndividual.roles, 'name').join(', ') + ')'));
			}
			p.append(' on:');
		} else {
			p.append(' appeared on:');
		}

		state.previousConnector = details;
		return p;
	};

	var foundSomeoneElse;

	var pickATrack = function (tracks) {
		deadEnd = false;
		var notSeenTracks = _.difference(tracks, state.seenTracks);

		// Promise returns nothing if a dead end, a track if a good one is found, else rejects
		//    which basically means "try again"
		if (notSeenTracks.length === 0) {
			deadEnd = true;
			return Promise.reject();
		}

		var validatePathOutFromTrack = function (folks) {
			var myArtists = _.pluck(folks.artists, 'mid'); 
			var myContributors = _.pluck(folks.contributors, 'mid');
			folks = _.union(myArtists, myContributors);
			var contributorPool = _.difference(folks, [individual]);
			// Only accept this track if there's someone else associated with it...
			// ...unless this is the very first track in which case, pick anything and
			// get it in front of the user pronto.				
			foundSomeoneElse = (contributorPool.length > 0 || state.seenTracks.length === 1);

			return Promise.resolve();
		};

		var promiseUntil = function(condition, action) {
  		var loop = function() {
      	if (condition()) {
					return Promise.resolve();
				}

      	return action().then(loop).catch(Promise.reject);
  		};

	    // var promise = process.nextTick(loop);

	    return loop();
		};

		return promiseUntil(
			function() { return foundSomeoneElse || deadEnd; },
			function() { 
				track = _.sample(notSeenTracks);
				if (!track) {
					deadEnd = true;
					return Promise.reject();
				}
				state.seenTracks.push(track);
				notSeenTracks = _.pull(notSeenTracks, track);
				return routes.getArtistsAndContributorsFromTracks([track]).then(validatePathOutFromTrack);
			}
		);
	};

	var trackPicked = false;

	var processTracks = function () {
		// If a previous step picked a track, just pass on through.
		if (trackPicked) {
			return Promise.resolve();
		}

		trackPicked = true;
		var promise = routes.getTrackDetails(track)
			.then(function (details) {
				state.trackDetails = details || {};
				state.trackDetails.mid = track;
				state.trackDetails.release = _.sample(state.trackDetails.releases) || '';
				return state.trackDetails;
			})
			.then(function (trackDetails) { return _.pluck(trackDetails.artists, 'mid');})
			.then(function (currentArtists) { 
				state.seenArtists = state.seenArtists.concat(_.difference(currentArtists, state.seenArtists));
				return state;
			})
			.then(utils.formatPreviousConnectorName)
			.then(getContributors)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(renderConnector)
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

	var tracksByUnseenArtists	= function () {
		var promise;

		var optionsNewArtistsOnly = {subquery: {
			artist: [{
				'mid|=': state.seenArtists,
				optional: 'forbidden'
			}]
		}};

		if (state.seenArtists.length === 0) {
 			// If this is the first track, get one by this artist if we can.
 			promise = routes.getTracksByArtists([individual]);
 		}  else {
			// Otherwise, get one by an artist we haven't seen yet
			promise = routes.getTracksWithContributors([individual], optionsNewArtistsOnly);
		}

		return promise.then(pickATrack);
	};

	// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
	var tracksWithContributor =	function (err) {
		if (err) {
			return Promise.reject(err);
		}
		return routes.getTracksWithContributors([individual], {}).then(pickATrack);
	};

	// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
	var tracksWithArtist = function (err) {
		if (err) {
			return Promise.reject(err);
		}
		return routes.getTracksByArtists([individual]).then(pickATrack);
	};

	// Give up if we haven't found anything we can use yet
	var giveUpIfNoTracks = function (err) {
		if (err) {
			return Promise.reject(err);
		}
		deadEnd = true;
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

	var promise = tracksByUnseenArtists()
		.then(processTracks, tracksWithContributor)
		.then(processTracks, tracksWithContributor)
		.then(processTracks, tracksWithArtist)
		.then(processTracks, giveUpIfNoTracks);

	return promise;
};
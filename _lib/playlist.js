/*global document*/
/* global -Promise */
var routes = require('./routes.js');
var utils = require('./utils.js');
var Promise = require('promise');
var _ = require('lodash');

var seenIndividuals = [];
var seenTracks = [];
var seenArtists = [];

var sourceIndividual;
var sourceIndividualRole;
var renderedTrackDetails;

var previousConnector;
var notSeenTracks;

exports.clear = function () {
	seenIndividuals = [];
	seenTracks = [];
	seenArtists = [];
	sourceIndividual = null;
	previousConnector = null;
};

exports.setSource = function (source) {
	sourceIndividual = source;
};

exports.track = function (domElem, $) {
	var individual = sourceIndividual;
	previousConnector = previousConnector || {mid: sourceIndividual};

	var resultsElem = $(domElem);

	var deadEnd = false;

	var trackDetails;
	var track;

	var addToSeenArtists = function () {
		return new Promise(function (fulfill, reject) {
			if (!trackDetails) {
				return reject(Error('No details for ' + track));
			}

			var theseArtistMids = _.map(trackDetails.artists, 'mid');
			seenArtists = seenArtists.concat(_.difference(theseArtistMids, seenArtists));
			fulfill();
		});
	};

	var renderTrackDetails = function () {
		var p = $('<p>').attr('class', 'track-details');

		if (trackDetails.name) {
			p.append(utils.anchorFromMid($, track, '"' + trackDetails.name + '"'));
		} else {
			p.append(utils.anchorFromMid($, track));
		}

		p.append($('<br>'));

		var needsAmpersand = false;
		_.forEach(trackDetails.artists, function (value) {
			if (needsAmpersand) {
				p.append(document.createTextNode(' & '));
			}
			if (value.name) {
				p.append(utils.anchorFromMid($, value.mid, value.name));
			} else {
				p.append(utils.anchorFromMid($, value.mid));
			}
			needsAmpersand = true;
		});

		p.append($('<br>'));

		if (trackDetails.release.name) {
			p.append($('<i>').append(utils.anchorFromMid($, trackDetails.release.mid, trackDetails.release.name)));
		} else {
			if (trackDetails.release.mid) {
				p.append(utils.anchorFromMid($, trackDetails.release.mid));
			}
		}

		return p;
	};

	var getContributors = function () {
		return routes.getArtistsAndContributorsFromTracks([track]);
	};

	var previousConnectorDetails = function () {
		// Get properly rendered name if we don't yet have one for the previous connector.
		// Basically, if this is the first connection and the user entered 'janelle monae'
		// we want to render it as 'Janelle Monae'. Ditto for missing umlauts and whatnot.
		// So just pull from trackDetails if it's there.

		if (! previousConnector.name) {
			var matching = _.where(trackDetails.artists, {mid: previousConnector.mid});
			if (matching[0]) {
				previousConnector.name = matching[0].name;
			}
		}

		// If they are a contributor and not the artist, we have to go out and fetch their details.
		// This will happen on the first track if the user searches for, say, 'berry oakley'.
		if (! previousConnector.name) {
			return routes.getArtistDetails(previousConnector.mid)
			.then(function (value) {previousConnector.name = value.name;});
		}
		return previousConnector.name;
	};

	var pickContributor = function (folks) {
		var myArtists = _.pluck(folks.artists, 'mid'); 
		var myContributors = _.pluck(folks.contributors, 'mid');
		var contributors = _.union(myArtists, myContributors);
		return new Promise(function (fulfill, reject) {
			var contributor;
			var notSeen = _.difference(contributors, seenIndividuals);
			if (notSeen.length > 0) {
				contributor = _.sample(notSeen);
				seenIndividuals.push(contributor);
			} else {
				contributor = _.sample(_.without(contributors, sourceIndividual));
			}

			if (! contributor) {
				contributor = contributors[0];
			}

			sourceIndividual = contributor;
			sourceIndividualRole = _.reduce(folks.contributors, function (rv, value) {
				if (value.mid === sourceIndividual) {
					return value.roles;
				} else {
					return rv;
				}
			}, []);
			return contributor ? fulfill(contributor) : reject(Error('No contributors for track'));
		});
	};

	var renderNameOrMid = function (details) {
		if (details.name) {
			return utils.anchorFromMid($, details.mid, details.name);
		}
		if (details.mid) {
			return utils.anchorFromMid($, details.mid);
		}
		return '';
	};

	var renderConnector = function (details) {
		var previous = $('<b>').append(renderNameOrMid(previousConnector));
		var current;
		
		var p = $('<p>');

		p.append(previous);

		if (previousConnector.mid !== details.mid) {
			current = $('<b>').append(renderNameOrMid(details));
			p.append(' recorded with ').append(current);
			if (sourceIndividualRole.length) {
				p.append(document.createTextNode(' (' + _.pluck(sourceIndividualRole, 'name').join(', ') + ')'));
			}
			p.append(' on:');
		} else {
			p.append(' appeared on:');
		}

		previousConnector = details;
		return p;
	};

	var foundSomeoneElse;

	var pickATrack = function (tracks) {
		deadEnd = false;
		notSeenTracks = _.difference(tracks, seenTracks);

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
			foundSomeoneElse = (contributorPool.length > 0 || seenTracks.length === 1);

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
				seenTracks.push(track);
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
				trackDetails = details;
				if (trackDetails) {
					trackDetails.release = trackDetails.releases ? _.sample(trackDetails.releases) : '';
				}
			})
			.then(addToSeenArtists)
			.then(renderTrackDetails)
			.then(function (details) { renderedTrackDetails = details; })
			.then(previousConnectorDetails)
			.then(getContributors)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(renderConnector)
			.then(function (connector) { resultsElem.append(connector); resultsElem.append(renderedTrackDetails); })
			.then(function () { return trackDetails; })
			.then(utils.searchForVideoFromTrackDetails)
			.then(utils.extractVideoId)
			.then(utils.getVideoEmbedCode)
			.then(utils.wrapVideo)
			.then(function (embedCode) { resultsElem.append($(embedCode)); });

		return promise;
	};

	var optionsNewArtistsOnly = {subquery: {
		artist: [{
			'mid|=': seenArtists,
			optional: 'forbidden'
		}]
	}};

	var tracksByUnseenArtists	= function () {
		return new Promise(function (fulfill, reject) {
			var promise;
			if (seenArtists.length === 0) {
	 			// If this is the first track, get one by this artist if we can.
	 			promise = routes.getTracksByArtists([individual]);
	 		}  else {
				// Otherwise, get one by an artist we haven't seen yet
				promise = routes.getTracksWithContributors([individual], optionsNewArtistsOnly);
			}

			return promise.then(pickATrack).then(fulfill, reject);
		});
	};

	// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
	var tracksWithContributor =	function (err) {
		if (err) {
			return Promise.reject(err);
		}
		return routes.getTracksWithContributors([individual], {}).then(pickATrack).then(Promise.resolve, Promise.reject);
	};

	// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
	var tracksWithArtist = function (err) {
		if (err) {
			return Promise.reject(err);
		}
		return routes.getTracksByArtists([individual]).then(pickATrack).then(Promise.resolve, Promise.reject);
	};

	// Give up if we haven't found anything we can use yet
	var giveUpIfNoTracks = function (err) {
		if (err) {
			return Promise.reject(err);
		}
		deadEnd = true;
		var p = $('<p>')
			.text('Playlist is at a dead end with ')
			.append(utils.anchorFromMid($, previousConnector.mid, previousConnector.name))
			.append('.');
		var msg = $('<paper-shadow>')
			.addClass('error')
			.append(p);
		msg.deadEnd = true;
		return Promise.reject(msg);
	};

	seenIndividuals.push(sourceIndividual);

	var promise = tracksByUnseenArtists()
		.then(processTracks, tracksWithContributor)
		.then(processTracks, tracksWithContributor)
		.then(processTracks, tracksWithArtist)
		.then(processTracks, giveUpIfNoTracks);

	return promise;
};
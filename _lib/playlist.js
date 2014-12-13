/*global document*/
/* global -Promise */
var routes = require('./routes.js');
var videos = require('./videos.js');
var Promise = require('promise');
var async = require('async');
var _ = require('lodash');

var seenIndividuals = [];
var seenTracks = [];
var seenArtists = [];

var sourceIndividual;
var sourceIndividualRole;
var renderedTrackDetails;

var previousConnector;

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

exports.track = function (domElem, $, callback) {
	var individual = sourceIndividual;
	previousConnector = previousConnector || {mid: sourceIndividual};

	var resultsElem = $(domElem);

	var deadEnd = false;

	var anchorFromMid = function (mid, text) {
		text = text || mid;
		return $('<a>')
			.attr('href', 'http://freebase.com' + mid)
			.attr('target', '_blank')
			.text(text);
	};

	var processTracks = function (tracks) {
		var track;
		var trackDetails;
		var notSeenTracks = _.difference(tracks, seenTracks);

		if (notSeenTracks.length === 0) {
			nextIndex = nextIndex + 1;
			next[nextIndex]();
			return;
		}

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
				p.append(anchorFromMid(track, '"' + trackDetails.name + '"'));
			} else {
				p.append(anchorFromMid(track));
			}

			p.append($('<br>'));

			var needsAmpersand = false;
			_.forEach(trackDetails.artists, function (value) {
				if (needsAmpersand) {
					p.append(document.createTextNode(' & '));
				}
				if (value.name) {
					p.append(anchorFromMid(value.mid, value.name));
				} else {
					p.append(anchorFromMid(value.mid));
				}
				needsAmpersand = true;
			});

			p.append($('<br>'));

			if (trackDetails.release.name) {
				p.append($('<i>').append(anchorFromMid(trackDetails.release.mid, trackDetails.release.name)));
			} else {
				if (trackDetails.release.mid) {
					p.append(anchorFromMid(trackDetails.release.mid));
				}
			}

			return p;
		};

		var searchForVideo = function () {
			var q = '';
			if (trackDetails.name) {
				q = '"' + trackDetails.name + '" ';
			}
			q = q + _.reduce(trackDetails.artists, function (rv, artist) { return artist.name ? rv + '"' + artist.name + '" ' : rv;}, '');
			if (trackDetails.release.name) {
				q = q + '"' + trackDetails.release.name + '"';
			}

			return videos.search(q);
		};

		var extractVideoId = function (data) {
			return _.result(data.items[0], 'videoId');
		};

		var getVideoEmbedCode = function (videoId) {
			return videoId && videos.embed(videoId);
		};

		var embedVideoInDom = function (data) {
			if (data && data.items && data.items[0] && data.items[0].embedHtml) {
				var outer = $('<div class="video-outer-wrapper">');
				var inner = $('<div class="video-inner-wrapper">');
				// Yes, we're trusting YouTube's API not to p0wn us.
				inner.html(data.items[0].embedHtml);
				resultsElem.append(outer.append(inner));
			}
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
				return anchorFromMid(details.mid, details.name);
			}
			if (details.mid) {
				return anchorFromMid(details.mid);
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

		var finished = function () {
			callback();
		};

		var foundSomeoneElse;
		deadEnd = false;

		var pickATrack = function () {
			return new Promise(function (fulfill, reject) {
				async.until(
					function () {
						return foundSomeoneElse || deadEnd;
					},
					function (next) {
						if (notSeenTracks.length === 0) {
							deadEnd = true;
							var err = new Error('Dead end! Bummer. To try again, use the Start Over button above the playlist!');
							err.deadEnd = true;
							return reject(err);
						}
						track = _.sample(notSeenTracks);
						seenTracks.push(track);
						notSeenTracks = _.pull(notSeenTracks, track);

						var validateTrack = function (folks) {
							var myArtists = _.pluck(folks.artists, 'mid'); 
							var myContributors = _.pluck(folks.contributors, 'mid');
							folks = _.union(myArtists, myContributors);
							var contributorPool = _.difference(folks, [individual]);
							// Only accept this track if there's someone else associated with it...
							// ...unless this is the very first track in which case, pick anything and
							// get it in front of the user pronto.				
							foundSomeoneElse = (contributorPool.length > 0 || seenTracks.length === 1);

							if (foundSomeoneElse) {
								return fulfill(track);
							}
							next();
						};

						routes.getArtistsAndContributorsFromTracks([track])
						.then(validateTrack, callback);
					},
					callback
				);
			});
		};

		pickATrack()
		.then(routes.getTrackDetails)
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
		.then(searchForVideo)
		.then(extractVideoId)
		.then(getVideoEmbedCode)
		.then(embedVideoInDom)
		.then(finished, callback);
	};

	var optionsNewArtistsOnly = {subquery: {
		artist: [{
			'mid|=': seenArtists,
			optional: 'forbidden'
		}]
	}};

	// next[nextIndex] = what function to invoke if the current one doesn't find a track
	var nextIndex = 0;
	var next = [
		function () {
			if (seenArtists.length === 0) {
				// If this is the first track, get one by this artist if we can.
				console.dir(callback.toString());
				routes.getTracksByArtists([individual]).then(processTracks, callback);
			} else {
				// Otherwise, get one by an artist we haven't seen yet
				routes.getTracksWithContributors([individual], optionsNewArtistsOnly).then(processTracks, callback);
			}
		},
		// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
		function () {
			routes.getTracksWithContributors([individual], {}).then(processTracks, callback);
		},
		// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
		function () {
			routes.getTracksByArtists([individual]).then(processTracks, callback);
		},
		// Give up
		function () {
			deadEnd = true;
			var p = $('<p>')
				.text('Could not find any unseen tracks for ')
				.append(anchorFromMid(previousConnector.mid, previousConnector.name))
				.append('.');
			var msg = $('<paper-shadow>')
				.addClass('error')
				.append(p);
			msg.deadEnd = true;
			callback(msg);
		}
	];

	seenIndividuals.push(sourceIndividual);
	// Kick it off
	next[nextIndex]();
};
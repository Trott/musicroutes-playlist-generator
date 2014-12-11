/*global document*/
/*global -Promise*/
/*global window*/
var routes = require('./_lib/routes.js');
var videos = require('./_lib/videos.js');
var async = require('async');
var Promise = require('promise');
var $ = require('jquery');
var _ = require('lodash');
var url = require('url');
var querystring = require('querystring');

var resultsElem = $('#results');
var form = $('#startPlaylist');
var submit = $('#startPointSubmit');
var input = $('#startPoint');
var paperInput = $('#paperStartPoint');
var continueButtons = $('.continue');
var resetButtons = $('.reset');
var startOverButtons = $('.startOver');
var progress = $('#progress');
var formInstructions = $('.form-instructions');

var sourceIndividual;
var sourceIndividualRole;
var seenIndividuals = [];
var seenTracks = [];
var seenArtists = [];

var previousConnector;
var renderedTrackDetails;

var deadEnd = false;

var error = function (err) {
	if (err) {
		if (err instanceof Error) {
			var p = $('<p>').text(err.message);
			resultsElem.append($('<paper-shadow>').addClass('error').append(p));
			console.log(err.stack);
		} else if(err instanceof $) {
			resultsElem.append(err);
		}
		progress.removeAttr('active');
		resetButtons.css('visibility', 'visible');
		startOverButtons.css('visibility', 'visible');
		if (! deadEnd) {
			continueButtons.css('visibility', 'visible');
		}
	}
};

var anchorFromMid = function (mid, text) {
	text = text || mid;
	return $('<a>')
		.attr('href', 'http://freebase.com' + mid)
		.attr('target', '_blank')
		.text(text);
};

var generatePlaylist = function (individual, done) {
	var processTracks = function (tracks) {
		var track;
		var trackDetails;
		var notSeenTracks = _.difference(tracks, seenTracks);

		if (notSeenTracks.length === 0) {
			nextIndex = nextIndex +1;
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
			done(null);
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
							reject(Error('Dead end! Bummer. To try again, use the Start Over button above the playlist!'));
							return next();
						}
						track = _.sample(notSeenTracks);
						seenTracks.push(track);
						notSeenTracks = _.pull(notSeenTracks, track);
						routes.getArtistsAndContributorsFromTracks([track])
						.then(function (folks) {
							var myArtists = _.pluck(folks.artists, 'mid'); 
							var myContributors = _.pluck(folks.contributors, 'mid');
							folks = _.union(myArtists, myContributors);
							var contributorPool = _.difference(folks, [individual]);
							foundSomeoneElse = (contributorPool.length > 0);
							// Only accept this track if there's someone else associated with it...
							// ...unless this is the very first track in which case, pick anything and
							// get it in front of the user pronto.
							if (foundSomeoneElse || seenTracks.length === 1) {
								return fulfill(track);
							}
							next();
						}, error);
					},
					error
				);
			});
		};

		pickATrack()
		.then(routes.getTrackDetails)
		.then(function (details) {
			trackDetails = details;
			trackDetails.release = trackDetails.releases ? _.sample(trackDetails.releases) : '';
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
		.then(finished, error);
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
				routes.getTracksByArtists([individual]).then(processTracks, error);
			} else {
				// Otherwise, get one by an artist we haven't seen yet
				routes.getTracksWithContributors([individual], optionsNewArtistsOnly).then(processTracks, error);
			}
		},
		// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
		function () {
			routes.getTracksWithContributors([individual], {}).then(processTracks, error);
		},
		// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
		function () {
			routes.getTracksByArtists([individual]).then(processTracks, error);
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
			error(msg);
		}
	];

	// Kick it off
	next[nextIndex]();
};

var go = function () {
	// If lookupUserInput() didn't find an individual, don't do anything.
	if (seenIndividuals.length === 0) {
		return;
	}
	continueButtons.css('visibility', 'hidden');
	resetButtons.css('visibility', 'hidden');
	startOverButtons.css('visibility', 'hidden');
	progress.attr('active', 'active');
	var loopCount = 0;
	async.until(
		function () {
			return loopCount > 4;
		},
		function (next) {
			loopCount = loopCount + 1;
			generatePlaylist(sourceIndividual, next);
		},
		function (err) {
			error(err);
			progress.removeAttr('active');
			continueButtons.css('visibility', 'visible');
			resetButtons.css('visibility', 'visible');
			startOverButtons.css('visibility', 'visible');
		}
	);
};

continueButtons.on('click', go);

var resetForm = function () {
	continueButtons.css('visibility', 'hidden');
	resetButtons.css('visibility', 'hidden');
	startOverButtons.css('visibility', 'hidden');
	submit.removeAttr('disabled');
	input.removeAttr('disabled');
	paperInput.removeAttr('disabled');
	input.val('');
	input.focus();
};

var clearRoute = function () {
	seenIndividuals = [];
	seenTracks = [];
	seenArtists = [];
	resultsElem.empty();
};

resetButtons.on('click', function () {
	clearRoute();
	window.history.replaceState({}, '', '?');
	resetForm();
});

startOverButtons.on('click', function () {
	clearRoute();
	form.trigger('submit');
});

var formHandler = function (evt) {
	evt.preventDefault();
	
	var startingPoint = input.val().trim();
	if (! startingPoint) {
		return;
	}

	submit.attr('disabled', 'disabled');
	input.attr('disabled', 'disabled');
	paperInput.attr('disabled', 'disabled');
	resultsElem.empty();
	progress.attr('active', 'active');
	window.history.replaceState({}, '', '?' + querystring.stringify({q: startingPoint}));
	var lookupUserInput = function(mids) {
		sourceIndividual = mids[0];
		if (! sourceIndividual) {
			resultsElem.text('Could not find an artist named ' + startingPoint);
			progress.removeAttr('active');
			resetForm();
			return;
		}
		seenIndividuals.push(sourceIndividual);
		previousConnector = {mid: sourceIndividual};
	};

	routes.getMids(startingPoint, '/music/artist').then(lookupUserInput).then(go).catch(error);
};

form.on('submit', formHandler);
submit.on('click', formHandler);

$(document).ready(function () {
	var urlParts = url.parse(window.location.href, true);
	if (urlParts.query.q) {
		input.val(urlParts.query.q);
		formInstructions.empty();
		input.focus(); // Needed so paper elements floating label appears
		form.trigger('submit');
	}
});

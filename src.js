/*global document*/
/*global -Promise*/
var routes = require('./_lib/routes.js');
var videos = require('./_lib/videos.js');
var async = require('async');
var Promise = require('promise');
var $ = require('jquery');
var _ = require('lodash');

var resultsElem = $('#results');
var form = $('#startPlaylist');
var submit = $('#startPointSubmit');
var input = $('#startPoint');
var paperInput = $('#paperStartPoint');
var continueButtons = $('.continue');
var startOverButtons = $('.startOver');
var progress = $('#progress');

var sourceIndividual;
var seenIndividuals = [];
var seenTracks = [];
var seenArtists = [];

var error = function (err) {
	if (err) {
		resultsElem.append($('<p>').append(document.createTextNode('Error: ' + err.message)));
		console.log(err.stack);
		progress.removeAttr('active');
		startOverButtons.css('visibility', 'visible');
		continueButtons.css('visibility', 'visible');
	}
};

var embedShown = false;

var generatePlaylist = function (individual, done) {
	var processTracks = 	function (tracks) {
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

		var anchorFromMid = function (mid) {
			return $('<a>').attr('href', 'http://freebase.com' + mid).text(mid);
		};

		var renderTrackDetails = function () {
			var p = $('<p>');

			if (trackDetails.name) {
				p.append(document.createTextNode('"' + trackDetails.name + '"'));
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
					p.append(document.createTextNode(value.name));
				} else {
					p.append(anchorFromMid(value.mid));
				}
				needsAmpersand = true;
			});

			p.append($('<br>'));

			var release = _.sample(trackDetails.releases);

			if (release.name) {
				p.append($('<i>').text(release.name));
			} else {
				if (release.mid) {
					p.append(anchorFromMid(release.mid));
				}
			}

			resultsElem.append(p);
			return p.text();
		};

		var extractVideoId = function (data) {
			return _.result(data.items[0], 'videoId');
		};

		var getVideoEmbedCode = function (videoId) {
			return videoId && videos.embed(videoId);
		};

		var embedVideoInDom = function (data) {
			if (data && data.items && data.items[0] && data.items[0].embedHtml) {
				var div = $('<div>');
				// Yes, we're trusting YouTube's API not to p0wn us.
				div.html(data.items[0].embedHtml);
				resultsElem.append(div);
				embedShown = true;
			}
		};

		var getContributors = function () {
			return routes.getArtistsAndContributorsFromTracks([track]);
		};


		var pickContributor = function (contributors) {
			return new Promise(function (fulfill, reject) {
				var contributor;
				var notSeen = _.difference(contributors, seenIndividuals);				
				if (notSeen.length > 0) {
					contributor = _.sample(notSeen);
					seenIndividuals.push(contributor);
				} else {
					contributor = _.sample(contributors);
				}

				sourceIndividual = contributor;
				return contributor ? fulfill(contributor) : reject(Error('No contributors for track'));
			});
		};

		var renderConnector = function (details) {
			var p = $('<p>');
			p.append('…with ');
			if (details.name) {
				p.append(document.createTextNode(details.name));
			} else {
				p.append(anchorFromMid(details.mid));
			}
			p.append('…');
			resultsElem.append(p);
		};

		var finished = function () {
			done(null);
		};

		var foundSomeoneElse;
		var deadEnd;

		var pickATrack = function () {
			return new Promise(function (fulfill, reject) {
				async.until(
					function () {
						return foundSomeoneElse || deadEnd;
					},
					function (next) {
						if (notSeenTracks.length === 0) {
							deadEnd = true;
							reject(Error('Could not find a track that was not a dead end. Bummer.'));
							return next();
						}
						track = _.sample(notSeenTracks);
						seenTracks.push(track);
						notSeenTracks = _.pull(notSeenTracks, track);
						routes.getArtistsAndContributorsFromTracks([track])
						.then(function (folks) {
							var contributorPool = _.difference(folks, [individual]);
							foundSomeoneElse = (contributorPool.length > 0);
							if (foundSomeoneElse) {
								fulfill(track);
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
		.then(function (details) { trackDetails = details; })
		.then(addToSeenArtists)
		.then(renderTrackDetails)
		.then(videos.search)
		.then(extractVideoId)
		.then(getVideoEmbedCode)
		.then(embedVideoInDom)
		.then(getContributors)
		.then(pickContributor)
		.then(routes.getArtistDetails)
		.then(renderConnector)
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
		error.bind(undefined, new Error('Could not find any unseen tracks for contributor ' + individual))
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
	startOverButtons.css('visibility', 'hidden');
	progress.attr('active', 'active');
	embedShown = false;
	var loopCount = 0;
	async.until(
		function () { 
			return embedShown || loopCount > 4;
		},
		function (next) {
			loopCount = loopCount + 1;
			generatePlaylist(sourceIndividual, next);
		},
		function (err) {
			error(err);
			progress.removeAttr('active');
			startOverButtons.css('visibility', 'visible');
			continueButtons.css('visibility', 'visible');
		}
	);
};

continueButtons.on('click', go);

var resetForm = function () {
	continueButtons.css('visibility', 'hidden');
	startOverButtons.css('visibility', 'hidden');
	submit.removeAttr('disabled');
	input.removeAttr('disabled');
	paperInput.removeAttr('disabled');
	input.val('');
	input.focus();
};

startOverButtons.on('click', function () {
	seenIndividuals = [];
	seenTracks = [];
	seenArtists = [];
	resultsElem.empty();
	resetForm();
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
	var lookupUserInput = function(mids) {
		sourceIndividual = mids[0];
		if (! sourceIndividual) {
			resultsElem.text('Could not find an artist named ' + startingPoint);
			resetForm();
			return;
		}
		seenIndividuals.push(sourceIndividual);
	};

	routes.getMids(startingPoint, '/music/artist').then(lookupUserInput).then(go).catch(error);
};

form.on('submit', formHandler);
submit.on('click', formHandler);

/*global -Promise*/
var routes = require('../lib/routes.js');
var videos = require('../lib/videos.js');
var async = require('async');
var Promise = require('promise');
var $ = require('jquery');

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
		console.log('Error: ', err.message);
		console.dir(err.stack);
		throw(err);
	}
};

var random = function (array) {
	return array[Math.floor(Math.random()*array.length)];
};

var valuesNotIn = function (values, notIn) {
	// returns values from values that are not in notIn
	return values.filter( function (value) { 
		return notIn.indexOf( value ) === -1;
	});
};

var embedShown = false;

var generatePlaylist = function (individual, done) {
	var processTracks = 	function (tracks) {
		var track;
		var trackDetails;

		var notSeenTracks = valuesNotIn(tracks, seenTracks);
		if (notSeenTracks.length > 0) {
			track = random(notSeenTracks);
			seenTracks.push(track);
		} else {
			track = random(tracks);
		}
		if (! track) {
			nextIndex = nextIndex +1;
			next[nextIndex]();
			return;
		}

		var addToSeenArtists = function () {
			return new Promise(function (fulfill, reject) {
				if (!trackDetails) {
					return reject(Error('No details for ' + track));
				}
			
				var theseArtistMids = trackDetails.artists.map(function (value) { return value.mid; });
				seenArtists = seenArtists.concat(valuesNotIn(theseArtistMids, seenArtists));

				fulfill();
			});
		};
			
		var formatTrackDetails = function () {
			trackDetails.formatted = {};
			trackDetails.formatted.name = trackDetails.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS TRACK';
			trackDetails.formatted.artist = trackDetails.artists.map(function (value) { 
				return value.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS ARTIST'; 
			}).join(' & ');
			trackDetails.formatted.release = random(trackDetails.releases).name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS RELEASE';
		};

		var renderTrackDetails = function () {
			var p = $('<p>')
				.append('"' + trackDetails.formatted.name + '"')
				.append($('<br>'))
				.append(trackDetails.formatted.artist)
				.append($('<br>'))
				.append($('<i>').text(trackDetails.formatted.release));

			resultsElem.append(p);
		};

		var searchForVideoId = function () {
			var q = '"' + trackDetails.formatted.name + 
				'" "' + trackDetails.formatted.artist + 
				'" "' + trackDetails.formatted.release + '"';

			return videos.search(q);
		};

		var extractVideoId = function (data) {
			return data.items[0] && data.items[0].videoId;
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

		var getCommonContributors = function () {
			return routes.getArtistsAndContributorsFromTracks([track]);
		};


		var pickContributor = function (contributors) {
			return new Promise(function (fulfill, reject) {
				var contributor;
				var notSeen = valuesNotIn(contributors, seenIndividuals);				
				if (notSeen.length > 0) {
					contributor = random(notSeen);
					seenIndividuals.push(contributor);
				} else {
					contributor = random(contributors);
				}

				sourceIndividual = contributor;
				return contributor ? fulfill(contributor) : reject(Error('No contributors for track'));
			});
		};

		var renderConnector = function (details) {
			var name = details.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
			var p = $('<p>');
			p.append('…with ' + name + '…');
			resultsElem.append(p);
		};


		var finished = function () {
			done(null);
		};

		routes.getTrackDetails(track)
		.then(function (details) { trackDetails = details; })
		.then(addToSeenArtists)
		.then(formatTrackDetails)
		.then(renderTrackDetails)
		.then(searchForVideoId)
		.then(extractVideoId)
		.then(getVideoEmbedCode)
		.then(embedVideoInDom, error)
		.then(getCommonContributors)
		.then(pickContributor)
		.then(routes.getArtistDetails)
		.then(renderConnector)
		.then(finished, error);
	};

	var options = {subquery: {
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
				routes.getTracksWithContributors([individual], options).then(processTracks, error);
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
		error.bind(undefined, new Error('Could not find any tracks for contributor ' + individual))
	];

	// Kick it off
	next[nextIndex]();
};

var go = function () {
	continueButtons.attr('disabled', 'disabled'); 
	startOverButtons.attr('disabled', 'disabled');
	progress.attr('active', 'active');
	embedShown = false;
	async.until(
		function () { 
			return embedShown;
		},
		function (next) {
			generatePlaylist(sourceIndividual, next);
		},
		function (err) {
			error(err);
			continueButtons.removeAttr('disabled');
			startOverButtons.removeAttr('disabled');
			progress.removeAttr('active');
		}
	);
};

continueButtons.on('click', go);

var resetForm = function () {
	continueButtons.attr('disabled', 'disabled');
	startOverButtons.attr('disabled', 'disabled');
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
	submit.attr('disabled', 'disabled');
	input.attr('disabled', 'disabled');
	paperInput.attr('disabled', 'disabled');
	resultsElem.empty();
	var startingPoint = input.val();
	var kickoff = function(mids) {
		sourceIndividual = mids[0];
		if (! sourceIndividual) {
			resultsElem.text('Could not find an artist named ' + startingPoint);
			resetForm();
			return;
		}
		seenIndividuals.push(sourceIndividual);
		go();
	};

	routes.getMids(startingPoint, '/music/artist').then(kickoff, error);
};

form.on('submit', formHandler);
submit.on('click', formHandler);

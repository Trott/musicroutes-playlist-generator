/*global document*/
/*global -Promise*/
var routes = require('../lib/routes.js');
var videos = require('../lib/videos.js');
var async = require('async');
var Promise = require('promise');

var resultsElem = document.getElementById('results');
var form = document.getElementById('startPlaylist');
var submit = document.getElementById('startPointSubmit');
var input = document.getElementById('startPoint');
var paperInput = document.getElementById('paperStartPoint');
var continueButton = document.getElementById('continue');
var startOverButton = document.getElementById('startOver');
var progress = document.getElementById('progress');

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
			var p = document.createElement('p');

			p.appendChild(document.createTextNode('"' + trackDetails.formatted.name + '"'));
			p.appendChild(document.createElement('br'));
			p.appendChild(document.createTextNode(trackDetails.formatted.artist));
			p.appendChild(document.createElement('br'));
			var i = document.createElement('i');
			i.appendChild(document.createTextNode(trackDetails.formatted.release));
			p.appendChild(i);

			resultsElem.appendChild(p);
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
				var div = document.createElement('div');
				// Yes, we're trusting YouTube's API not to p0wn us.
				div.innerHTML = data.items[0].embedHtml;
				resultsElem.appendChild(div);
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
			var p = document.createElement('p');
			p.appendChild(document.createTextNode('…with ' + name + '…'));
			resultsElem.appendChild(p);
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
	continueButton.setAttribute('disabled', 'disabled');
	startOverButton.setAttribute('disabled', 'disabled');
	progress.setAttribute('active', 'active');
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
			continueButton.removeAttribute('disabled');
			startOverButton.removeAttribute('disabled');
			progress.removeAttribute('active');
		}
	);
};

continueButton.addEventListener('click', function () {
	go();	
});

var resetForm = function () {
	continueButton.setAttribute('disabled', 'disabled');
	startOverButton.setAttribute('disabled', 'disabled');
	submit.removeAttribute('disabled');
	input.removeAttribute('disabled');
	paperInput.removeAttribute('disabled');
	input.value = '';
	input.focus();
};

startOverButton.addEventListener('click', function () {
	seenIndividuals = [];
	seenTracks = [];
	seenArtists = [];
	resultsElem.innerHTML = '';
	resetForm();
});

var formHandler = function (evt) {
	evt.preventDefault();
	submit.setAttribute('disabled', 'disabled');
	input.setAttribute('disabled', 'disabled');
	paperInput.setAttribute('disabled', 'disabled');
	resultsElem.innerHTML = '';
	var startingPoint = input.value;
	var kickoff = function(mids) {
		sourceIndividual = mids[0];
		if (! sourceIndividual) {
			resultsElem.textContent = 'Could not find an artist named ' + startingPoint;
			resetForm();
			return;
		}
		seenIndividuals.push(sourceIndividual);
		go();
	};

	routes.getMids(startingPoint, '/music/artist').then(kickoff, error);
};

form.addEventListener('submit', formHandler);
submit.addEventListener('click', formHandler);

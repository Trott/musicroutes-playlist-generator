/*global document*/
var routes = require('../lib/routes.js');
var videos = require('../lib/videos.js');
var async = require('async');

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

		routes.getTrackDetails(track, function (err, details) {
			error(err);

			if (!details) {
				error(new Error('No details for ' + track));
			}

			var theseArtistMids = details.artists.map(function (value) { return value.mid; });
			seenArtists = seenArtists.concat(valuesNotIn(theseArtistMids, seenArtists));
			var name = details.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS TRACK';
			var artist = details.artists.map(function (value) { 
				return value.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS ARTIST'; 
			}).join(' & ');
			var release = random(details.releases).name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS RELEASE';

			var p = document.createElement('p');

			p.appendChild(document.createTextNode('"' + name + '"'));
			p.appendChild(document.createElement('br'));
			p.appendChild(document.createTextNode(artist));
			p.appendChild(document.createElement('br'));
			var i = document.createElement('i');
			i.appendChild(document.createTextNode(release));
			p.appendChild(i);

			resultsElem.appendChild(p);

			var commonLink = routes.getArtistsAndContributorsFromTracks.bind(undefined, [track], function (err, contributors) {
				error(err);
				var contributor;
				var notSeen = valuesNotIn(contributors, seenIndividuals);				
				if (notSeen.length > 0) {
					contributor = random(notSeen);
					seenIndividuals.push(contributor);
				} else {
					contributor = random(contributors);
				}
				routes.getArtistDetails(contributor, function (err, details) {
					error(err);
					var name = details.name || 'FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
					var p = document.createElement('p');
					p.appendChild(document.createTextNode('…with ' + name + '…'));
					resultsElem.appendChild(p);
					sourceIndividual = contributor;
					done();
				});
			});

			var q = '"' + name + '" "' + artist + '" "' + release + '"';

			var extractVideoId = function (data) {
				return new Promise(function (fulfill, reject) {
					if (data.items[0] && data.items[0].videoId) {
						fulfill(data.items[0].videoId);
					} else {
						reject(Error('No videoId to extract'));
					}
				});
			};
			
			var embedInDom = function (data) {
				if (data.items[0] && data.items[0].embedHtml) {
					var div = document.createElement('div');
					// Yes, we're trusting YouTube's API not to p0wn us.
					div.innerHTML = data.items[0].embedHtml;
					resultsElem.appendChild(div);
					embedShown = true;
				}
			};

			videos.search(q)
			.then(extractVideoId)
			.then(videos.embed)
			.then(embedInDom)
			.then(commonLink, commonLink);
			
		});
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

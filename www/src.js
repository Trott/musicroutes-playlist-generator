/*global document*/
var routes = require('../lib/routes.js');
var videos = require('../lib/videos.js');
var async = require('async');

var resultsElem = document.getElementById('results');
var form = document.getElementById('startPlaylist');
var submit = document.getElementById('startPointSubmit');
var input = document.getElementById('startPoint');

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
	var callback = 	function (err, tracks) {
		error(err);
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
			var name = details.name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS TRACK';
			var artist = details.artists.map(function (value) { 
				return value.name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS ARTIST'; 
			}).join(' & ');
			var release = random(details.releases).name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS RELEASE';

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
					var name = details.name || 'WHOOPS, FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
					var p = document.createElement('p');
					p.appendChild(document.createTextNode('...with ' + name + '...'));
					resultsElem.appendChild(p);
					sourceIndividual = contributor;
					done();
				});
			});

			var q = '"' + name + '" "' + artist + '" "' + release + '"';
			
			videos.search(q, function (err, data) {
				if (data && data.items && data.items[0] && data.items[0].videoId) {
					videos.embed(data.items[0].videoId, function (err, data) {
						if (data && data.items && data.items[0] && data.items[0].embedHtml) {
							var div = document.createElement('div');
							// Yes, we're trusting YouTube's API not to p0wn us.
							div.innerHTML = data.items[0].embedHtml;
							resultsElem.appendChild(div);
							embedShown = true;
							done();
						} else {
							commonLink();
						}
					});
				} else {
					commonLink();
				}
			});			
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
		// Find a track by an artist we haven't seen yet.
		function () {
			if (seenArtists.length === 0) {
				// If this is the first track, get one by this artist if we can.
				routes.getTracksByArtists([individual], {}, callback);
			} else {
				// Otherwise, get one by an artist we haven't seen yet
				routes.getTracksWithContributors([individual], options, callback);
			}
		},
		routes.getTracksWithContributors.bind(undefined, [individual], options, callback),
		// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
		routes.getTracksWithContributors.bind(undefined, [individual], {}, callback),
		// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
		routes.getTracksByArtists.bind(undefined, [individual], {}, callback),
		// Give up
		error.bind(undefined, new Error('Could not find any tracks for contributor ' + individual))
	];

	// Kick it off
	next[nextIndex]();
};

form.addEventListener('submit', function (evt) {
	evt.preventDefault();
	submit.setAttribute('disabled', 'disabled');
	input.setAttribute('disabled', 'disabled');
	var startingPoint = input.value;
	routes.getMids(startingPoint, '/music/artist', function (err, mids) {
		error(err);
		sourceIndividual = mids[0];
		if (! sourceIndividual) {
			resultsElem.textContent = 'Could not find an artist named ' + startingPoint;
			return;
		}
		seenIndividuals.push(sourceIndividual);
		embedShown = false;
		async.until(
			function () { 
				return embedShown;
			},
			function (next) {
				generatePlaylist(sourceIndividual, next);
			},
			error
		);
	});
});

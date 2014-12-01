#!/usr/bin/env node
/* global -Promise */

var routes = require('../lib/routes.js');
var videos = require('../lib/videos.js');
var async = require('async');
var Promise = require('promise');

var sourceIndividual;
var seenIndividuals = [];
var seenTracks = [];
var seenArtists = [];

var error = function (err) {
	if (err) {
		console.log('Error: ', err.message);
		process.exit(1);
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

var generatePlaylist = function (individual, done) {	
	var fulfill = 	function (tracks) {
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

			var output = '"' + name + '"';
			output += '\n' + artist;
			output += '\n_' + release + '_';

			var q = '"' + name + '" "' + artist + '" "' + release + '"';
			console.log(output);

			var writeVideoUrl = function (data) {
				if (data.items[0] && data.items[0].videoId) {
					console.log('http://youtu.be/' + data.items[0].videoId);
				}				
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

					if (contributor) {
						fulfill(contributor);
					} else {
						reject(Error('No contributor found for track'));
					}
				});
			};

			var printConnectorDetails = function (details) {
				return new Promise(function (fulfill, reject) {
					if (!details || !details.mid) {
						reject(Error('No mid for contributor. Something is wrong.'));
					}
					var name = details.name || 'WHOOPS, FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
					console.log('\n ... with ' + name + ' ... \n');
					sourceIndividual = details.mid;
					fulfill();
				});
			};

			var getConnectedTracks = function () {
				return routes.getArtistsAndContributorsFromTracks([track]);
			};

			var finished = function () {
				done(null);
			};

			videos.search(q)
			.then(writeVideoUrl)
			.then(getConnectedTracks)
			.then(pickContributor)
			.then(routes.getArtistDetails)
			.then(printConnectorDetails)
			.then(finished, error);
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
				routes.getTracksByArtists([individual]).then(fulfill, error);
			} else {
				// Otherwise, get one by an artist we haven't seen yet
				routes.getTracksWithContributors([individual], options).then(fulfill, error);
			}
		},
		function () {
			routes.getTracksWithContributors([individual], options).then(fulfill, error);
		}, 
		// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
		function () {
			routes.getTracksWithContributors([individual], {}).then(fulfill, error);
		},
		// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
		function () {
			routes.getTracksByArtists([individual]).then(fulfill, error);
		},
		// Give up
		error.bind(undefined, new Error('Could not find any tracks for contributor ' + individual))
	];

	// Kick it off
	next[nextIndex]();
};

var startingPoint = process.argv[2] || 'Todd Rundgren';

var kickOff = function(mids) {
	sourceIndividual = mids[0];
	if (! sourceIndividual) {
		console.log('Could not find an artist named ' + process.argv[2]);
		process.exit(0);
	}
	seenIndividuals.push(sourceIndividual);
	async.forever(
		function (next) {
			generatePlaylist(sourceIndividual, next);
		},
		error
	);
};

routes.getMids(startingPoint, '/music/artist')
.then(kickOff, error);
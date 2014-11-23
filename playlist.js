#!/usr/bin/env node

var routes = require('./lib/routes.js');
var async = require('async');

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

			var output = '"' + name + '"';
			output += '\n' + artist;
			output += '\n_' + release + '_';
			console.log(output);


			routes.getArtistsAndContributorsFromTracks([track], function (err, contributors) {
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
					var name = details.name || 'WHOOPS, FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
					console.log('\n ... with ' + name + ' ... \n');
					sourceIndividual = contributor;
					done();
				});
			});
		});
	};

	var options = seenArtists.length === 0 ? {} : {subquery: {
		artist: [{
					'mid|=': seenArtists,
					optional: 'forbidden'
		}]
	}};

	// next[nextIndex] = what function to invoke if the current one doesn't find a track
	var nextIndex = 0;
	var next = [
		// Find a track by an artist we haven't seen yet.
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

var startingPoint = process.argv[2] || 'Todd Rundgren';
routes.getMids(startingPoint, '/music/artist', function (err, mids) {
	error(err);
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
});
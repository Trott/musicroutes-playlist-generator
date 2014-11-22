#!/usr/bin/env node

var routes = require('../index.js');
var async = require('async');

var sourceIndividual;
var seen = [];

var error = function (err) {
	if (err) {
		console.log('Error: ', err.message);
		console.dir(err);
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
	async.parallel([
		routes.getTracksWithContributors.bind(undefined, [individual]),
		routes.getTracksByArtists.bind(undefined, [individual])
	],
	function (err, tracks) {
		error(err);
		tracks = tracks[0].concat(tracks[1]);
		var track = random(tracks);
		routes.getTrackDetails(track, function (err, details) {
			if (err) {
				return console.error('Error: ', err.message);
			}

			var name = details.name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS TRACK';
			var artist = details.artists.map(function (value) { 
				return value.name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS ARTIST'; 
			}).join(' & ');
			var release = random(details.releases).name || 'WHOOPS, FREEBASE DOES NOT APPEAR TO HAVE AN ENGLISH NAME FOR THIS TRACK';

			var output = '"' + name + '"';
			output += '\n' + artist;
			output += '\n_' + release + '_';
			console.log(output);


			routes.getArtistsAndContributorsFromTracks([track], function (err, contributors) {
				error(err);
				var contributor;
				var notSeen = valuesNotIn(contributors, seen);
				if (notSeen.length > 0) {
					contributor = random(notSeen);
					seen.push(contributor);
				} else {
					contributor = random(contributors);
				}
				routes.getArtistDetails(contributor, function (err, details) {
					var name = details.name || 'WHOOPS, FREEBASE DOES NOT HAVE AN ENGLISH NAME FOR THIS PERSON';
					console.log('\n ... with ' + name + ' who is also on... \n');
					sourceIndividual = contributor;
					done();
				});
			});
		});
	});
};

routes.getMids('Todd Rundgren', '/music/artist', function (err, mids) {
	error(err);
	sourceIndividual = mids[0];
	seen.push(sourceIndividual);
	async.forever(
		function (next) {
			generatePlaylist(sourceIndividual, next);
		},
		error
	);
});
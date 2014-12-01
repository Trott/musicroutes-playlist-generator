/*jshint expr: true*/

var rewire = require('rewire');
var routes = rewire('../../lib/routes.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

describe('exports', function () {
	var TheBeatles = '/m/07c0j';
	var PaulMcCartney = '/m/03j24kf';
	var GeorgeHarrison = '/m/03bnv';
	var Something = '/m/0mlx6x';
	var YouKnowMyName = '/m/0fqv51t';
	var BobDylan = '/m/01vrncs';
	var OriginalFaubusFables = '/m/0q69hv';
	var revert;

	beforeEach(function (done) {
		if (typeof revert === 'function') {
			revert();
			revert = null;
		}
		nock.cleanAll();
		nock.enableNetConnect();
		done();
	});

	describe('getMids()', function () {
		it('should retrieve MIDs for all artists with the supplied name when artists specified', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/0160yj');
				done();
			};

			routes.getMids('Magma', '/music/artist').then(success);
		});

		it('should retrieve MIDs for all tracks with the supplied name when tracks specified', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/0lgj3t');
				done();
			};

			routes.getMids('Penny Lane', '/music/track').then(success);
		});

		it('should retrieve only the MIDs for specified type', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/01czx');
				expect(data).to.not.contain('/m/0f2hrtz');
				done();
			};

			routes.getMids('Black Sabbath', '/music/artist').then(success);
		});

		it('should return an error if there is a network error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getMids('Black Sabbath', '/music/artist').catch(failure);
		});
	});

	describe('getTracksWithContributors()', function () {
		it('should retrieve tracks with any of the supplied contributors', function (done) {
			var success = function (data) {
				expect(data).to.be.array();
				expect(data).to.contain(Something);
				done();
			};

			routes.getTracksWithContributors([PaulMcCartney], {}).then(success);
		});

		it('should return an error if there is a network error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getTracksWithContributors([PaulMcCartney], {}).catch(failure);
		});

		it('should return undefined for track_contributions for which there is no track', function (done) {
			// This should never happen but since we don't actually control what we get
			// back from Freebase, it conceivably could. There's a defensive coding check
			// in grabMid() so we have this test to get to 100% code coverage.
			revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
				callback(null, { result: [ { track_contributions: [{}], type: '/music/artist' } ] });
			}}});

			var success = function (data) {
				expect(data).to.deep.equal([undefined]);
				done();
			};

			routes.getTracksWithContributors([PaulMcCartney], {}).then(success);
		});

		it('should run subquery to omit artists specified in options', function (done) {
			var success = function (data) {
				expect(data).to.not.contain(Something);
				done();
			};

			var omitTheBeatles = {
				artist: [{
					'mid|=': [TheBeatles, GeorgeHarrison],
					optional: 'forbidden'
				}]
			};

			routes.getTracksWithContributors([PaulMcCartney], {subquery: omitTheBeatles}).then(success);
		});
	});

	describe('getTracksByArtists()', function () {
		it('should retrieve tracks by any of the supplied artists', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/0155j9k');
				done();
			};

			routes.getTracksByArtists([PaulMcCartney]).then(success);
		});

		it('should return an error if there is a network error', {}, function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getTracksByArtists([PaulMcCartney]).catch(failure);
		});
	});

	describe('getArtistsAndContributorsFromTracks()', function () {
		it('should retrieve Beatles and Brian Jones from "You Know My Name (Look Up The Number)"', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/07c0j');
				expect(data).to.contain('/m/01p95y0');
				done();
			};

			routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).then(success);
		});

		it('should retrieve Todd Rundgren for "Afraid"', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/095x_');
				done();
			};

			routes.getArtistsAndContributorsFromTracks(['/m/0f2c414']).then(success);
		});

		it('should retrieve Beatles, Brian Jones, and Todd Rundgren for "You Know My Name" and "Afraid"', function (done) {
			var success = function (data) {
				expect(data).to.contain('/m/07c0j');
				expect(data).to.contain('/m/01p95y0');
				expect(data).to.contain('/m/095x_');
				done();
			};

			routes.getArtistsAndContributorsFromTracks([YouKnowMyName, '/m/0f2c414']).then(success);
		});

		it('should return an error if there is a network error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).catch(failure);
		});

		it('should handle unexpected but valid JSON gracefully', function (done) {
			nock('https://www.googleapis.com')
				.filteringPath(/.*/, '/')
				.get('/')
				.reply(200, '{"result": [false]}');
			var success = function (data) {
				expect(data).to.deep.equal([]);
				done();
			};

			routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).then(success);
		});
	});

	describe('getArtistDetails()', function () {
		it('should return the artist name', function (done) {
			var success = function (data) {
				expect(data.name).to.equal('Bob Dylan');
				done();
			};

			routes.getArtistDetails('/m/01vrncs').then(success);
		});

		it('should return an error if there is a network error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getArtistDetails(BobDylan).catch(failure);
		});

		it('should return null if data from MQL query is, somehow, null', function (done) {
			// Should never happen, but you know, defensive programming and all that.
			revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
				callback(null, null);
			}}});

			var success = function (data) {
				expect(data).to.be.null();
				done();
			};

			routes.getArtistDetails(BobDylan).then(success);
		});
	});

	describe('getTrackDetails()', function () {
		it('should return the track name, artist, and release title', function (done) {
			var success = function (data) {
				expect(data.name).to.equal('Original Faubus Fables');
				expect(data.artists).to.deep.equal([{name: 'Charles Mingus', mid: '/m/024zq'}]);
				expect(data.releases).to.deep.contain({name: 'Charles Mingus Presents Charles Mingus'});
				done();
			};

			routes.getTrackDetails('/m/0q69hv').then(success);
		});

		it('should return an error if there is a network error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			routes.getTrackDetails(OriginalFaubusFables).catch(failure);
		});

		it('should return null if data from MQL query is, somehow, null', function (done) {
			// Should never happen, but you know, defensive programming and all that.
			revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
				callback(null, null);
			}}});

			var success = function (data) {
				expect(data).to.be.null();
				done();
			};

			routes.getTrackDetails(OriginalFaubusFables).then(success);
		});
	});
});

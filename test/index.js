/*jshint expr: true*/

var routes = require('../index.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;

describe('exports', function () {
	describe('getMids()', function () {
		it('should retrieve MIDs for all artists with the supplied name when artists specified', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/0160yj');
				done();
			};

			routes.getMids('Magma', '/music/artist', callback);
		});

		it('should retrieve MIDs for all tracks with the supplied name when tracks specified', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/0lgj3t');
				done();
			};

			routes.getMids('Penny Lane', '/music/track', callback);
		});

		it('should retrieve only the MIDs for specified type', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/01czx');
				expect(data).to.not.contain('/m/0f2hrtz');
				done();
			};

			routes.getMids('Black Sabbath', '/music/artist', callback);
		});
	});

	describe('getTracksWithContributors()', function () {
		it('should retrieve tracks with any of the supplied contributors', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/0mlx6x');
				done();
			};

			routes.getTracksWithContributors(['/m/03j24kf'], callback);
		});
	});

	describe('getTracksByArtists()', function () {
		it('should retrieve tracks by any of the supplied artists', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/0155j9k');
				done();
			};

			routes.getTracksByArtists(['/m/03j24kf'], callback);
		});
	});

	describe('getArtistsAndContributorsFromTracks()', function () {
		it('should retrieve Beatles and Brian Jones from "You Know My Name (Look Up The Number)"', function (done) {
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.contain('/m/07c0j');
				expect(data).to.contain('/m/01p95y0');
				done();
			};

			routes.getArtistsAndContributorsFromTracks(['/m/0fqv51t'], callback);
		});
	});
});

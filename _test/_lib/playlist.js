/*jshint expr: true*/

var rewire = require('rewire');
var playlist = rewire('../../_lib/playlist.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

var jsdom = require('jsdom').jsdom;
var document = jsdom('fhqwhagads');

var $ = require('cheerio');

var div;

describe('exports', function () {
	var revert;

	var BobDylan = '/m/01vrncs';

	beforeEach(function (done) {
		if (typeof revert === 'function') {
			revert();
			revert = null;
		}
		nock.cleanAll();
		nock.disableNetConnect();
		div = document.createElement('div');
		done();
	});

	describe('clear()', function () {
		it('should reset seenIndividuals', function (done) {
			revert = playlist.__set__({seenIndividuals: ['fhqwhagads']});
			playlist.clear();
			expect(playlist.__get__('seenIndividuals')).to.deep.equal([]);
			done();
		});

		it('should reset seenTracks', function (done) {
			revert = playlist.__set__({seenTracks: ['fhqwhagads']});
			playlist.clear();
			expect(playlist.__get__('seenTracks')).to.deep.equal([]);
			done();
		});

		it('should reset seenArtists', function (done) {
			revert = playlist.__set__({seenArtists: ['fhqwhagads']});
			playlist.clear();
			expect(playlist.__get__('seenArtists')).to.deep.equal([]);
			done();
		});

		it('should reset sourceIndividual', function (done) {
			revert = playlist.__set__({sourceIndividual: 'fhqwhagads'});
			playlist.clear();
			expect(playlist.__get__('sourceIndividual')).to.be.null();
			done();
		});

		it('should reset previousConnector', function (done) {
			revert = playlist.__set__({previousConnector: {mid: 'fhqwhagads'}});
			playlist.clear();
			expect(playlist.__get__('previousConnector')).to.be.null();
			done();
		});
	});

	describe('setSource()', function () {
		it('should set the source Individual', function (done) {
			revert = playlist.__set__({sourceIndividual: 'jake'});
			playlist.setSource('joe');
			expect(playlist.__get__('sourceIndividual')).to.equal('joe');
			done();
		});
	});

	describe('track()', function () {
		it('should return an error if there is no network', function (done) {
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			playlist.setSource(BobDylan);
			playlist.track(div, $, failure);
		});

		// it('should not trigger an error if given a valid start point', function (done) {
		// 	var success = function (err) {
		// 		expect(err).to.be.undefined();
		// 		done();
		// 	};

		// 	playlist.setSource(BobDylan);
		// 	playlist.track(div, $, success);
		// });

		// it('should return a track if given a valid start point', function (done) {
		// 	var success = function () {
		// 		expect($(div).text()).to.contain('blah blah blah');
		// 		done();
		// 	};

		// 	playlist.setSource(BobDylan);
		// 	playlist.track(div, $, success);
		// });
	});
});

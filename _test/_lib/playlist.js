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

var jsdom = require("jsdom").jsdom;
var document = jsdom("fhqwhagads");

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
		nock.enableNetConnect();
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
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			playlist.setSource(BobDylan);
			playlist.track(div, $, failure);
		});
	});
});

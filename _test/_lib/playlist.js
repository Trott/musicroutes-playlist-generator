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

var $ = require('cheerio');

var div;

describe('playlist', function () {
	var revert;

	var BobDylan = '/m/01vrncs';

	beforeEach(function (done) {
		if (typeof revert === 'function') {
			revert();
			revert = null;
		}
		nock.cleanAll();
		nock.disableNetConnect();
		div = $('<div>');
		done();
	});

	describe('clear()', function () {
		it('should reset seenIndividuals', function (done) {
			revert = playlist.__set__({state: {seenIndividuals: ['fhqwhagads']}});
			playlist.clear();
			expect(playlist.__get__('state.seenIndividuals')).to.deep.equal([]);
			done();
		});

		it('should reset seenTracks', function (done) {
			revert = playlist.__set__({state: {seenTracks: ['fhqwhagads']}});
			playlist.clear();
			expect(playlist.__get__('state.seenTracks')).to.deep.equal([]);
			done();
		});

		it('should reset seenArtists', function (done) {
			revert = playlist.__set__({state: {seenArtists: ['fhqwhagads']}});
			playlist.clear();
			expect(playlist.__get__('state.seenArtists')).to.deep.equal([]);
			done();
		});

		it('should reset sourceIndividual', function (done) {
			revert = playlist.__set__({state: {sourceIndividual: 'fhqwhagads'}});
			playlist.clear();
			expect(playlist.__get__('state.sourceIndividual')).to.deep.equal({});
			done();
		});

		it('should reset previousConnector', function (done) {
			revert = playlist.__set__({state: {previousConnector: {mid: 'fhqwhagads'}}});
			playlist.clear();
			expect(playlist.__get__('state.previousConnector')).to.deep.equal({});
			done();
		});
	});

	describe('setSource()', function () {
		it('should set the source Individual', function (done) {
			revert = playlist.__set__({state: {sourceIndividual: {mid: 'jake'}}});
			playlist.setSource('joe');
			expect(playlist.__get__('state.sourceIndividual.mid')).to.equal('joe');
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
			playlist.track(div, $).catch(failure);
		});

		it('should return a track if given a valid start point', function (done) {
			nock.enableNetConnect();

			var success = function () {
				expect(div.text()).to.contain('Bob Dylan appeared on:');
				done();
			};

			playlist.setSource(BobDylan);
			playlist.track(div, $).then(success);
		});
	});

	describe('getSerialized()', function () {
		it('should return the playlist serialized', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: [
						{
							connectorToNext: '/fhqwhagads'
						},
						{
							mid: '/everybody-to-the-limit',
							release:'/live-from-east-reykjavik',
							connectorToNext: '/jake'
						},
						{
							mid: '/the-system-is-down',
							release:'/strong-bad-sings',
							connectorToNext: '/joe'
						}
					]
				}
			});

			var serialized = playlist.getSerialized();
			expect(serialized).to.equal('[{"connectorToNext":"/fhqwhagads"},{"mid":"/everybody-to-the-limit","release":"/live-from-east-reykjavik","connectorToNext":"/jake"},{"mid":"/the-system-is-down","release":"/strong-bad-sings","connectorToNext":"/joe"}]');
			done();
		});
	});
});

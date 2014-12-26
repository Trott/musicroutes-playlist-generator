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
var _ = require('lodash');

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
	});

	describe('setSource()', function () {
		it('should set the source Individual', function (done) {
			nock.enableNetConnect();

			revert = playlist.__set__({state: {sourceIndividual: {mid: '/fhqwhagads'}}});
			playlist.setSource(BobDylan)
			.then(function () {
				var resultPlaylist = playlist.__get__('state.playlist');
				var source = resultPlaylist[0].connectorToNext;
				expect(source.mid).to.equal(BobDylan);
				expect(source.name).to.equal('Bob Dylan');
				done();
			});
		});
	});

	describe('fetchNewTrack()', function () {
		it('should return an error if there is no network', function (done) {
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			playlist.setSource(BobDylan);
			playlist.fetchNewTrack($).catch(failure);
		});

		it('should return a track if given a valid start point', function (done) {
			nock.enableNetConnect();

			var success = function (data) {
				expect(data[0]).to.deep.equal(
					{
  					connectorToNext: {
   						mid: '/m/01vrncs',
   						name: 'Bob Dylan'
  					}
 					}
 				);
				done();
			};

			playlist.setSource(BobDylan);
			playlist.fetchNewTrack($).then(success);
		});
	});

	describe('serialize()', function () {
		it('should return the playlist serialized', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: [
						{
							connectorToNext: {
								mid: '/fhqwhagads'
							}
						},
						{
							mid: '/everybody-to-the-limit',
							release: {
								mid: '/live-from-east-reykjavik'
							},
							connectorToNext: {
								mid: '/jake'
							}
						},
						{
							mid: '/the-system-is-down',
							release: {
								mid: '/strong-bad-sings'
							},
							connectorToNext: {
								mid: '/joe'
							}
						}
					]
				}
			});

			var serialized = playlist.serialize();
			expect(JSON.parse(serialized)).to.deep.equal([
				{
					connectorToNext: '/fhqwhagads'
				},{
					mid: '/everybody-to-the-limit',
					release: '/live-from-east-reykjavik',
					connectorToNext: '/jake'
				},{
					mid: '/the-system-is-down',
					release: '/strong-bad-sings',
					connectorToNext: '/joe'
				}
			]);
			done();
		});

		it('should truncate the playlist to first eleven items (ten tracks) before serializing', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: _.range(50)
				}
			});

			var serialized = playlist.serialize();
			expect(serialized).to.equal('[{},{},{},{},{},{},{},{},{},{},{}]');
			done();
		});

		it('should omit details and just return the mids', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: [
						{
							connectorToNext: {
								mid: '/fhqwhagads',
								name: 'Fhqwhagads'
							},
							release: {
								mid: '/everybody-to-the-limit',
								name: 'Everybody To The Limit!'
							}
						}
					]
				}
			});

			var serialized = playlist.serialize();
			expect(JSON.parse(serialized)).to.deep.equal([{
				connectorToNext: '/fhqwhagads',
				release: '/everybody-to-the-limit'
			}]);
			done();
		});
	});

	describe('deserialize()', function () {
		it('should return an Error if badly formed JSON sent', function (done) {
			var failure = function (err) {
				expect(err instanceof Error).to.be.true();
				done();
			};

			playlist.deserialize('fhqwhagads')
				.catch(failure);
		});

		it('should transform connectorToNext string property to an object with a mid property', function (done) {
			var success = function (data) {
				expect(data).to.deep.equal([{connectorToNext: {mid: '/fhqwhagads'}}]);
				done();
			};

			playlist.deserialize('[{"connectorToNext": "/fhqwhagads"}]')
				.then(success);
		});

		it('should transform release string property to an object with a mid property', function (done) {
			var success = function (data) {
				expect(data).to.deep.equal([{
					connectorToNext: {mid: '/fhqwhagads'}, 
					release: {mid: '/live-from-east-reykjavik'}
				}]);
				done();
			};

			playlist.deserialize('[{"connectorToNext": "/fhqwhagads", "release": "/live-from-east-reykjavik"}]')
				.then(success);
		});
	});

	describe('fetchConnectorDetails()', function () {
		it('should do nothing if there is already a connectorToNext.name', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: [
						{connectorToNext: {name: 'fhqwhagads'}},
						{}
					]
				}
			});
			playlist.fetchConnectorDetails(1)
			.then(function (connector) {
				expect(connector).to.deep.equal({name: 'fhqwhagads'});
				done();
			});
		});

		it('should use the artist name if the mid matches', function (done) {
			revert = playlist.__set__({
				state: {
					playlist: [
						{connectorToNext: {mid: '/fhqwhagads'}, artists: [{mid: '/fhqwhagads', name: 'Strong Bad'}]},
						{}	
					]
				}
			});
			playlist.fetchConnectorDetails(1)
			.then(function (connector) {
				expect(connector).to.deep.equal({mid: '/fhqwhagads', name: 'Strong Bad'});
				done();
			});
		});

		it('should query Freebase for the connector details if mid is not in artists', function (done) {
			revert = playlist.__set__({
				routes: {
					getArtistDetails: function () {
						return {then: function (cb) { cb({name: 'Strong Bad'}); }};
					}
				},
				state: {
					playlist: [
						{connectorToNext: {mid: '/fhqwhagads'}},
						{}
					]
				}
			});
			playlist.fetchConnectorDetails(1);
			expect(playlist.__get__('state').playlist[0].connectorToNext.name).to.equal('Strong Bad');
			done();
		});

		it('should accept an index to select an arbitrary playlist entry', function (done) {
			revert = playlist.__set__({
				routes: {
					getArtistDetails: function () {
						return {then: function (cb) { cb({name: 'Strong Bad'}); }};
					}
				},
				state: {
					playlist: [
						{},
						{connectorToNext: {mid: '/fhqwhagads'}},
						{},
						{},
						{}
					]
				}
			});
			playlist.fetchConnectorDetails(2);
			expect(playlist.__get__('state').playlist[1].connectorToNext.name).to.equal('Strong Bad');
			done();
		});
	});

	describe('setTrackDetails()', function () {
		it('should set defaults gracefully if null object sent for details', function (done) {
			revert = playlist.__set__({state: {
				track: '/fhqwhagads',
				playlist: []
			}});
			var trackDetails = playlist.setTrackDetails(null);

			var expectedResults = {
				mid: '/fhqwhagads', 
				release: ''
			};
			expect(trackDetails).to.deep.equal(expectedResults);
			done();
		});

		it('should use details provided', function (done) {
			revert = playlist.__set__({
				state: {
					track: '/fhqwhagads',
					playlist: []
				}
			});
			var details =	{releases: [{mid: '/live-from-east-reykjavik'}]};
			var trackDetails = playlist.setTrackDetails(details);

			var expectedResults = {
				mid: '/fhqwhagads',
				releases: [{mid: '/live-from-east-reykjavik'}],
				release: {mid: '/live-from-east-reykjavik'}
			};
			expect(trackDetails).to.deep.equal(expectedResults);
			done();
		});
	});
});

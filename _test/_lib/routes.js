/*jshint expr: true*/

var rewire = require('rewire');
var routes = rewire('../../_lib/routes.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

describe('routes', function () {
  var TheBeatles = '/m/07c0j';
  var PaulMcCartney = '/m/03j24kf';
  var GeorgeHarrison = '/m/03bnv';
  var BrianJones = '/m/01p95y0';
  var ToddRundgren = '/m/095x_';
  var Afraid = '/m/0f2c414';
  var Something = '/m/0mlx6x';
  var YouKnowMyName = '/m/0fqv51t';
  var BobDylan = '/m/01vrncs';
  var CharlesMingus = '/m/024zq';
  var OriginalFaubusFables = '/m/0q69hv';
  var CharlesMingusPresentsCharlesMingus = '/m/03bc6qj';
  var revert;

  beforeEach(function () {
    if (typeof revert === 'function') {
      revert();
      revert = null;
    }
    nock.cleanAll();
    nock.disableNetConnect();
  });

  describe('getMids()', function () {
    it('should retrieve MIDs for all artists with the supplied name when artists specified', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result:
            [ { name: 'Magma', type: '/music/artist', mid: '/m/0160yj' }] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data).to.contain('/m/0160yj');

      };

      return routes.getMids('Magma', '/music/artist').then(success);
    });

    it('should retrieve MIDs for all tracks with the supplied name when tracks specified', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result:
            [ { mid: '/m/0lgj3t', type: '/music/track', name: 'Penny Lane' },
            ] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data).to.contain('/m/0lgj3t');

      };

      return routes.getMids('Penny Lane', '/music/track').then(success);
    });

    it('should retrieve only the MIDs for specified type', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { name: 'Black Sabbath', type: '/music/artist', mid: '/m/01czx' } ] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data).to.contain('/m/01czx');
        expect(data).to.not.contain('/m/0f2hrtz');

      };

      return routes.getMids('Black Sabbath', '/music/artist').then(success);
    });

    it('should return an error if there is a network error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getMids('Black Sabbath', '/music/artist').catch(failure);
    });
  });

  describe('getTracksWithContributors()', function () {
    it('should retrieve tracks with any of the supplied contributors', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { track_contributions: [{track: {mid: '/m/0mlx6x'}}], type: '/music/artist' } ] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data).to.be.array();
        expect(data).to.contain(Something);

      };

      return routes.getTracksWithContributors([PaulMcCartney], {}).then(success);
    });

    it('should return an error if there is a network error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getTracksWithContributors([PaulMcCartney], {}).catch(failure);
    });

    it('should return undefined for track_contributions for which there is no track', function () {
      // This should never happen but since we don't actually control what we get
      // back from Freebase, it conceivably could. There's a defensive coding check
      // in grabMid() so we have this test to get to 100% code coverage.
      revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
        callback(null, { result: [ { track_contributions: [{}], type: '/music/artist' } ] });
      }}});

      var success = function (data) {
        expect(data).to.equal([undefined]);

      };

      return routes.getTracksWithContributors([PaulMcCartney], {}).then(success);
    });

    it('should run subquery to omit artists specified in options', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { track_contributions: [{track: {mid: '/m/015rm3l'}}], type: '/music/artist' } ] });
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        expect(data.indexOf(Something)).to.equal(-1);

      };

      var omitTheBeatles = {
        artist: [{
          'mid|=': [TheBeatles, GeorgeHarrison],
          optional: 'forbidden'
        }]
      };

      return routes.getTracksWithContributors([PaulMcCartney], {subquery: omitTheBeatles}).then(success);
    });
  });

  describe('getTracksByArtists()', function () {
    it('should retrieve tracks by any of the supplied artists', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/artist', track: [{mid: '/m/0155j9k'}] } ] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data).to.contain('/m/0155j9k');

      };

      return routes.getTracksByArtists([PaulMcCartney]).then(success);
    });

    it('should return an error if there is a network error', {}, function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getTracksByArtists([PaulMcCartney]).catch(failure);
    });
  });

  describe('getArtistsAndContributorsFromTracks()', function () {
    it('should retrieve Beatles and Brian Jones from "You Know My Name (Look Up The Number)"', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/track', contributions: [{role:[{name:'Saxophone'}], mid:'/m/0rf6dwb',contributor:{mid:'/m/01p95y0'}}], artist: [{mid: TheBeatles}] } ] });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data.artists).to.contain({mid: TheBeatles});
        expect(data.contributors).to.contain({mid: BrianJones, roles: [{name: 'Saxophone'}]});

      };

      return routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).then(success);
    });

    it('should retrieve Todd Rundgren for "Afraid"', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/track', contributions: [], artist: [{mid: ToddRundgren}] }]});
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        expect(data.artists).to.contain({mid: ToddRundgren});

      };

      return routes.getArtistsAndContributorsFromTracks([Afraid]).then(success);
    });

    it('should retrieve Beatles, Brian Jones, and Todd Rundgren for "You Know My Name" and "Afraid"', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/track', contributions: [], artist: [{mid: ToddRundgren}] }, { type: '/music/track', contributions: [{role:[{name:'Saxophone'}], mid:'/m/0rf6dwb',contributor:{mid:'/m/01p95y0'}}], artist: [{mid: TheBeatles}] } ] });
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        expect(data.artists).to.contain({mid: TheBeatles});
        expect(data.contributors).to.contain({mid: BrianJones, roles: [{name: 'Saxophone'}]});
        expect(data.artists).to.contain({mid: ToddRundgren});

      };

      return routes.getArtistsAndContributorsFromTracks([YouKnowMyName, Afraid]).then(success);
    });

    it('should retrieve roles for contributors', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/track', contributions: [{role:[{name:'Saxophone'}], mid:'/m/0rf6dwb',contributor:{mid:'/m/01p95y0'}}], artist: [{mid: TheBeatles}] } ] });
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        expect(data.contributors).to.contain({mid: BrianJones, roles: [{name: 'Saxophone'}]});

      };

      return routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).then(success);
    });

    it('should return an error if there is a network error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).catch(failure);
    });

    it('should handle unexpected but valid JSON gracefully', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/.*/, '/')
        .get('/')
        .reply(200, '{"result": [false]}');

      var success = function (data) {
        expect(data).to.equal({artists:[], contributors: []});

      };

      return routes.getArtistsAndContributorsFromTracks([YouKnowMyName]).then(success);
    });

    it('should not return a role for artists', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: [ { type: '/music/track', contributions: [], artist: [{mid: ToddRundgren}] }]});
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        var todd = data.artists.filter(function (value) { return value.mid === ToddRundgren; });
        expect(todd.length).to.equal(1);
        todd = todd[0];
        expect(todd.hasOwnProperty('roles')).to.be.false();
        expect(todd.hasOwnProperty('role')).to.be.false();

      };

      return routes.getArtistsAndContributorsFromTracks([Afraid]).done(success);
    });
  });

  describe('fetchRoles()', function () {
    it('should retrieve a role for a contributor', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: { mid: '/m/0fqv51t', contributions: [{role:[{name: 'Saxophone'}]}], type: '/music/track' } });
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data.roles).to.equal([{name: 'Saxophone'}]);

      };

      return routes.fetchRoles(BrianJones, YouKnowMyName).done(success);
    });

    it('should reject with an error if callback is given an error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.fetchRoles(BrianJones, YouKnowMyName).done(null, failure);
    });

    it('should de-duplicate values', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: { mid: '/m/0dsz0t3', contributions: [{mid:'/m/0sj881l',role:[{name:'Piano'}],contributor:{mid:'/m/0blhx'}},{mid:'/m/0117kfc4',role:[{name:'Piano'}],contributor:{mid:'/m/0blhx'}}], type: '/music/track' } });
        }}});
      }
      // $lab:coverage:on$
      var success = function (data) {
        expect(data.roles).to.equal([{name: 'Piano'}]);

      };

      // This one has Vince Guaraldi on piano multiple times.
      return routes.fetchRoles('/m/0blhx', '/m/0dsz0t3').done(success);
    });
  });

  describe('getArtistDetails()', function () {
    it('should return the artist name', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: { mid: '/m/01vrncs', name: 'Bob Dylan' } } );
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data.name).to.equal('Bob Dylan');

      };

      return routes.getArtistDetails('/m/01vrncs').then(success);
    });

    it('should return an error if there is a network error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getArtistDetails(BobDylan).catch(failure);
    });

    it('should return undefined if data from MQL query is, somehow, null', function () {
      // Should never happen, but you know, defensive programming and all that.
      revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
        callback(null, null);
      }}});

      var success = function (data) {
        expect(data).to.be.undefined();

      };

      return routes.getArtistDetails(BobDylan).then(success);
    });
  });

  describe('getTrackDetails()', function () {
    it('should return the track name, artist, and release', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = routes.__set__({freebase: {mqlread: function (query, options, cb) {
          cb(null, { result: {
            type: '/music/track',
            tracks: [{release:{name: 'Charles Mingus Presents Charles Mingus',mid:'/m/01jhmqv'}},{release:{name: 'Charles Mingus Presents Charles Mingus',mid:'/m/0fcxzdr'}},{release:{name: 'Charles Mingus Presents Charles Mingus',mid:'/m/03bc6qj'}}],
            artist: [ {name: 'Charles Mingus', mid: '/m/024zq'} ],
            name: 'Original Faubus Fables',
            mid: '/m/0q69hv' } }
          );
        }}});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data.name).to.equal('Original Faubus Fables');
        expect(data.artists).to.equal([{
          name: 'Charles Mingus',
          mid: CharlesMingus
        }]);
        expect(data.releases).to.contain({
          name: 'Charles Mingus Presents Charles Mingus',
          mid: CharlesMingusPresentsCharlesMingus
        });

      };

      return routes.getTrackDetails(OriginalFaubusFables).then(success);
    });

    it('should return an error if there is a network error', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();

      };

      return routes.getTrackDetails(OriginalFaubusFables).catch(failure);
    });

    it('should return null if data from MQL query is, somehow, null', function () {
      // Should never happen, but you know, defensive programming and all that.
      revert = routes.__set__({freebase: {mqlread: function (query, options, callback) {
        callback(null, null);
      }}});

      var success = function (data) {
        expect(data).to.be.null();

      };

      return routes.getTrackDetails(OriginalFaubusFables).then(success);
    });
  });
});

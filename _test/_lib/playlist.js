/*jshint expr: true*/
/* global -Promise */

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

var _ = require('lodash');
var Promise = require('promise');

describe('playlist', function () {
  var revert;

  var BobDylan = '/m/01vrncs';

  beforeEach(function () {
    if (typeof revert === 'function') {
      revert();
      revert = null;
    }
    nock.cleanAll();
    nock.disableNetConnect();
  });

  describe('clear()', function () {
    it('should reset seenIndividuals', function () {
      revert = playlist.__set__({state: {seenIndividuals: ['fhqwhagads']}});
      playlist.clear();
      expect(playlist.__get__('state.seenIndividuals')).to.equal([]);
    });

    it('should reset seenTracks', function () {
      revert = playlist.__set__({state: {seenTracks: ['fhqwhagads']}});
      playlist.clear();
      expect(playlist.__get__('state.seenTracks')).to.equal([]);
    });

    it('should reset seenArtists', function () {
      revert = playlist.__set__({state: {seenArtists: ['fhqwhagads']}});
      playlist.clear();
      expect(playlist.__get__('state.seenArtists')).to.equal([]);
    });
  });

  describe('setSource()', function () {
    it('should set the source Individual', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {getArtistDetails: function () {
          return Promise.resolve({mid: BobDylan, name: 'Bob Dylan'});
        }}});
      }
      // $lab:coverage:on$

      return playlist.setSource(BobDylan)
      .then(function () {
        var resultPlaylist = playlist.__get__('state.playlist');
        var source = resultPlaylist[0].connectorToNext;
        expect(source.mid).to.equal(BobDylan);
        expect(source.name).to.equal('Bob Dylan');
      });
    });
  });

  describe('fetchNewTrack()', function () {
    it('should return an error if there is no network', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();
      };

      playlist.setSource(BobDylan);
      return playlist.fetchNewTrack().catch(failure);
    });

    it('should return content if given a valid start point', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function () {
            return Promise.resolve({mid: BobDylan, name: 'Bob Dylan'});
          },
          getTracksByArtists: function () {
            return Promise.resolve([ '/m/012lvqsy', '/m/012lyc7y', '/m/012lykjs' ]);
          },
          getArtistsAndContributorsFromTracks: function () {
            return Promise.resolve({ artists: [ { mid: BobDylan } ], contributors: [] });
          },
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0nk0qh',
              name: 'Knockin\' on Heaven\'s Door',
              artists: [ { mid: BobDylan, name: 'Bob Dylan' } ],
              releases: [ { mid: '/m/035j50b', name: 'The Bootleg Series' }]
            });
          },
          fetchRoles: function () {
            return Promise.resolve({ roles: [] });
          }
        }});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data[0].connectorToNext.mid).to.equal(BobDylan);
        expect(data[0].connectorToNext.name).to.equal('Bob Dylan');
      };

      playlist.setSource(BobDylan);
      return playlist.fetchNewTrack().done(success);
    });

    it('should populate a rolesInNext property for the previous connectorToNext when applicable', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function () {
            return Promise.resolve({mid: '/m/06mtrb', name: 'Berry Oakley'});
          },
          getTracksByArtists: function () {
            return Promise.resolve([]);
          },
          getTracksWithContributors: function () {
            return Promise.resolve(['/m/0_wjb6', '/m/0m2sjk', '/m/0q9qjb']);
          },
          getArtistsAndContributorsFromTracks: function () {
            return Promise.resolve({
              artists: [ { mid: '/m/0134tg' } ],
              contributors: [{mid: '/m/06mtrb', roles: [{name: 'Bass'}]}]
            });
          },
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0lpznv',
              name: 'Rambin\' Man',
              artists: [ { name: 'The Allman Brothers Band', mid: '/m/0134tg' } ],
              releases: [ { name: 'The Rolling Stone Collection: 1971–1973', mid: '/m/035_g2g' }]
            });
          },
          fetchRoles: function () {
            return Promise.resolve({roles: [{name: 'Bass'}]});
          }
        }});
      }
      // $lab:coverage:on$

      var success = function (data) {
        expect(data[0].connectorToNext.rolesInNext.length).to.be.above(0);
      };

      playlist.setSource('/m/06mtrb');
      return playlist.fetchNewTrack().done(success);
    });
  });

  describe('serialize()', function () {
    it('should return the playlist serialized', function () {
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
      expect(JSON.parse(serialized)).to.equal([
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
    });

    it('should truncate the playlist to first eleven items (ten tracks) before serializing', function () {
      revert = playlist.__set__({
        state: {
          playlist: _.range(50)
        }
      });

      var serialized = playlist.serialize();
      expect(serialized).to.equal('[{},{},{},{},{},{},{},{},{},{},{}]');
    });

    it('should omit details and just return the mids', function () {
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
      expect(JSON.parse(serialized)).to.equal([{
        connectorToNext: '/fhqwhagads',
        release: '/everybody-to-the-limit'
      }]);
    });
  });

  describe('deserialize()', function () {
    it('should return an Error if badly formed JSON sent', function () {
      var failure = function (err) {
        expect(err instanceof Error).to.be.true();
      };

      return playlist.deserialize('fhqwhagads')
        .catch(failure);
    });

    it('should transform connectorToNext string property to an object with a mid property', function () {
      var success = function (data) {
        expect(data).to.equal([{connectorToNext: {mid: '/fhqwhagads'}}]);
      };

      return playlist.deserialize('[{"connectorToNext": "/fhqwhagads"}]')
        .then(success);
    });

    it('should transform release string property to an object with a mid property', function () {
      var success = function (data) {
        expect(data).to.equal([{
          connectorToNext: {mid: '/fhqwhagads'},
          release: {mid: '/live-from-east-reykjavik'}
        }]);
      };

      return playlist.deserialize('[{"connectorToNext": "/fhqwhagads", "release": "/live-from-east-reykjavik"}]')
        .then(success);
    });
  });

  describe('fetchConnectorDetails()', function () {
    it('should do nothing if there is already a connectorToNext.name', function () {
      revert = playlist.__set__({
        state: {
          playlist: [
            {connectorToNext: {name: 'fhqwhagads'}},
            {}
          ]
        }
      });
      return playlist.fetchConnectorDetails(0)
      .done(function (result) {
        expect(result.connectorToNext.name).to.equal('fhqwhagads');
      });
    });

    it('should not release Zalgo', function () {
      revert = playlist.__set__({
        state: {
          playlist: [
            {connectorToNext: {name: 'fhqwhagads'}},
            {}
          ]
        }
      });
      var after = false;
      var promise = playlist.fetchConnectorDetails(0)
      .done(function () {
        expect(after).to.be.true();
      });
      after = true;
      return promise;
    });

    it('should use the artist name if the mid matches', function () {
      revert = playlist.__set__({
        state: {
          playlist: [
            {connectorToNext: {mid: '/fhqwhagads'}, artists: [{mid: '/fhqwhagads', name: 'Strong Bad'}]},
            {}
          ]
        }
      });
      return playlist.fetchConnectorDetails(0)
      .done(function (result) {
        expect(result.connectorToNext).to.equal({mid: '/fhqwhagads', name: 'Strong Bad'});
      });
    });

    it('should query Freebase for the connector details if mid is not in artists', function () {
      revert = playlist.__set__({
        routes: {
          getArtistDetails: function () {
            return Promise.resolve({name: 'Strong Bad'});
          }
        },
        state: {
          playlist: [
            {connectorToNext: {mid: '/fhqwhagads'}},
            {}
          ]
        }
      });
      return playlist.fetchConnectorDetails(0)
      .done(function () {
        expect(playlist.__get__('state').playlist[0].connectorToNext.name).to.equal('Strong Bad');
      });
    });

    it('should accept an index to select an arbitrary playlist entry', function () {
      revert = playlist.__set__({
        routes: {
          getArtistDetails: function () {
            return Promise.resolve({name: 'Strong Bad'});
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
      return playlist.fetchConnectorDetails(1)
      .done(function () {
        expect(playlist.__get__('state').playlist[1].connectorToNext.name).to.equal('Strong Bad');
      });
    });
  });

  describe('setTrackDetails()', function () {
    it('should set defaults gracefully if null object sent for details', function () {
      playlist.clear();
      return playlist.setTrackDetails({}, null)
      .done(function (trackDetails) {
        expect(trackDetails.release).to.equal('');
      });
    });

    it('should use details provided', function () {
      revert = playlist.__set__({
        state: {
          track: '/fhqwhagads',
          playlist: []
        }
      });
      var details = {releases: [{mid: '/live-from-east-reykjavik'}]};

      var expectedResults = {
        releases: [{mid: '/live-from-east-reykjavik'}],
        release: {mid: '/live-from-east-reykjavik'}
      };
      return playlist.setTrackDetails({}, details)
      .done(function (trackDetails) {
        expect(trackDetails).to.equal(expectedResults);
      });
    });
  });

  describe('hydrate()', function () {
    it('should restore track title', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0g6vkcm',
              name: 'Mean',
              artists: [ { mid: '/m/0dl567', name: 'Taylor Swift' } ],
              releases: [ { mid: '/m/0g6vkbg', name: 'Speak Now' } ]
            });
          },
          getArtistDetails: function () {
            return Promise.resolve({
              mid: '/m/0dl567',
              name: 'Taylor Swift'
            });
          },
          fetchRoles: function () {
            return Promise.resolve({roles: []});
          }
        }});
      }
      // $lab:coverage:on$
      var initial = [
        {connectorToNext: {mid: '/m/0dl567'}},
        {mid: '/m/0g6vkcm'}
      ];

      var success = function (data) {
        expect(data[1].mid).to.equal('/m/0g6vkcm');
        expect(data[1].name).to.equal('Mean');
      };

      return playlist.hydrate(initial)
      .done(success);
    });

    it('should restore artists', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0g6vkcm',
              name: 'Mean',
              artists: [ { mid: '/m/0dl567', name: 'Taylor Swift' } ],
              releases: [ { mid: '/m/0g6vkbg', name: 'Speak Now' } ]
            });
          },
          getArtistDetails: function () {
            return Promise.resolve({
              mid: '/m/0dl567',
              name: 'Taylor Swift'
            });
          },
          fetchRoles: function () {
            return Promise.resolve({roles: []});
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: '/m/0dl567'}},
        {mid: '/m/0g6vkcm'}
      ];

      var success = function (data) {
        var artists = data[1].artists;
        expect(artists.length).to.equal(1);
        var artist = artists[0];
        expect(artist.mid).to.equal('/m/0dl567');
        expect(artist.name).to.equal('Taylor Swift');
      };

      return playlist.hydrate(initial)
      .done(success);
    });

    it('should use the release provided', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0g6vkcm',
              name: 'Mean',
              artists: [ { mid: '/m/0dl567', name: 'Taylor Swift' } ],
              releases: [ { mid: '/m/0g6vkbg', name: 'Speak Later' }, {mid: '/m/0g7z202', name: 'Speak Now'} ]
            });
          },
          getArtistDetails: function () {
            return Promise.resolve({
              mid: '/m/0dl567',
              name: 'Taylor Swift'
            });
          },
          fetchRoles: function () {
            return Promise.resolve({roles: []});
          }
        }});
      }
      // $lab:coverage:on$
      var initial = [
        {connectorToNext: {mid: '/m/0dl567'}},
        {mid: '/m/0g6vkcm', release: {mid: '/m/0g7z202'}}
      ];

      var success = function (data) {
        expect(data[1].release.mid).to.equal('/m/0g7z202');
        expect('Speak Now').to.equal('Speak Now');
      };

      return playlist.hydrate(initial)
      .done(success);
    });

    it('should hydrate connectorToNext properties', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function () {
            return Promise.resolve({
              mid: '/m/0dl567',
              name: 'Taylor Swift'
            });
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: '/m/0dl567'}}
      ];

      var success = function (data) {
        var connector = data[0].connectorToNext;
        expect(connector.mid).to.equal('/m/0dl567');
        expect(connector.name).to.equal('Taylor Swift');
      };

      return playlist.hydrate(initial)
      .done(success);
    });

    it('should include roles of connectors', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function (mid) {
            var name = mid==='/m/0blhx' ? 'Vince Guaraldi' : 'Bill Holman';
            return Promise.resolve({
              mid: mid,
              name: name
            });
          },
          getTrackDetails: function (mid) {
            return Promise.resolve({
              mid: mid,
              name: 'Who Cares?',
              artists: [{name: 'Vince Guaraldi', mid: '/m/0blhx'}],
              releases: [{name: 'It Does Not Matter', mid: '/unused'}]
            });
          },
          fetchRoles: function (contributor) {
            var roles = contributor === '/m/07qbjn' ? [{ name: 'Baritone saxophone'}] : [];
            return Promise.resolve({roles: roles});
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: '/m/0blhx'}},
        {connectorToNext: {mid: '/m/0blhx'}, mid: '/m/0f7p36v', release: {mid: '/m/0flmn9r'}},
        {connectorToNext: {mid: '/m/07qbjn'}, mid: '/m/0dsz0t3', release: {mid: '/m/0dsz0t0'}}
      ];

      var success = function (data) {
        expect(data[2].connectorToNext.roles).to.equal([{name: 'Baritone saxophone'}]);
      };

      return playlist.hydrate(initial)
      .done(success);
    });

    it('should restore rolesInNext property for connectors where applicable', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function (mid) {
            return Promise.resolve({
              mid: mid,
              name: 'Does Not Matter'
            });
          },
          getTrackDetails: function (mid) {
            return Promise.resolve({
              mid: mid,
              name: 'Who Cares?',
              artists: [{name: 'Vince Guaraldi', mid: '/m/0blhx'}],
              releases: [{name: 'It Does Not Matter', mid: '/unused'}]
            });
          },
          fetchRoles: function () {
            return Promise.resolve({roles: [{name: 'Drums'}]});
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: '/m/012cfv3t'}},
        {connectorToNext: {mid: '/m/012gf52n'}, mid: '/m/01c2y4z', release: {mid: '/m/0327t5v'}},
        {connectorToNext: {mid: '/m/03qk5_f'}, mid: '/m/01c2y6q', release: {mid: '/m/0327t5v'}}
      ];

      var success = function (data) {
        expect(data[1].connectorToNext.rolesInNext.length).to.be.above(0);
      };

      return playlist.hydrate(initial)
      .done(success);
    });


    it('should hydrate even if state.playlist is empty', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function () {
            return Promise.resolve({
              mid: '/m/0dl567',
              name: 'Taylor Swift'
            });
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: '/m/0dl567'}}
      ];

      var success = function (data) {
        var connector = data[0].connectorToNext;
        expect(connector.mid).to.equal('/m/0dl567');
        expect(connector.name).to.equal('Taylor Swift');
      };

      playlist.clear();
      return playlist.hydrate(initial)
      .done(success);
    });

    it('should restore seen* properties of state', function () {
      // $lab:coverage:off$
      if (process.env.TRAVIS) {
        nock.enableNetConnect();
      } else {
        revert = playlist.__set__({routes: {
          getArtistDetails: function () {
            return Promise.resolve({
              mid: BobDylan,
              name: 'Bob Dylan'
            });
          },
          getTrackDetails: function () {
            return Promise.resolve({
              mid: '/m/0rc400',
              name: 'Idiot Wind',
              artists: [ { name: 'Bob Dylan', mid: '/m/01vrncs' } ],
              releases: [ { name: 'Blood on the Tracks', mid: '/m/0shxfbt' } ]
            });
          },
          fetchRoles: function () {
            return Promise.resolve({ roles: [] });
          }
        }});
      }
      // $lab:coverage:on$

      var initial = [
        {connectorToNext: {mid: BobDylan}},
        {artists:[{mid: BobDylan}], mid: '/m/0rc400', connectorToNext: {mid: BobDylan} }
      ];

      var success = function () {
        var state = playlist.__get__('state');
        expect(state.seenIndividuals).to.equal([BobDylan]);
        expect(state.seenArtists).to.equal([BobDylan]);
        expect(state.seenTracks).to.equal(['/m/0rc400']);
      };

      return playlist.hydrate(initial)
      .done(success);
    });
  });

  describe('validatePathOutForTrack()', function () {
    it('should return true if there is someone on the track other than the source individual', function () {
      revert = playlist.__set__({
        state: {
          foundSomeoneElse: false,
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}],
          seenTracks: ['/everybody-to-the-limit', '/the-system-is-down']
        }
      });

      var folks = {
        artists: [{mid: '/jake'}],
        contributors: [{mid: '/joe'}, {mid: '/fhqwhagads'}]
      };

      expect(playlist.validatePathOutFromTrack(folks)).to.be.true();
    });

    it('should return false if there is only the source individual on the track', function () {
      revert = playlist.__set__({
        state: {
          foundSomeoneElse: false,
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}],
          seenTracks: ['/everybody-to-the-limit', '/the-system-is-down']
        }
      });

      var folks = {
        artists: [{mid: '/fhqwhagads'}]
      };

      expect(playlist.validatePathOutFromTrack(folks)).to.be.false();
    });

    it('should return true no matter what if this is the only track we have seen', function () {
      revert = playlist.__set__({
        state: {
          foundSomeoneElse: false,
          seenTracks: ['/everybody-to-the-limit']
        }
      });

      var folks = {
        artists: [{mid: '/fhqwhagads'}]
      };

      expect(playlist.validatePathOutFromTrack(folks)).to.be.true();
    });
  });

  describe('pickATrack()', function () {
    it('should resolve if foundSomeoneElse', function () {
      revert = playlist.__set__({
        state: {
          foundSomeoneElse: true
        }
      });

      var success = function () {
      };

      return playlist.pickATrack().then(success);
    });

    it('should set atDeadEnd true and reject if no tracks', function () {
      revert = playlist.__set__({
        foundSomeoneElse: false,
        atDeadEnd: false
      });

      var tracks = [];

      var failure = function () {
        expect(playlist.__get__('atDeadEnd')).to.be.true();
      };

      return playlist.pickATrack(tracks).done(null, failure);
    });

    it('should call routes.getArtistsAndContributorsFromTracks() on tracks', function () {
      revert = playlist.__set__({
        foundSomeoneElse: false,
        atDeadEnd: false,
        state: {
          seenTracks: [{mid: '/the-system-is-down'}, {mid: '/trogdor-the-burninator'}],
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}]
        },
        routes: {
          getArtistsAndContributorsFromTracks: function () {
            return {then: function (cb) {
              return Promise.resolve(
                cb({
                  artists:[{mid: '/fhqwhagads'}],
                  contributors: [{mid: '/jake'}, {mid: '/joe'}]
                })
              );
            }};
          }
        }
      });

      var tracks = [{mid: '/everybody-to-the-limit'}];

      var success = function () {
        expect(playlist.__get__('foundSomeoneElse')).to.be.true();
      };

      return playlist.pickATrack(tracks).done(success);
    });
  });

  describe('tracksByUnseenArtists()', function () {
    it('should call routes.getTracksByArtists() if state.seenArtists is empty', function () {
      revert = playlist.__set__({
        state: {
          seenArtists: [],
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}]
        },
        routes: {
          getTracksByArtists: function () {
            return {then: function () { return 'getTracksByArtists'; }};
          }
        }
      });

      expect(playlist.tracksByUnseenArtists()).to.equal('getTracksByArtists');
    });

    it('should call routes.getTracksWithContributors() if state.seenArtists is not empty', function () {
      revert = playlist.__set__({
        state: {
          seenArtists: ['/jake', '/joe'],
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}]
        },
        routes: {
          getTracksWithContributors: function () {
            return {then: function () { return 'getTracksWithContributors'; }};
          }
        }
      });

      expect(playlist.tracksByUnseenArtists()).to.equal('getTracksWithContributors');
    });
  });

  describe('tracksWithContributor()', function () {
    it('should reject if error exists', function () {
      var error = Error();
      return playlist.tracksWithContributor(error)
        .catch(function (err) {
          expect(err).to.equal(error);
        });
    });

    it('should call routes.getTracksWithContributors()', function () {
      revert = playlist.__set__({
        state: {
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}]
        },
        routes: {
          getTracksWithContributors: function () {
            return {then: function () { return 'getTracksWithContributors'; }};
          }
        }
      });

      expect(playlist.tracksWithContributor()).to.equal('getTracksWithContributors');
    });
  });

  describe('tracksWithArtist()', function () {
    it('should reject if error exists', function () {
      var error = Error();
      return playlist.tracksWithArtist(error)
        .catch(function (err) {
          expect(err).to.equal(error);
        });
    });

    it('should call routes.getTracksWithArtists()', function () {
      playlist.__set__({
        state: {
          playlist: [{connectorToNext: {mid: '/fhqwhagads'}}]
        },
        routes: {
          getTracksByArtists: function () {
            return {then: function () { return 'getTracksByArtists'; }};
          }
        }
      });

      expect(playlist.tracksWithArtist()).to.equal('getTracksByArtists');
    });
  });

  describe('giveUpIfNoTracks()', function () {
    it('should reject with error that is sent', function () {
      var error = Error();

      return playlist.giveUpIfNoTracks(error)
        .catch(function (e) {
          expect(e).to.equal(error);
          expect(e.deadEnd).to.be.undefined();
        });
    });

    it('should reject with message constructed from state if no error sent', function () {
      revert = playlist.__set__({
        state: {
          playlist: [{
            connectorToNext: {
              mid: '/fhqwhagads',
              name: 'Fhqwhagads'
            }
          }]
        }
      });

      var handler = function (err) {
        var errTxt = err.message;
        expect(errTxt).to.equal('Playlist is at a dead end with Fhqwhagads.');
        expect(err.deadEnd).to.be.true();
      };

      return playlist.giveUpIfNoTracks()
        .catch(handler);
    });

    it('should use mid if name not present', function () {
      revert = playlist.__set__({
        state: {
          playlist: [{
            connectorToNext: {
              mid: '/fhqwhagads'
            }
          }]
        }
      });

      var handler = function (err) {
        var errTxt = err.message;
        expect(errTxt).to.equal('Playlist is at a dead end with /fhqwhagads.');
        expect(err.deadEnd).to.be.true();
      };

      return playlist.giveUpIfNoTracks()
        .catch(handler);
    });
  });

  describe('addToSeenIndividuals()', function () {
    it('should add the argument to state.seenIndividuals', function () {
      playlist.clear();
      playlist.addToSeenIndividuals('/fhqwhagads');
      expect(playlist.__get__('state').seenIndividuals).to.equal(['/fhqwhagads']);
    });

    it('should not add a duplicate individual', function () {
      playlist.clear();
      playlist.addToSeenIndividuals('/fhqwhagads');
      playlist.addToSeenIndividuals('/fhqwhagads');
      expect(playlist.__get__('state').seenIndividuals).to.equal(['/fhqwhagads']);
    });
  });

  describe('recalcSeenIndividuals()', function () {
    it('should create set state.seenIndividuals to array of connectorToNext mids plucked from playlist', function () {
      var fhqwhagads = {connectorToNext: {mid: '/fhqwhagads'}};
      var jake = {connectorToNext: {mid: '/jake'}};
      var joe = {connectorToNext: {mid: '/joe'}};
      playlist.__set__({
        state: {
          playlist: [fhqwhagads, jake, joe]
        }
      });

      playlist.recalcSeenIndividuals();
      expect(playlist.__get__('state').seenIndividuals).to.equal(['/fhqwhagads', '/jake', '/joe']);
    });

    it('should not create duplicate entries', function () {
      var fhqwhagads = {connectorToNext: {mid: '/fhqwhagads'}};

      playlist.__set__({
        state: {
          playlist: [fhqwhagads, fhqwhagads]
        }
      });

      playlist.recalcSeenIndividuals();
      expect(playlist.__get__('state').seenIndividuals).to.equal(['/fhqwhagads']);
    });
  });

  describe('recalcSeenTracks()', function () {
    it('should set state.seenTracks to array of mids plucked from playlist', function () {
      var fhqwhagads = {mid: '/fhqwhagads'};
      var jake = {mid: '/jake'};
      var joe = {mid: '/joe'};
      playlist.__set__({
        state: {
          playlist: [{}, fhqwhagads, jake, joe]
        }
      });

      playlist.recalcSeenTracks();
      expect(playlist.__get__('state').seenTracks).to.equal(['/fhqwhagads', '/jake', '/joe']);
    });

    it('should not create duplicate entries', function () {
      var fhqwhagads = {mid: '/fhqwhagads'};

      playlist.__set__({
        state: {
          playlist: [fhqwhagads, fhqwhagads]
        }
      });

      playlist.recalcSeenTracks();
      expect(playlist.__get__('state').seenTracks).to.equal(['/fhqwhagads']);
    });
  });

  describe('recalcSeenArtists()', function () {
    it('should set state.seenArtists to array of artist mids plucked from playlist', function () {
      var fhqwhagads = {artists: [{mid: '/fhqwhagads'}]};
      var jakeAndJoe = {artists: [{mid: '/jake'}, {mid: '/joe'}]};
      playlist.__set__({
        state: {
          playlist: [{}, fhqwhagads, jakeAndJoe]
        }
      });

      playlist.recalcSeenArtists();
      expect(playlist.__get__('state').seenArtists).to.equal(['/fhqwhagads', '/jake', '/joe']);
    });

    it('should not create duplicate entries', function () {
      var fhqwhagads = {artists: [{mid: '/fhqwhagads'}]};

      playlist.__set__({
        state: {
          playlist: [fhqwhagads, fhqwhagads]
        }
      });

      playlist.recalcSeenArtists();
      expect(playlist.__get__('state').seenArtists).to.equal(['/fhqwhagads']);
    });
  });

  describe('removeTrack()', function () {
    it('should remove the last track by default', function () {
      var fhqwhagads = {artists: [{mid: '/fhqwhagads'}]};
      var jakeAndJoe = {artists: [{mid: '/jake'}, {mid: '/joe'}]};
      playlist.__set__({
        state: {
          playlist: [{}, fhqwhagads, jakeAndJoe]
        }
      });

      playlist.removeTrack();
      var result = playlist.__get__('state').playlist;
      expect(result[0]).to.equal({});
      expect(result[1].artists[0].mid).to.equal('/fhqwhagads');
      expect(result[2]).to.be.undefined();
    });

    it('should remove role from previous track connectorToNext', function () {
      var fhqwhagads = {connectorToNext: {mid: '/jake', rolesInNext: ['jocking']}, artists: [{mid: '/fhqwhagads'}]};
      var jakeAndJoe = {artists: [{mid: '/jake'}, {mid: '/joe'}]};
      playlist.__set__({
        state: {
          playlist: [{}, fhqwhagads, jakeAndJoe]
        }
      });

      playlist.removeTrack();
      var result = playlist.__get__('state').playlist;
      expect(result[1].connectorToNext.rolesInNext).to.be.undefined();
    });
  });
});

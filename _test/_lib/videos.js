/*jshint expr: true*/

var videos = require('../../_lib/videos.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

describe('videos', function () {

  beforeEach(function () {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  describe('embed()', function () {
    it('should retrieve embed code', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*/, '')
        .get('/youtube/v3/videos')
        .reply(200, JSON.stringify({items: [{player: {embedHtml: '<iframe>Embedded!</iframe>'}}]}));

      var success = function (data) {
        expect(data).to.equal({items: [{embedHtml: '<iframe>Embedded!</iframe>'}]});
      };

      return videos.embed('JLpTCwOoa4M').then(success);
    });

    it('should report an error if there was an error', function () {
      nock.disableNetConnect();
      var failure = function (err) {
        expect(err).to.be.not.null();
      };

      return videos.embed('fhqwhagads').catch(failure);
    });

    it('should return an empty items array if no items were found', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*$/, '')
        .get('/youtube/v3/videos')
        .reply(200, JSON.stringify({items:[]}));

      var success = function (data) {
        expect(data.items).to.equal([]);
      };

      return videos.embed('asdkfhaskdjfhakdjhfkajsdfh').then(success);
    });

    it('should handle a missing videoId gracefully', function () {
      return videos.embed().then(function (data) {
        expect(data).to.be.undefined();
      });
    });

    it('should not release Zalgo', function () {
      var after = false;
      var promise = videos.embed().then(function () {
        expect(after).to.be.true();
      });
      after = true;
      return promise;
    });
  });

  describe('search()', function () {
    it('should retrieve information for a video', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*$/, '')
        .get('/youtube/v3/search')
        .reply(200, JSON.stringify({ items: [{ id: { videoId: 'F-QR4dY1jbQ' }}]}));

      var success = function (data) {
        expect(data).to.equal({items: [{videoId: 'F-QR4dY1jbQ'}]});
      };

      return videos.search('"The Beatles" "Strawberry Fields Forever" "Magical Mystery Tour"')
        .then(success);
    });

    it('should report an error if there was an error', function () {
      nock.disableNetConnect();
      var failure = function (err) {
        expect(err).to.be.not.null();
      };

      return videos.search('fhqwhagads').catch(failure);
    });

    it('should return an empty items array if no items were found', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*$/, '')
        .get('/youtube/v3/search')
        .reply(200, JSON.stringify({items:[]}));

      var success = function (data) {
        expect(data.items).to.equal([]);
      };

      return videos.search('asdkfhaskdjfhakdjhfkajsdfh').then(success);
    });

    it('should return an error if HTTP response code is not 200', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*$/, '')
        .get('/youtube/v3/search')
        .reply(404, JSON.stringify({}));

      var failure = function (err) {
        expect(err).to.be.not.null();
      };

      return videos.search('fhqwhagads').catch(failure);
    });

    it('should return an error if body cannot be parsed as JSON', function () {
      nock('https://www.googleapis.com')
        .filteringPath(/\?.*$/, '')
        .get('/youtube/v3/search')
        .reply(200, 'invalid JSON!');

      var failure = function (err) {
        expect(err).to.be.not.null();
      };

      return videos.search('fhqwhagads').catch(failure);
    });
  });
});

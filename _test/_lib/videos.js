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

	beforeEach(function (done) {
		nock.cleanAll();
		nock.disableNetConnect();
		done();
	});

	describe('embed()', function () {
		it('should retrieve embed code', function (done) {
			nock('https://www.googleapis.com')
				.filteringPath(/\?.*/, '')
				.get('/youtube/v3/videos')
				.reply(200, JSON.stringify({items: [{player: {embedHtml: '<iframe>Embedded!</iframe>'}}]}));

			var success = function (data) {
				expect(data).to.deep.equal({items: [{embedHtml: '<iframe>Embedded!</iframe>'}]});
				done();
			};

			videos.embed('JLpTCwOoa4M').then(success);
		});


		it('should report an error if there was an error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err).to.be.not.null();
				done();
			};

			videos.embed('fhqwhagads').catch(failure);
		});

		it('should return an empty items array if no items were found', function (done) {
			nock('https://www.googleapis.com')
			  .filteringPath(/\?.*$/, '')
				.get('/youtube/v3/videos')
				.reply(200, JSON.stringify({items:[]}));

			var success = function (data) {
				expect(data.items).to.deep.equal([]);
				done();
			};

			videos.embed('asdkfhaskdjfhakdjhfkajsdfh').then(success);
		});

	});

	describe('search()', function () {
		it('should retrieve information for a video', function (done) {
			nock('https://www.googleapis.com')
			  .filteringPath(/\?.*$/, '')
				.get('/youtube/v3/search')
				.reply(200, JSON.stringify({ items: [{ id: { videoId: 'F-QR4dY1jbQ' }}]}));

			var success = function (data) {
				expect(data).to.deep.equal({items: [{videoId: 'F-QR4dY1jbQ'}]});
				done();
			};

			videos.search('"The Beatles" "Strawberry Fields Forever" "Magical Mystery Tour"')
				.then(success);
		});

		it('should report an error if there was an error', function (done) {
			nock.disableNetConnect();
			var failure = function (err) {
				expect(err).to.be.not.null();
				done();
			};

			videos.search('fhqwhagads').catch(failure);
		});

		it('should return an empty items array if no items were found', function (done) {
			nock('https://www.googleapis.com')
			  .filteringPath(/\?.*$/, '')
				.get('/youtube/v3/search')
				.reply(200, JSON.stringify({items:[]}));

			var success = function (data) {
				expect(data.items).to.deep.equal([]);
				done();
			};

			videos.search('asdkfhaskdjfhakdjhfkajsdfh').then(success);
		});

		it('should return an error if HTTP response code is not 200', function (done) {
			nock('https://www.googleapis.com')
			  .filteringPath(/\?.*$/, '')
				.get('/youtube/v3/search')
				.reply(404, JSON.stringify({}));

			var failure = function (err) {
				expect(err).to.be.not.null();
				done();
			};

			videos.search('fhqwhagads').catch(failure);
		});

		it('should return an error if body cannot be parsed as JSON', function (done) {
			nock('https://www.googleapis.com')
			  .filteringPath(/\?.*$/, '')
				.get('/youtube/v3/search')
				.reply(200, 'invalid JSON!');

			var failure = function (err) {
				expect(err).to.be.not.null();
				done();
			};

			videos.search('fhqwhagads').catch(failure);
		});
	});
});

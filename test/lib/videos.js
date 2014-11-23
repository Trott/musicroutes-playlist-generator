/*jshint expr: true*/

var rewire = require('rewire');
var videos = rewire('../../lib/videos.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

describe('exports', function () {
	var revert;

	beforeEach(function (done) {
		if (typeof revert === 'function') {
			revert();
			revert = null;
		}
		nock.enableNetConnect();
		done();
	});

	describe('search()', function () {
		it('should retrieve information for a video', function (done) {
			revert = videos.__set__('youtube', {search: {list: function (opts, callback) {
				callback(null, { items: [{ id: { videoId: 'F-QR4dY1jbQ' }}]});
			}}});

			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data).to.deep.equal({items: [{url: 'https://youtu.be/F-QR4dY1jbQ'}]});
				done();
			};

			videos.search('"The Beatles" "Strawberry Fields Forever" "Magical Mystery Tour"', callback);
		});

		it('should report an error if there was an error', function (done) {
			nock.disableNetConnect();
			var callback = function (err, data) {
				expect(err).to.be.not.null();
				expect(data).to.be.undefined();
				done();
			};

			videos.search('fhqwhagads', callback);
		});

		it('should return an empty items array if no items were found', function (done) {
			revert = videos.__set__('youtube', {search: {list: function (opts, callback) {
				callback(null, { items: []});
			}}});
			
			var callback = function (err, data) {
				expect(err).to.be.null();
				expect(data.items).to.be.empty();
				done();
			};

			videos.search('asdkfhaskdjfhakdjhfkajsdfh', callback);
		});
	});
});
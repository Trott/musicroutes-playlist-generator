/*jshint expr: true*/

var videos = require('../../lib/videos.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var nock = require('nock');

describe('exports', function () {
	beforeEach(function (done) {
		nock.enableNetConnect();
		done();
	});

	describe('search()', function () {
		it('should retrieve information for a video', function (done) {
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
	});
});
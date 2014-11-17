/*jshint expr: true*/

var rewire = require('rewire');
var routes = rewire('../index.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;

describe('exports', function () {
	describe('getArtistMids()', function () {
		it('should retrieve MIDs for all artists with the supplied name', function (done) {
			var callback = function (err, data) {
				expect(data).to.contain('/m/0160yj');
				done();
			};

			routes.getArtistMids('Magma', callback);
		});
	});
});

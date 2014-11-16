/*jshint expr: true*/

var routes = require('../index.js');

// var nock = require('nock');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;

describe('exports', function () {
	it('should expose getAll()', function (done) {
		expect(routes.getAll).to.be.a.function();
		done();
	});
});

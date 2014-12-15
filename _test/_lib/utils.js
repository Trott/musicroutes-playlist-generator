/*jshint expr: true*/

var utils = require('../../_lib/utils.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;

var $ = require('cheerio');

describe('exports', function () {

	describe('anchorFromMid()', function () {
		it('should reutrn an anchor (<a>) element', function (done) {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.is('a')).to.be.true();
			done();			
		});

		it('should use mid for href but text for label if text sent', function (done) {
			var rv = utils.anchorFromMid($, '/fhqwhagads', 'Everybody To The Limit!');
			expect(rv.text()).to.equal('Everybody To The Limit!');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});

		it('should use mid for href and label if no text sent', function (done) {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});

		it('should be set to open in a new browser window or tab', function (done) {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.attr('target')).to.equal('_blank');
			done();
		});
	});
});

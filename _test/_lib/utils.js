/*jshint expr: true*/

var rewire = require('rewire');
var utils = rewire('../../_lib/utils.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;

var $ = require('cheerio');

describe('exports', function () {

	var revert;

	beforeEach(function (done) {
		if (typeof revert === 'function') {
			revert();
			revert = null;
		}
		done();
	});

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

	describe('searchForVideoFromTrackDetails()', function () {
		beforeEach(function (done) {
			revert = utils.__set__({videos: {search: function (q) { return q; }}});
			done();
		});

		it('should assemble trackDetails with each entity surrounded by quotation marks', function (done) {
			var trackDetails = {
				name: 'Everybody To The Limit!',
				artists: [{name: 'Strong Bad'}, {name: 'The Cheat'}],
				release: {name: 'Come On, fhqwhagads'}
			};

			var rv = utils.searchForVideoFromTrackDetails(trackDetails);

			expect(rv).to.equal('"Everybody To The Limit!" "Strong Bad" "The Cheat" "Come On, fhqwhagads"');
			done();
		});

		it('should gracefully handle missing properties', function (done) {
			var rv = utils.searchForVideoFromTrackDetails();
			expect(rv).to.equal('');
			done();
		});

		it('should gracefully handle empty missing nested properties', function (done) {
			var trackDetails = {
				artists: [{}],
				release: {}
			};

			var rv = utils.searchForVideoFromTrackDetails(trackDetails);

			expect(rv).to.equal('');
			done();
		});
	});

	describe('extractVideoId', function () {
		it('should return the first videoId in the array of items', function (done) {
			var data = {items: [{videoId: 'fhqwhagads'}, {videoId: 'jake'}, {videoId: 'joe'}]};

			expect(utils.extractVideoId(data)).to.equal('fhqwhagads');
			done();
		});

		it('should handle an item with no videoId gracefully', function (done) {
			var data = {items:[{}]};

			expect(utils.extractVideoId(data)).to.be.undefined();
			done();
		});

		it('should handle an empty items array gracefully', function (done) {
			var data = {items:[]};

			expect(utils.extractVideoId(data)).to.be.undefined();
			done();
		});

		it('should handle a missing items array gracefully', function (done) {
			var data = {};

			expect(utils.extractVideoId(data)).to.be.undefined();
			done();
		});

		it('should handle a missing data object gracefully', function (done) {
			expect(utils.extractVideoId()).to.be.undefined();
			done();
		});
	});
});

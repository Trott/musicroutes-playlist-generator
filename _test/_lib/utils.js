/*jshint expr: true*/
/* global -Promise */

var rewire = require('rewire');
var utils = rewire('../../_lib/utils.js');

var Code = require('code');
var expect = Code.expect;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var it = lab.test;

var $ = require('cheerio');

var Promise = require('promise');

describe('utils', function () {
	utils.__set__({
		videos: {
			search: function (q) { return q; },
			embed: function (videoId) { return videoId; }
		}
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

		it('should return empty element if no mid', function (done) {
			var rv = utils.anchorFromMid($);
			expect(rv).to.deep.equal($());
			done();
		});
	});

	describe('trackAnchor()', function () {
		it('should return anchor text with name attribute if it exists', function (done) {
			var rv = utils.trackAnchor($, {mid: '/fhqwhagads', name: 'Everybody To The Limit!'});
			expect(rv.text()).to.equal('"Everybody To The Limit!"');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});

		it('should return anchor text with mid if no name attribute', function (done) {
			var rv = utils.trackAnchor($, {mid: '/fhqwhagads'});
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});
	});

	describe('artistAnchors()', function () {
		it('should separate multiple artists by ampersands', function (done) {
			var rv = utils.artistAnchors($, [{mid: '/abc', name: 'Jake'}, {mid: '/123', name: 'Joe'}]);
			expect(rv.text()).to.equal('Jake & Joe');
			done();
		});

		it('should use the mid if the name attribute is missing', function (done) {
			var rv = utils.artistAnchors($, [{mid: '/fhqwhagads'}]);
			expect(rv.text()).to.equal('/fhqwhagads');
			done();
		});

		it('should use the mid for the href', function (done) {
			var rv = utils.artistAnchors($, [{mid: '/fhqwhagads', name: 'Strong Bad'}]);
			expect(rv.text()).to.equal('Strong Bad');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});
	});


	describe('releaseAnchor()', function () {
		it('should return anchor text with name attribute if it exists', function (done) {
			var rv = utils.releaseAnchor($, {mid: '/fhqwhagads', name: 'Everybody To The Limit!'});
			expect(rv.text()).to.equal('Everybody To The Limit!');
			expect(rv.find('a').attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});

		it('should return anchor text with mid if no name attribute', function (done) {
			var rv = utils.releaseAnchor($, {mid: '/fhqwhagads'});
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
			done();
		});

		it('should return empty element if no mid', function (done) {
			var rv = utils.releaseAnchor($);
			expect(rv).to.deep.equal($());
			done();
		});
	});

	describe('mergeArtistsAndContributors()', function () {
		it('should return an array of de-duplicated mids', function (done) {
			var artists = [{mid: '/fhqwhagads'}, {mid: '/jake'}];
			var contributors = [{mid: '/fhqwhagads'}, {mid: '/joe'}];
			var rv = utils.mergeArtistsAndContributors(artists, contributors);

			expect(rv.length).to.equal(3);
			expect(rv).to.contain('/fhqwhagads');
			expect(rv).to.contain('/jake');
			expect(rv).to.contain('/joe');
			done();
		});
	});

	describe('pickContributor()', function () {
		it('should return a candidate from the new candidate pool', function (done) {
			var rv = utils.pickContributor(['/fhqwhagads'], ['/fhqwhagads', '/jake', '/joe'], '/jake');
			expect(rv).to.equal('/fhqwhagads');
			done();
		});

		it('should return a candidate from the all-candidates pool excluding source individual if no new candidates', function (done) {
			var rv = utils.pickContributor([], ['/fhqwhagads', '/jake'], '/jake');
			expect(rv).to.equal('/fhqwhagads');
			done();
		});

		it('should return the source individual if there is not other option', function (done) {
			var rv = utils.pickContributor([], ['/fhqwhagads'], '/fhqwhagads');
			expect(rv).to.equal('/fhqwhagads');
			done();
		});
	});

	describe('promiseUntil()', function () {
		it('should resolve promise if condition is true', function (done) {
			utils.promiseUntil(
				function () { return true; }
			).then(function () {
				done();
			});
		});

		it('should reject if action rejects', function (done) {
			utils.promiseUntil(
				function () { return false; },
				function () { return Promise.reject(Error('fhqwhagads'));}
			).catch(function (err) {
				expect(err.message).to.equal('fhqwhagads');
				done();
			});
		});
	});

	describe('searchForVideoFromTrackDetails()', function () {
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

	describe('getVideoEmbedCode()', function () {
		it('should request embed code for provided videoId', function (done) {
			expect(utils.getVideoEmbedCode('fhqwhagads')).to.equal('fhqwhagads');
			done();
		});

		it('should handle a missing videoId gracefully', function (done) {
			expect(utils.getVideoEmbedCode()).to.be.undefined();
			done();
		});
	});

	describe('wrapVideo()', function () {
		it('should wrap the embedHtml property in divs for scaling', function (done) {
			var data = {items: [{embedHtml: '<iframe>fhqwhagads</iframe>'}]};

			expect(utils.wrapVideo(data)).to.equal('<div class="video-outer-wrapper"><div class="video-inner-wrapper"><iframe>fhqwhagads</iframe></div></div>');
			done();
		});

		it('should return an empty string if no embedHtml property exists', function (done) {
			expect(utils.wrapVideo()).to.equal('');
			done();
		});
	});
});

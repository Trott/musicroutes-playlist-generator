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
		}
	});

	describe('anchorFromMid()', function () {
		it('should reutrn an anchor (<a>) element', function () {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.is('a')).to.be.true();
		});

		it('should use mid for href but text for label if text sent', function () {
			var rv = utils.anchorFromMid($, '/fhqwhagads', 'Everybody To The Limit!');
			expect(rv.text()).to.equal('Everybody To The Limit!');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});

		it('should use mid for href and label if no text sent', function () {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});

		it('should be set to open in a new browser window or tab', function () {
			var rv = utils.anchorFromMid($, '/fhqwhagads');
			expect(rv.attr('target')).to.equal('_blank');
		});

		it('should return empty element if no mid', function () {
			var rv = utils.anchorFromMid($);
			expect(rv).to.equal($());
		});
	});

	describe('trackAnchor()', function () {
		it('should return anchor text with name attribute if it exists', function () {
			var rv = utils.trackAnchor($, {mid: '/fhqwhagads', name: 'Everybody To The Limit!'});
			expect(rv.text()).to.equal('"Everybody To The Limit!"');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});

		it('should return anchor text with mid if no name attribute', function () {
			var rv = utils.trackAnchor($, {mid: '/fhqwhagads'});
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});
	});

	describe('artistAnchors()', function () {
		it('should separate multiple artists by ampersands', function () {
			var rv = utils.artistAnchors($, [{mid: '/abc', name: 'Jake'}, {mid: '/123', name: 'Joe'}]);
			expect(rv.text()).to.equal('Jake & Joe');
		});

		it('should use the mid if the name attribute is missing', function () {
			var rv = utils.artistAnchors($, [{mid: '/fhqwhagads'}]);
			expect(rv.text()).to.equal('/fhqwhagads');
		});

		it('should use the mid for the href', function () {
			var rv = utils.artistAnchors($, [{mid: '/fhqwhagads', name: 'Strong Bad'}]);
			expect(rv.text()).to.equal('Strong Bad');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});
	});


	describe('releaseAnchor()', function () {
		it('should return anchor text with name attribute if it exists', function () {
			var rv = utils.releaseAnchor($, {mid: '/fhqwhagads', name: 'Everybody To The Limit!'});
			expect(rv.text()).to.equal('Everybody To The Limit!');
			expect(rv.find('a').attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});

		it('should return anchor text with mid if no name attribute', function () {
			var rv = utils.releaseAnchor($, {mid: '/fhqwhagads'});
			expect(rv.text()).to.equal('/fhqwhagads');
			expect(rv.attr('href')).to.equal('http://freebase.com/fhqwhagads');
		});

		it('should return empty element if no mid', function () {
			var rv = utils.releaseAnchor($);
			expect(rv).to.equal($());
		});
	});

	describe('mergeArtistsAndContributors()', function () {
		it('should return an array of de-duplicated mids', function () {
			var artists = [{mid: '/fhqwhagads'}, {mid: '/jake'}];
			var contributors = [{mid: '/fhqwhagads'}, {mid: '/joe'}];
			var rv = utils.mergeArtistsAndContributors(artists, contributors);

			expect(rv.length).to.equal(3);
			expect(rv).to.contain('/fhqwhagads');
			expect(rv).to.contain('/jake');
			expect(rv).to.contain('/joe');
		});
	});

	describe('pickContributor()', function () {
		it('should return a candidate from the new candidate pool', function () {
			var rv = utils.pickContributor(['/fhqwhagads'], ['/fhqwhagads', '/jake', '/joe'], '/jake');
			expect(rv).to.equal('/fhqwhagads');
		});

		it('should return a candidate from the all-candidates pool excluding source individual if no new candidates', function () {
			var rv = utils.pickContributor([], ['/fhqwhagads', '/jake'], '/jake');
			expect(rv).to.equal('/fhqwhagads');
		});

		it('should return the source individual if there is not other option', function () {
			var rv = utils.pickContributor([], ['/fhqwhagads'], '/fhqwhagads');
			expect(rv).to.equal('/fhqwhagads');
		});
	});

	describe('promiseUntil()', function () {
		it('should resolve promise if condition is true', function () {
			utils.promiseUntil(
				function () { return true; }
			).then(function () {
			});
		});

		it('should reject if action rejects', function () {
			utils.promiseUntil(
				function () { return false; },
				function () { return Promise.reject(Error('fhqwhagads'));}
			).catch(function (err) {
				expect(err.message).to.equal('fhqwhagads');
			});
		});

    it('should not release Zalgo', function () {
      var after = false;
      utils.promiseUntil(
        function () { return true; }
      ).then(function () {
        expect(after).to.be.true();
      });
      after = true;
    });
	});

	describe('searchForVideoFromTrackDetails()', function () {
		it('should assemble trackDetails with each entity surrounded by quotation marks', function () {
			var trackDetails = {
				name: 'Everybody To The Limit!',
				artists: [{name: 'Strong Bad'}, {name: 'The Cheat'}],
				release: {name: 'Come On, fhqwhagads'}
			};

			var rv = utils.searchForVideoFromTrackDetails(trackDetails);

			expect(rv).to.equal('"Everybody To The Limit!" "Strong Bad" "The Cheat" "Come On, fhqwhagads"');
		});

		it('should gracefully handle missing properties', function () {
			var rv = utils.searchForVideoFromTrackDetails();
			expect(rv).to.equal('');
		});

		it('should gracefully handle empty missing nested properties', function () {
			var trackDetails = {
				artists: [{}],
				release: {}
			};

			var rv = utils.searchForVideoFromTrackDetails(trackDetails);

			expect(rv).to.equal('');
		});
	});

	describe('extractVideoId', function () {
		it('should return the first videoId in the array of items', function () {
			var data = {items: [{videoId: 'fhqwhagads'}, {videoId: 'jake'}, {videoId: 'joe'}]};

			expect(utils.extractVideoId(data)).to.equal('fhqwhagads');
		});

		it('should handle an item with no videoId gracefully', function () {
			var data = {items:[{}]};

			expect(utils.extractVideoId(data)).to.be.undefined();
		});

		it('should handle an empty items array gracefully', function () {
			var data = {items:[]};

			expect(utils.extractVideoId(data)).to.be.undefined();
		});

		it('should handle a missing items array gracefully', function () {
			var data = {};

			expect(utils.extractVideoId(data)).to.be.undefined();
		});

		it('should handle a missing data object gracefully', function () {
			expect(utils.extractVideoId()).to.be.undefined();
		});
	});

	describe('wrapVideo()', function () {
		it('should wrap the embedHtml property in divs for scaling', function () {
			var data = {items: [{embedHtml: '<iframe>fhqwhagads</iframe>'}]};

			expect(utils.wrapVideo(data)).to.equal('<div class="video-outer-wrapper"><div class="video-inner-wrapper"><iframe>fhqwhagads</iframe></div></div>');
		});

		it('should return an empty string if no embedHtml property exists', function () {
			expect(utils.wrapVideo()).to.equal('');
		});
	});
});

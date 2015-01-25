/* global -Promise */
var videos = require('./videos.js');
var Promise = require('promise');
var _ = require('lodash');

var anchorFromMid = exports.anchorFromMid = function ($, mid, text) {
	if (! mid) {
		return $();
	}
	text = text || mid;
	return $('<a>')
		.attr('href', 'http://freebase.com' + mid)
		.attr('target', '_blank')
		.text(text);
};

exports.trackAnchor = function ($, track) {
	if (track.name) {
		return anchorFromMid($, track.mid, '"' + track.name + '"');
	}
	return anchorFromMid($, track.mid);
};

exports.artistAnchors = function ($, artists) {
	var container = $('<div>');
	var needsAmpersand = false;
	_.forEach(artists, function (value) {
		if (needsAmpersand) {
			container.append($('<span>').text(' & '));
		}
		container.append(anchorFromMid($, value.mid, value.name));
		needsAmpersand = true;
	});
	return container.children();
};

exports.releaseAnchor = function ($, release) {
	if (_.result(release, 'name')) {
		return $('<i>').append(anchorFromMid($, release.mid, release.name));
	}

	return anchorFromMid($, _.result(release, 'mid'));
};

exports.mergeArtistsAndContributors = function (artists, contributors) {
	var myArtists = _.pluck(artists, 'mid');
	var myContributors = _.pluck(contributors, 'mid');
	return _.union(myArtists, myContributors);
};

exports.pickContributor = function (newCandidates, allCandidates, sourceIndividual) {
	if (newCandidates.length > 0) {
			return _.sample(newCandidates);
	}
	return _.sample(_.without(allCandidates, sourceIndividual)) || sourceIndividual;
};

exports.promiseUntil = function(condition, action) {
  var loop = function() {
    if (condition()) {
      return Promise.resolve();
    }

    return action().then(loop).catch(Promise.reject);
  };
  return loop();
};

exports.searchForVideoFromTrackDetails = function (trackDetails) {
	var q = '';

	var track = _.result(trackDetails, 'name');
	if (track) {
		q = '"' + track + '" ';
	}

	var artists = _.result(trackDetails, 'artists');
	q = q + _.reduce(artists, function (rv, artist) { return artist.name ? rv + '"' + artist.name + '" ' : rv;}, '');

	var release = _.result(trackDetails, 'release');
	if (release) {
		var releaseName = _.result(release, 'name');
		if (releaseName) {
			q = q + '"' + releaseName + '"';
		}
	}

	return videos.search(q);
};

exports.extractVideoId = function (data) {
	var items = _.result(data, 'items');
	var first = _.first(items);
	return _.result(first, 'videoId');
};

exports.wrapVideo = function (data) {
	var items = _.result(data, 'items');
	var first = _.first(items);
	var iframe = _.result(first, 'embedHtml');
	// Yes, we're trusting YouTube's API not to p0wn us.
	var embedCode = '';
	if (iframe) {
		embedCode = '<div class="video-outer-wrapper"><div class="video-inner-wrapper">' +
			iframe +
			'</div></div>';
	}
	return embedCode;
};

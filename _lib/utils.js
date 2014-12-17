var videos = require('./videos.js');
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

exports.getVideoEmbedCode = function (videoId) {
	return videoId && videos.embed(videoId);
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
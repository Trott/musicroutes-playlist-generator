/* global -Promise */
var routes = require('./routes.js');
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

var promiseUntil = exports.promiseUntil = function(condition, action) {
  var loop = function() {
    if (condition()) {
      return Promise.resolve();
    }

    return action().then(loop).catch(Promise.reject);
  };
  return loop();
};

var validatePathOutFromTrack = exports.validatePathOutFromTrack = function (state, folks) {
  if (state.seenTracks.length === 1) {
    return true;
  }
  var myArtists = _.pluck(folks.artists, 'mid'); 
  var myContributors = _.pluck(folks.contributors, 'mid');
  folks = _.union(myArtists, myContributors);
  var contributorPool = _.difference(folks, [state.sourceIndividual.mid]);
  // Only accept this track if there's someone else associated with it...
  // ...unless this is the very first track in which case, pick anything and
  // get it in front of the user pronto.
  return contributorPool.length > 0;
};

var findTrackWithPathOut = function (state, tracks) {
	var track; 

  return promiseUntil(
    function() { return state.foundSomeoneElse || state.atDeadEnd; },
    function() {
      track = _.sample(tracks);
      if (! track) {
        state.atDeadEnd = true;
        return Promise.reject();
      }
      state.seenTracks.push(track);
      tracks = _.pull(tracks, track);

      return routes.getArtistsAndContributorsFromTracks([track])
        .then(validatePathOutFromTrack.bind(undefined, state))
        .then(function (useIt) { 
        	state.foundSomeoneElse = useIt;
        });
    }
  ).then(function () {
  	return track;
  });
};

var pickATrack = exports.pickATrack = function (state, tracks) {
  state.atDeadEnd = false;
  var notSeenTracks = _.difference(tracks, state.seenTracks);

  return findTrackWithPathOut(state, notSeenTracks);
};

exports.tracksByUnseenArtists = function (state) {
  var promise;

  var optionsNewArtistsOnly = {subquery: {
    artist: [{
      'mid|=': state.seenArtists,
      optional: 'forbidden'
    }]
  }};

  if (state.seenArtists.length === 0) {
    // If this is the first track, get one by this artist if we can.
    promise = routes.getTracksByArtists([state.sourceIndividual.mid]);
  }  else {
    // Otherwise, get one by an artist we haven't seen yet
    promise = routes.getTracksWithContributors([state.sourceIndividual.mid], optionsNewArtistsOnly);
  }

  return promise.then(pickATrack.bind(undefined, state));
};

// Look for any track with this contributor credited as a contributor regardless if we've seen the artist already.
exports.tracksWithContributor = function (state, err) {
  if (err) {
    return Promise.reject(err);
  }

  return routes.getTracksWithContributors([state.sourceIndividual.mid], {}).then(pickATrack.bind(undefined, state));
};

// Look for any tracks actually credited to this contributor as the main artist. We are desperate!
exports.tracksWithArtist = function (state, err) {
  if (err) {
    return Promise.reject(err);
  }

  return routes.getTracksByArtists([state.sourceIndividual.mid]).then(pickATrack.bind(undefined, state));
};

// Give up if we haven't found anything we can use yet
exports.giveUpIfNoTracks = function (state, err) {
  if (err) {
    return Promise.reject(err);
  }
  state.atDeadEnd = true;
  var previousConnector = _.last(state.playlist).connectorToNext;
  var msg = 'Playlist is at a dead end with ';
  if (previousConnector.name) {
  	msg = msg + previousConnector.name;
  } else {
  	msg = msg + previousConnector.mid;
  }
  msg = msg + '.';
  var myError = Error(msg);
  myError.deadEnd = true;
  return Promise.reject(myError);
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
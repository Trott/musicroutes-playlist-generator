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

exports.formatPreviousConnectorName = function (state) {
	// Get properly rendered name if we don't yet have one for the previous connector.
	// Basically, if this is the first connection and the user entered 'janelle monae'
	// we want to render it as 'Janelle Monae'. Ditto for missing umlauts and whatnot.
	// So just pull from state.trackDetails if it's there.

	if (! state.previousConnector.name) {
		var matching = _.where(state.trackDetails.artists, {mid: state.previousConnector.mid});
		if (matching[0]) {
			state.previousConnector.name = matching[0].name;
		}
	}

	// If they are a contributor and not the artist, we have to go out and fetch their details.
	// This will happen on the first track if the user searches for, say, 'berry oakley'.
	if (! state.previousConnector.name) {
		return routes.getArtistDetails(state.previousConnector.mid)
		.then(function (value) {state.previousConnector.name = value.name;});
	}
	return state.previousConnector.name;
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

exports.renderConnector = function ($, details, state) {
	var previous;
	var current;

	var renderNameOrMid = function (details) {
		return anchorFromMid($, details.mid, details.name);
	};

	var p = $('<p>');

	previous = $('<b>').append(renderNameOrMid(state.previousConnector));
	p.append(previous);
	
	if (state.previousConnector.mid !== details.mid) {
		current = $('<b>').append(renderNameOrMid(details));
		p.append(' recorded with ').append(current);
		if (state.sourceIndividual.roles) {
			p.append($('<span>').text(' (' + _.pluck(state.sourceIndividual.roles, 'name').join(', ') + ')'));
		}
		p.append(' on:');
	} else {
		p.append(' appeared on:');
	}

	state.previousConnector = details;
	return p;
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
  return promiseUntil(
    function() { return state.foundSomeoneElse || state.atDeadEnd; },
    function() {
      state.track = _.sample(tracks);
      if (! state.track) {
        state.atDeadEnd = true;
        return Promise.reject();
      }
      state.seenTracks.push(state.track);
      tracks = _.pull(tracks, state.track);

      return routes.getArtistsAndContributorsFromTracks([state.track])
        .then(validatePathOutFromTrack.bind(undefined, state))
        .then(function (useIt) { state.foundSomeoneElse = useIt; });
    }
  );
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

exports.setTrackDetails = function (state, details) {
  state.trackDetails = details || {};
  state.trackDetails.mid = state.track;
  state.trackDetails.release = _.sample(state.trackDetails.releases) || '';
  return state.trackDetails;
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
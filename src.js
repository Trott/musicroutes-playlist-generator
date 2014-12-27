/*global document*/
/*global window*/
var routes = require('./_lib/routes.js');
var playlist = require('./_lib/playlist.js');
var utils = require('./_lib/utils.js');
var async = require('async');
var $ = require('jquery');
var _ = require('lodash');
var url = require('url');
var querystring = require('querystring');

var resultsElem = $('#results');
var form = $('#startPlaylist');
var submit = $('#startPointSubmit');
var input = $('#startPoint');
var paperInput = $('#paperStartPoint');
var continueButtons = $('.continue');
var resetButtons = $('.reset');
var startOverButtons = $('.startOver');
var progress = $('#progress');
var formInstructions = $('.form-instructions');

var sourceIndividual;

var error = function (err, options) {
  options = options || {};
  if (err) {
    if (err instanceof Error) {
      var p = $('<p>').text(err.message);
      resultsElem.append($('<paper-shadow>').addClass('error').append(p));
      console.log(err.stack);
    } else if (err instanceof $) {
      resultsElem.append(err);
    }
    progress.removeAttr('active');
    resetButtons.css('visibility', 'visible');
    startOverButtons.css('visibility', 'visible');
    if (! options.preserveUrl) {
      window.history.replaceState({}, '', '?' + querystring.stringify({l: playlist.serialize()}));
    }
    if (! err.deadEnd) {
      continueButtons.css('visibility', 'visible');
    }
  }
};

var renderTrackDetails = function (trackDetails) {
  var p = $('<p>').attr('class', 'track-details');
  p.append(utils.trackAnchor($, trackDetails));
  p.append($('<br>'));
  p.append(utils.artistAnchors($, trackDetails.artists));
  p.append($('<br>'));
  p.append(utils.releaseAnchor($, trackDetails.release));
  resultsElem.append(p);
  return trackDetails;
};

var videoBlock = function (trackData) {
  return utils.searchForVideoFromTrackDetails(trackData)
    .then(utils.extractVideoId)
    .then(utils.getVideoEmbedCode)
    .then(utils.wrapVideo)
    .then(function (embedCode) { resultsElem.append(embedCode); });
};

var renderConnector = function (playlistData) {
  var previous;
  var current;

  var renderNameOrMid = function (details) {
    return utils.anchorFromMid($, details.mid, details.name);
  };

  var p = $('<p>');

  var previousConnector = playlistData[playlistData.length - 2].connectorToNext;
  previous = $('<b>').append(renderNameOrMid(previousConnector));
  p.append(previous);

  var currentConnector = _.last(playlistData).connectorToNext;

  if (previousConnector.mid !== currentConnector.mid) {
    current = $('<b>').append(renderNameOrMid(currentConnector));
    p.append(' recorded with ').append(current);
    if (currentConnector.roles) {
      p.append($('<span>').text(' (' + _.pluck(currentConnector.roles, 'name').join(', ') + ')'));
    }
    p.append(' on:');
  } else {
    p.append(' appeared on:');
  }

  resultsElem.append(p);
  return playlistData[1];
};

var go = function () {
  // If lookupUserInput() didn't find an individual, don't do anything.
  if (!sourceIndividual) {
    return;
  }
  continueButtons.css('visibility', 'hidden');
  resetButtons.css('visibility', 'hidden');
  startOverButtons.css('visibility', 'hidden');
  progress.attr('active', 'active');
  var loopCount = 0;
  async.until(
    function () {
      return loopCount > 4;
    },
    function (next) {
      loopCount = loopCount + 1;
      playlist.fetchNewTrack()
      .then(renderConnector)
      .then(renderTrackDetails)
      .then(videoBlock)
      .then(next, next);
    },
    function (err) {
      if (err) {
        error(err);
      } else {
        progress.removeAttr('active');
        continueButtons.css('visibility', 'visible');
        resetButtons.css('visibility', 'visible');
        startOverButtons.css('visibility', 'visible');
        window.history.replaceState({}, '', '?' + querystring.stringify({l: playlist.serialize()}));
      }
    }
  );
};

continueButtons.on('click', go);

var resetForm = function () {
  continueButtons.css('visibility', 'hidden');
  resetButtons.css('visibility', 'hidden');
  startOverButtons.css('visibility', 'hidden');
  submit.removeAttr('disabled');
  input.removeAttr('disabled');
  paperInput.removeAttr('disabled');
  input.val('');
  input.focus();
};

var clearRoute = function () {
  playlist.clear();
  resultsElem.empty();
};

resetButtons.on('click', function () {
  clearRoute();
  window.history.replaceState({}, '', '?');
  resetForm();
});

startOverButtons.on('click', function () {
  clearRoute();
  form.trigger('submit');
});

var formHandler = function (evt) {
  evt.preventDefault();
  
  var startingPoint = input.val().trim();
  if (! startingPoint) {
    return;
  }

  submit.attr('disabled', 'disabled');
  input.attr('disabled', 'disabled');
  paperInput.attr('disabled', 'disabled');
  resultsElem.empty();
  progress.attr('active', 'active');
  window.history.replaceState({}, '', '?' + querystring.stringify({q: startingPoint}));
  var lookupUserInput = function(mids) {
    sourceIndividual = mids[0];
    if (! sourceIndividual) {
      resultsElem.text('Could not find an artist named ' + startingPoint);
      progress.removeAttr('active');
      resetForm();
      return;
    }
    return playlist.setSource(sourceIndividual);
  };

  routes.getMids(startingPoint, '/music/artist').then(lookupUserInput).then(go).catch(error);
};

form.on('submit', formHandler);
submit.on('click', formHandler);

$(document).ready(function () {
  var urlParts = url.parse(window.location.href, true);
  if (urlParts.query.q) {
    input.val(urlParts.query.q);
    formInstructions.empty();
    input.focus(); // Needed so paper elements floating label appears
    form.trigger('submit');
  }
  if (urlParts.query.l) {
    submit.attr('disabled', 'disabled');
    input.attr('disabled', 'disabled');
    paperInput.attr('disabled', 'disabled');
    progress.attr('active', 'active');

    playlist.deserialize(urlParts.query.l)
    .then(playlist.hydrate)
    .then(function (data) {
      var start = _.result(_.first(data), 'connectorToNext');
      input.val(start.name || start.mid);

      console.log(data);
    })
    .catch(function (err) {
      playlist.clear();
      err.message = 'Could not restore playlist: ' + err.message;
      error(err, {preserveUrl: true});
    });

    // render remaining elements
    // re-enable buttons and turn of progress indicator
  }
});

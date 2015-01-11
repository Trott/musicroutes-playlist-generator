/*global document*/
/*global window*/
/*global ga*/
/*global -Promise*/
var routes = require('./_lib/routes.js');
var playlist = require('./_lib/playlist.js');
var utils = require('./_lib/utils.js');
var $ = require('jquery');
var _ = require('lodash');
var url = require('url');
var querystring = require('querystring');
var Promise = require('promise');

var resultsElem = $('#results');
var form = $('#startPlaylist');
var submit = $('#startPointSubmit');
var input = $('#startPoint');
var paperInput = $('#paperStartPoint');
var buttonGroup = $('.button-group');
var continueButton = $('.continue');
var retryButton = $('.retry');
var progress = $('#progress');
var formInstructions = $('.form-instructions');

var sourceIndividual;

var enableForm = function () {
  submit.removeAttr('disabled');
  input.removeAttr('disabled');
  paperInput.removeAttr('disabled');
};

var disableForm = function () {
  submit.attr('disabled', 'disabled');
  input.attr('disabled', 'disabled');
  paperInput.attr('disabled', 'disabled');
};

var updateUrl = function (path) {
  window.history.replaceState({}, '', path);
  ga('send', 'pageview', window.location.pathname + window.location.search);
};

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
    enableForm();
    if (! options.preserveUrl) {
      updateUrl('?' + querystring.stringify({l: playlist.serialize()}));
    }
    if (! err.deadEnd) {
      buttonGroup.css('visibility', 'visible');
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

  var renderRoles = function (roles) {
    if (! roles || roles.length === 0) {
      return '';
    }
    return $('<span>').text(' (' + _.pluck(roles, 'name').join(', ') + ')');
  };

  var p = $('<p class="connector">');

  var previousConnector = playlistData[playlistData.length - 2].connectorToNext;
  previous = $('<b>').append(renderNameOrMid(previousConnector));
  p.append(previous);
  p.append(renderRoles(previousConnector.rolesInNext));

  var currentConnector = _.last(playlistData).connectorToNext;

  if (previousConnector.mid !== currentConnector.mid) {
    current = $('<b>').append(renderNameOrMid(currentConnector));
    p.append(' recorded with ').append(current);
    p.append(renderRoles(currentConnector.roles));
    p.append(' on:');
  } else {
    p.append(' appeared on:');
  }

  resultsElem.append(p);
  return Promise.resolve(playlistData[1]);
};

var end = function () {
  progress.removeAttr('active');
  buttonGroup.css('visibility', 'visible');
  enableForm();
  updateUrl('?' + querystring.stringify({l: playlist.serialize()}));
};

var go = function () {
  // If lookupUserInput() didn't find an individual, don't do anything.
  if (!sourceIndividual) {
    return;
  }
  disableForm();
  buttonGroup.css('visibility', 'hidden');
  progress.attr('active', 'active');

  playlist.fetchNewTrack()
  .then(renderConnector)
  .then(renderTrackDetails)
  .then(videoBlock)
  .then(end, error);
};

var replace = function () {
  playlist.removeTrack();
  var children;
  var removedConnector = false;
  while (! removedConnector) {
    children = $('#results').children();
    removedConnector = children.last().hasClass('connector');
    children = children.last().remove();
  }
  go();
};

continueButton.on('click', go);
retryButton.on('click', replace);

var formHandler = function (evt) {
  evt.preventDefault();

  var startingPoint = input.val().trim();
  if (! startingPoint) {
    return;
  }

  disableForm();
  resultsElem.empty();
  progress.attr('active', 'active');
  updateUrl('?' + querystring.stringify({q: startingPoint}));
  playlist.clear();
  var lookupUserInput = function(mids) {
    sourceIndividual = mids[0];
    if (! sourceIndividual) {
      var noResultsFoundMsg = $('<p>');
      var searchTerm = $('<b>').text(startingPoint);
      noResultsFoundMsg.text('Could not find an artist named ').append(searchTerm).append('. ');
      noResultsFoundMsg.append('Try variations. For example:');
      noResultsFoundMsg.append('<ul><li>Instead of <i>Beach Boys</i>, try <a href="?q=The%20Beach%20Boys">The Beach Boys</a></li><li>Instead of Beyonce, try <a href="?q=Beyoncé%20Knowles">Beyoncé Knowles</a></li></ul>');
      resultsElem.append(noResultsFoundMsg);
      progress.removeAttr('active');
      buttonGroup.css('visibility', 'hidden');
      enableForm();
      input.focus();
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
      sourceIndividual = start.mid;

      var index = 1;
      var length = data.length;
      return utils.promiseUntil(
          function () { return index === length; },
          function () {
            var promise = renderConnector(data.slice(index-1, index+1))
            .then(renderTrackDetails)
            .then(videoBlock);

            index = index + 1;
            return promise;
          }
      )
      .then(function () {
        progress.removeAttr('active');
        buttonGroup.css('visibility', 'visible');
        enableForm();
      });
    })
    .catch(function (err) {
      playlist.clear();
      err.message = 'Could not restore playlist: ' + err.message;
      error(err, {preserveUrl: true});
    });
    // re-enable buttons and turn of progress indicator
  }
});

/*global document*/
/*global window*/
var routes = require('./_lib/routes.js');
var playlist = require('./_lib/playlist.js');
var async = require('async');
var $ = require('jquery');
var url = require('url');
var querystring = require('querystring');

var resultsElem = $('#results');
var form = $('#startPlaylist');
var submit = $('#startPointSubmit');
var input = $('#startPoint');
var paperInput = $('#paperStartPoint');
var continueButtons = $('.continue');
var permalinkButtons = $('.permalink');
var resetButtons = $('.reset');
var startOverButtons = $('.startOver');
var progress = $('#progress');
var formInstructions = $('.form-instructions');
var permalinkDialog = $('#permalink-dialog');

var sourceIndividual;

var error = function (err) {
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
    window.history.replaceState({}, '', '?' + querystring.stringify({l: playlist.getSerialized()}));
		if (! err.deadEnd) {
			continueButtons.css('visibility', 'visible');
      permalinkButtons.css('visibility', 'visible');
		}
	}
};

var go = function () {
	// If lookupUserInput() didn't find an individual, don't do anything.
	if (!sourceIndividual) {
		return;
	}
	continueButtons.css('visibility', 'hidden');
  permalinkButtons.css('visibility', 'hidden');
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
			playlist.track(resultsElem, $).then(next, next);
		},
		function (err) {
			error(err);
			progress.removeAttr('active');
			continueButtons.css('visibility', 'visible');
      permalinkButtons.css('visibility', 'visible');
			resetButtons.css('visibility', 'visible');
			startOverButtons.css('visibility', 'visible');
      window.history.replaceState({}, '', '?' + querystring.stringify({l: playlist.getSerialized()}));
		}
	);
};

continueButtons.on('click', go);

var permalinkPreamble = $('<p>').text('Permalink for up to the first ten tracks: ');
var permalink = function () {
  permalinkDialog.empty();

  var link = url.resolve(window.location.href, '?l=' + encodeURIComponent(playlist.getSerialized()));

  var linkElement = $('<textarea>')
    .attr('readonly', 'readonly')
    .text(link);
  linkElement.on('click', function () {
    $(this).select();
  });
  permalinkDialog.append(permalinkPreamble).append(linkElement);
  // Have to close it to re-open it if user clicks Permalink button later on
  permalinkDialog.attr('opened', false);
  permalinkDialog.attr('opened', true);
};

permalinkButtons.on('click', permalink);

var resetForm = function () {
	continueButtons.css('visibility', 'hidden');
  permalinkButtons.css('visibility', 'hidden');
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
		playlist.setSource(sourceIndividual);
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
});

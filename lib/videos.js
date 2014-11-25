var youtube = require('youtube-api');
var extend = require('xtend');
var flatten = require('flat');
var apikey = require('../.apikey');
var options = {
	key: apikey.key
};

exports.search = function (q, callback) {
	var myOptions = extend(options, {part: 'id', maxResults: 1, type: 'video', q: q});
	youtube.search.list(myOptions, function (err, data) {
		var myData;
		var rv;
		if (data) {
			rv = {items: []};
			// Assigning to an object just in case data is a primitive which will blow up flatten().
			// Using flatten() to avoid absurd levels of checking: if data && data.items && ...
			myData = flatten({data: data});
			if (myData['data.items.0.id.videoId']) {
				rv.items.push({url: 'https://youtu.be/' + myData['data.items.0.id.videoId']});
			}
		}
		callback(err, rv);
	});
};
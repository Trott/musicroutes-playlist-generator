/* global -Promise */
var hyperquest = require('hyperquest');
var querystring = require('querystring');
var extend = require('xtend');
var flatten = require('flat');
var Promise = require('promise');
var apikey = require('../.apikey');
var options = {
	key: apikey.key
};

var run = function (url) {
  return new Promise(function (fulfill, reject) {
    hyperquest(url, {}, function (err, res) {
      if (err) {
        reject(err);
        return;
      }

      if (res.statusCode !== 200) {
        reject(Error('Received status code ' + res.statusCode));
        return;
      }

      var body = '';
      res.on('data', function (chunk) {
        body +=chunk;
      });

      res.on('end', function () {
        var data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          reject(Error('Error in received JSON:' + e.message));
          return;
        }
        fulfill(data);
      });
    });
  });
};

exports.embed = function (id, callback) {
  var myOptions = extend(options, {part: 'player', id: id});
  var myUrl = 'https://www.googleapis.com/youtube/v3/videos?' + querystring.stringify(myOptions);

  var success = function (data) {
    var rv = {items: []};
    data = flatten({data: data});
    if (data['data.items.0.player.embedHtml']) {
      rv.items.push({embedHtml: data['data.items.0.player.embedHtml']});
    }

    callback(null, rv);
  };

  run(myUrl).then(success, callback);
};

exports.search = function (q, callback) {
	var myOptions = extend(options, {part: 'id', maxResults: '1', type: 'video', videoEmbeddable: 'true', q: q});
	var myUrl = 'https://www.googleapis.com/youtube/v3/search?' + querystring.stringify(myOptions);
	
  var success = function (data) {
    var rv = {items: []};
    data = flatten({data: data});
    if (data['data.items.0.id.videoId']) {
      rv.items.push({videoId: data['data.items.0.id.videoId']});
    }
    callback(null, rv);
  };

  run(myUrl).then(success, callback);
};
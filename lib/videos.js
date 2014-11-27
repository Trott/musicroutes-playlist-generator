var hyperquest = require('hyperquest');
var querystring = require('querystring');
var extend = require('xtend');
var flatten = require('flat');
var apikey = require('../.apikey');
var options = {
	key: apikey.key
};

var run = function (url, callback) {
  hyperquest(url, {}, function (err, res) {
    if (err) {
      callback(err);
      return;
    }
    var body = '';
    if (res.statusCode !== 200) {
      err = new Error('Received status code ' + res.statusCode);
      callback(err);
      return;
    }
    res.on('data', function (chunk) {
      body +=chunk;
    });

    res.on('end', function () {
      var data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        callback(new Error('Error in received JSON:' + e.message));
        return;
      }
      callback(err, data);
    });
  });
};

exports.embed = function (id, callback) {
  var myOptions = extend(options, {part: 'player', id: id});
  var myUrl = 'https://www.googleapis.com/youtube/v3/videos?' + querystring.stringify(myOptions);

  var myCallback = function (err, data) {
    var rv;
    if (data) {
      rv = {items: []};
      data = flatten({data: data});
      if (data['data.items.0.player.embedHtml']) {
        rv.items.push({embedHtml: data['data.items.0.player.embedHtml']});
      }
    }
    callback(err, rv);
  };

  run(myUrl, myCallback);
};

exports.search = function (q, callback) {
	var myOptions = extend(options, {part: 'id', maxResults: '1', type: 'video', videoEmbeddable: 'true', q: q});
	var myUrl = 'https://www.googleapis.com/youtube/v3/search?' + querystring.stringify(myOptions);
	
  var myCallback = function (err, data) {
    var rv;
    if (data) {
      rv = {items: []};
      data = flatten({data: data});
      if (data['data.items.0.id.videoId']) {
        rv.items.push({videoId: data['data.items.0.id.videoId']});
      }
    }
    callback(err, rv);
  };

  run(myUrl, myCallback);
};
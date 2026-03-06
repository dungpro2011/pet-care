const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const zlib = require('zlib');

const staticfile = (pathName, req, res, fallback, headers) => {
  try {
    const decodePathName = decodeURIComponent(pathName);
    var path_name = decodePathName.slice(-1) == '\\' ? decodePathName.substring(0, decodePathName.length - 1) : decodePathName;
    const acceptEncoding = req.headers['accept-encoding'];
    fs.stat(path_name, function (error, stats) {
      if (error || (stats && !stats.isFile())) {
        fs.stat(path_name + '.html', function (error, stats) {
          if (error || (stats && !stats.isFile())) {
            fs.stat(path.join(path_name, 'index.html'), function (error, stats) {
              if (error || (stats && !stats.isFile())) {
                if (fallback) {
                  fs.stat(fallback, function (error, stats) {
                    if (error || (stats && !stats.isFile())) {
                      res.writeHead(404, { 'Content-type': 'text/plain' + "; charset=UTF-8" });
                      res.end('');
                    } else {
                      sentfile(res, acceptEncoding, fallback, stats, headers);
                    }
                  });
                } else {
                  res.writeHead(404, { 'Content-type': 'text/plain' + "; charset=UTF-8" });
                  res.end('');
                }
              } else {
                sentfile(res, acceptEncoding, path.join(path_name, 'index.html'), stats, headers);
              }
            });
          } else {
            sentfile(res, acceptEncoding, path_name + '.html', stats, headers);
          }
        });
      } else if (stats.isFile()) {
        sentfile(res, acceptEncoding, path_name, stats, headers);
      }
    });
  } catch (error) {
    res.writeHead(404, { 'Content-type': 'text/plain' + "; charset=UTF-8" });
    res.end('');
  }
};

const sentfile = (res, acceptEncoding, pathName, stats, headers = {}) => {
  var mimeFile = mime.lookup(pathName) || 'text/plain';
  var raw = fs.createReadStream(pathName);
  const compression =
    process.env.COMPRESSION == 'true' &&
    acceptEncoding &&
    mimeFile.match(
      /text\/plain|text\/html|text\/xml|text\/css|application\/xml|application\/xhtml+xml|application\/rss+xml|application\/javascript|application\/x-javascript/
    ) &&
    stats.size > 140 &&
    true;
  if (compression) {
    if (acceptEncoding.match(/\bgzip\b/)) {
      res.writeHead(200, { ...headers, 'Content-type': mimeFile + "; charset=UTF-8", 'content-encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(res);
    } else if (acceptEncoding.match(/\bdeflate\b/)) {
      res.writeHead(200, { ...headers, 'Content-type': mimeFile + "; charset=UTF-8", 'content-encoding': 'deflate' });
      raw.pipe(zlib.createDeflate()).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-type': mimeFile + "; charset=UTF-8" });
      raw.pipe(res);
    }
  } else {
    res.writeHead(200, { ...headers, 'Content-type': mimeFile + "; charset=UTF-8" });
    raw.pipe(res);
  }
};

module.exports = staticfile;

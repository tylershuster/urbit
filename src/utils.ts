import * as http from 'http';

interface HttpResponse {
  req: http.ClientRequest;
  res: http.IncomingMessage;
  data: string;
}

export function request(
  url: string,
  options: http.ClientRequestArgs,
  body?: string
) {
  return new Promise<HttpResponse>((resolve, reject) => {
    const req = http.request(url, options, res => {
      let data = "";
      res.on("data", chunk => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ req, res, data });
      });
      res.on("error", e => {
        reject(e);
      });
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export function camelize(str) {
  return str
      .replace(/\s(.)/g, function($1) { return $1.toUpperCase(); })
      .replace(/\s/g, '')
      .replace(/^(.)/, function($1) { return $1.toLowerCase(); });
}

export function uncamelize(str, separator = '-') {
  // Assume default separator is a single space.
  if(typeof(separator) == "undefined") {
    separator = " ";
  }
  // Replace all capital letters by separator followed by lowercase one
  var str = str.replace(/[A-Z]/g, function (letter) 
  {
    return separator + letter.toLowerCase();
  });
  // Remove first separator
  return str.replace(new RegExp('^' + separator), '');
}
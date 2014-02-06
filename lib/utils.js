var Promise = require('es6-promise').Promise;
var request = require('request').defaults({ jar: true });

/**
 * Make a HTTP request.
 *
 * @param {String|Object} uriOrOptions The URI, or a request options object.
 * @param {String} [method=GET] The HTTP request method if not specified in
 *     the request object.
 * @return {Promise} Promise for the response body.
 */
function makeRequest (uriOrOptions, method) {
	if (typeof uriOrOptions === 'string') {
		uriOrOptions = { uri: uriOrOptions };
	}

	if (!uriOrOptions.method) {
		uriOrOptions.method = (method || 'GET').toUpperCase();
	}

	return new Promise (function (resolve, reject) {
		request(uriOrOptions, function (err, resp, body) {
			if (err) {
				reject(err);
			}
			else if (resp.statusCode != 200 && resp.statusCode != 201) {
				reject(new Error('HTTP ' + resp.statusCode));
			}
			else {
				resolve(body);
			}
		});
	});
}

/**
 * Delay a promise.
 *
 * @param {Number} duration Delay duration in milliseconds.
 * @return {Promise} Promise that fulfills after the delay.
 */
function delay (duration) {
	return new Promise(function (resolve, reject) {
		setTimeout(resolve, duration);
	});
}

// module exports
module.exports.request = makeRequest;
module.exports.delay = delay;

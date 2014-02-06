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
				var error = new Error('HTTP ' + resp.statusCode);
				error.statusCode = resp.statusCode;
				error.body = body;
				reject(error);
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

/**
 * Create a on-time promise for the event of the event emitter.
 *
 * @param {EventEmitter} obj Event emitter.
 * @param {String} event Event name.
 * @return {Promise} Promise for the event.
 */
function promiseEvent (obj, event) {
	if (!obj || !(obj instanceof events.EventEmitter)) {
		return Promise.reject(new Error('Object is null or not an event emitter'));
	}

	return new Promise(function (resolve, reject) {
		obj.once(event, resolve);
	});
}

// module exports
module.exports.delay = delay;
module.exports.promiseEvent = promiseEvent;
module.exports.request = makeRequest;

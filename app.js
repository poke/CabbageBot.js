var Promise = require('es6-promise').Promise;
var WebSocket = require('ws');
var request = require('request').defaults({ jar: true });

/**
 * Make a HTTP request.
 *
 * @param {String|Object} uriOrOptions The URI, or a request options object.
 * @param {String} [method=GET] The HTTP request method if not specified in
 *     the request object.
 * @return {Promise} Promise for the response body.
 */
function req (uriOrOptions, method) {
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

try {
	var config = require('./config');
}
catch (e) {
	console.error('Please set up the configuration file `config.js` first.')
	process.exit(1);
}

/**
 * Log into StackOverflow with the StackExchange OpenID provider.
 *
 * @param {String} emailAddress The email address to log in with.
 * @param {String} password The password to log in with.
 * @return {Promise} Promise to log in.
 */
function openIdLogin (emailAddress, password) {
	return req('https://stackoverflow.com/users/login').then(function (body) {
		// auth request
		return req({
			method: 'POST',
			uri: 'https://stackoverflow.com/users/authenticate',
			followAllRedirects: true,
			form: {
				openid_identifier: 'https://openid.stackexchange.com',
				openid_username: '',
				oauth_version: '',
				oauth_server: '',
				fkey: body.match(/"fkey":"([a-f0-9]{32})"/)[1]
			}
		});
	}).then(function (body) {
		// login request
		return req({
			method: 'POST',
			uri: 'https://openid.stackexchange.com/account/login/submit',
			followAllRedirects: true,
			form: {
				email: emailAddress,
				password: password,
				fkey: body.match(/name="fkey" value="([^"]+)"/)[1],
				session: body.match(/name="session" value="([^"]+)"/)[1]
			}
		});
	}).then(function (body) {
		return null;
	});
}

/**
 * Connect to chat, receiving the chat `fkey`.
 *
 * @return {Promise} Promise for the `fkey`.
 */
function connectChat () {
	return req('http://chat.stackoverflow.com/').then(function (body) {
		return body.match(/name="fkey"[^>]+value="([a-z0-9]{32})"/)[1];
	});
}

/**
 * Join a chat room.
 *
 * @param {Number} roomId Room identifier.
 * @param {String} fkey The chat `fkey`.
 * @return {Promise} Promise for the websocket address.
 */
function joinRoom (roomId, fkey) {
	// chat auth request
	return req({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/ws-auth',
		form: {
			roomid: roomId,
			fkey: fkey
		}
	}).then(function (body) {
		return JSON.parse(body).url;
	});
}

/**
 * Leave all chat rooms.
 *
 * @param {String} fkey The chat `fkey`.
 * @return {Promise} Promise to leave.
 */
function leaveAll (fkey) {
	// leave request
	return req({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/chats/leave/all',
		form: {
			quiet: true,
			fkey: fkey
		}
	});
}

/**
 * Handle a chat API response.
 *
 * @param {Function} callback Called with the response data.
 * @return {Funciton} Response handler.
 */
function handleApiResponse (callback) {
	return function (err, resp, body) {
		if (callback) {
			if (err) {
				callback(err);
			}
			else if (resp.responseCode != 200) {
				callback(body);
			}
			else {
				callback(null, JSON.parse(body));
			}
		}
	};
}


/**
 * Send chat message.
 *
 * @param {String} text The message text to send.
 * @param {Number} roomId The room identifier.
 * @param {String} fkey The chat `fkey`.
 * @param {Function} callback Called with the response data.
 */
function sendMessage (text, roomId, fkey, callback) {
	var apiRequest = {
		uri: 'http://chat.stackoverflow.com/chats/' + roomId + '/messages/new',
		form: {
			text: text,
			fkey: fkey
		}
	};
	request.post(apiRequest, handleApiResponse(callback));
}

/**
 * Edit an existing chat message.
 *
 * @param {String} text The new message text.
 * @param {Number} messageId The message identifier.
 * @param {String} fkey The chat `fkey`.
 * @param {Function} callback Called with the response data.
 */
function editMessage (text, messageId, fkey, callback) {
	var apiRequest = {
		uri: 'http://chat.stackoverflow.com/messages/' + messageId,
		form: {
			text: text,
			fkey: fkey
		}
	};
	request.post(apiRequest, handleApiResponse(callback));
}


// Example handler
function handleMessageEvent (e, fkey) {
	if (e.event_type != 1) {
		return;
	}

	if (e.content.indexOf('!!rabbit') > -1) {
		sendMessage('I like rabbits!', e.room_id, fkey, function (err, data) {
			console.log(data.id);
		});
	}
}

openIdLogin(config.emailAddress, config.password).then(connectChat).then(function (fkey) {
	// register SIGINT handler
	process.on('SIGINT', function() {
		console.log('Shutting down.');
		leaveAll(fkey).then(function () {
			process.exit();
		});
	});


	return joinRoom(config.roomId, fkey).then(function (wsAddress) {
		var ws = new WebSocket(wsAddress + '?l=0', { origin: 'http://chat.stackoverflow.com' });
		ws.on('error', function (err) {
			console.log(err);
		});
		ws.on('open', function () {
			console.log('Websocket opened.');
		});
		ws.on('message', function (message, flags) {
			var data = JSON.parse(message);
			var room = data.r6;

			if (room.e && room.t != room.d) {
				room.e.forEach (function (e) {
					if (e.event_type == 1) {
						handleMessageEvent(e, fkey);
					}
					else {
						console.log(e);
					}
				});
			}
		});
	});
})
.catch(console.error);

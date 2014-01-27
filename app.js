var request = require('request').defaults({ jar: true });
var WebSocket = require('ws');

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
 * @param {Function} callback Called on login.
 */
function openIdLogin (emailAddress, password, callback) {
	request.get('https://stackoverflow.com/users/login', function (err, resp, body) {
		if (err) {
			return callback(err);
		}

		var authRequest = {
			uri: 'https://stackoverflow.com/users/authenticate',
			followAllRedirects: true,
			form: {
				openid_identifier: 'https://openid.stackexchange.com',
				openid_username: '',
				oauth_version: '',
				oauth_server: '',
				fkey: body.match(/"fkey":"([a-f0-9]{32})"/)[1]
			}
		};
		request.post(authRequest, function (err, resp, body) {
			if (err) {
				return callback(err);
			}

			var loginRequest = {
				uri: 'https://openid.stackexchange.com/account/login/submit',
				followAllRedirects: true,
				form: {
					email: emailAddress,
					password: password,
					fkey: body.match(/name="fkey" value="([^"]+)"/)[1],
					session: body.match(/name="session" value="([^"]+)"/)[1]
				}
			};
			request.post(loginRequest, function (err, resp, body) {
				callback(err);
			});
		});
	});
}

/**
 * Connect to chat, receiving the chat `fkey`.
 *
 * @param {Function} callback Called with the `fkey` as second parameter.
 */
function connectChat (callback) {
	request.get('http://chat.stackoverflow.com/', function (err, resp, body) {
		if (err) {
			return callback(err);
		}

		var fkey = body.match(/name="fkey"[^>]+value="([a-z0-9]{32})"/)[1];
		callback(null, fkey);
	});
}

/**
 * Join a chat room.
 *
 * @param {Number} roomId Room identifier.
 * @param {String} fkey The chat `fkey`.
 * @param {Function} callback Called when the room was joined; the second
 *             parameter is the websocket address.
 */
function joinRoom (roomId, fkey, callback) {
	var chatAuthRequest = {
		uri: 'http://chat.stackoverflow.com/ws-auth',
		form: {
			roomid: roomId,
			fkey: fkey
		}
	};
	request.post(chatAuthRequest, function (err, resp, body) {
		if (err) {
			callback(err);
		}
		else {
			callback(null, JSON.parse(body).url);
		}
	});
}

/**
 * Leave all chat rooms.
 *
 * @param {String} fkey The chat `fkey`.
 * @param {Function} callback Called when done.
 */
function leaveAll (fkey, callback) {
	var leaveRequest = {
		uri: 'http://chat.stackoverflow.com/chats/leave/all',
		form: {
			quiet: true,
			fkey: fkey
		}
	}
	request.post(leaveRequest, function (err, resp, body) {
		callback();
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


// Start
openIdLogin(config.emailAddress, config.password, function (err) {
	if (err) {
		return console.log(err);
	}

	console.log('Logged in; starting chat.');
	connectChat(function (err, fkey) {
		// register SIGINT handler
		process.on('SIGINT', function() {
			console.log('Shutting down.');
			leaveAll(fkey, function () {
				process.exit();
			});
		});

		// join room
		joinRoom(config.roomId, fkey, function (err, wsAddress) {
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
	});
});

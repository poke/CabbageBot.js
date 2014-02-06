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
 * Create a cabbage bot.
 *
 * @constructor
 */
function CabbageBot () {
	this.fkey = null;
	this.currentRoom = null;
}

/**
 * Send a new chat message to the specified room.
 *
 * @param {String} text The message text.
 * @param {Number} [roomId] The room id, or the default room if missing.
 * @return {Promise} Promise for the message id.
 */
CabbageBot.prototype.send = function cabbageBot_send (text, roomId) {
	roomId = roomId || this.currentRoom;
	if (!roomId) {
		return Promise.reject(new Error('No room id specified.'));
	}

	var path = '/chats/' + roomId + '/messages/new';
	return this.apiRequest(path, { text: text }).then(function (data) {
		return data.id;
	});
}

/**
 * Edit an existing chat message.
 *
 * @param {String} newText The new message text.
 * @param {Number} messageId The message id.
 * @return {Promise} Promise for the message id.
 */
CabbageBot.prototype.edit = function CabbageBot_edit (newText, messageId) {
	var path = '/messages/' + messageId;
	return this.apiRequest(path, { text: newText }).then(function (data) {
		return messageId;
	});
}

/**
 * Send a chat API request.
 *
 * @param {String} path The API request path, with a leading `/`.
 * @param {Object} data The request data.
 * @return {Promise} Promise for the parsed response object.
 */
CabbageBot.prototype.apiRequest = function CabbageBot_apiRequest (path, data) {
	var requestOptions = {
		method: 'POST',
		uri: 'http://chat.stackoverflow.com' + path,
		form: data
	};

	if (!requestOptions.form.fkey) {
		requestOptions.form.fkey = this.fkey;
	}
	if (!requestOptions.form.fkey) {
		return Promise.reject(new Error('No fkey specified.'));
	}

	return req(requestOptions).then(function (response) {
		return (response && response.length > 0) ? JSON.parse(response) : {};
	});
};


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
CabbageBot.prototype.connect = function CabbageBot_connect () {
	return req('http://chat.stackoverflow.com/').then(function (body) {
		return this.fkey = body.match(/name="fkey"[^>]+value="([a-z0-9]{32})"/)[1];
	}.bind(this));
}

/**
 * Join a chat room.
 *
 * @param {Number} roomId Room identifier.
 * @return {Promise} Promise for the websocket address.
 */
CabbageBot.prototype.join = function CabbageBot_join (roomId) {
	if (!this.fkey) {
		return Promise.reject(new Error('Not connected (fkey not available).'));
	}

	// chat auth request
	return req({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/ws-auth',
		form: {
			roomid: roomId,
			fkey: this.fkey
		}
	}).then(function (body) {
		return JSON.parse(body).url;
	});
}

/**
 * Leave all chat rooms.
 *
 * @return {Promise} Promise to leave.
 */
CabbageBot.prototype.leaveAll = function CabbageBot_leaveAll () {
	if (!this.fkey) {
		return Promise.reject(new Error('Not connected (fkey not available).'));
	}

	// leave request
	return req({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/chats/leave/all',
		form: {
			quiet: true,
			fkey: this.fkey
		}
	});
}


// Example handler
function handleMessageEvent (e, cbg) {
	if (e.event_type != 1) {
		return;
	}

	if (e.content.indexOf('!!rabbit') > -1) {
		cbg.send('I like rabbits!', e.room_id).then(function (msgId) {
			console.log('Message sent: ' + msgId);

			return delay(5000).then(function () {
				return cbg.edit('I *really* like rabbits!', msgId).then(function (msgId) {
					console.log('Message edited: ' + msgId);
				});
			});
		}).catch(console.error);
	}
}

var cbg = new CabbageBot();
openIdLogin(config.emailAddress, config.password).then(cbg.connect.bind(cbg)).then(function (fkey) {
	// register SIGINT handler
	process.on('SIGINT', function() {
		console.log('Shutting down.');
		cbg.leaveAll().then(function () {
			process.exit();
		});
	});

	// join chat room
	return cbg.join(config.roomId).then(function (wsAddress) {
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
						handleMessageEvent(e, cbg);
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

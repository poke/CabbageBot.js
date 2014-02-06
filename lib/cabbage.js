var Promise = require('es6-promise').Promise;
var WebSocket = require('ws');
var events = require('events');
var util = require('util');

var request = require('./utils').request;
var promiseEvent = require('./utils').promiseEvent;

/**
 * Create a cabbage bot.
 *
 * @constructor
 */
function CabbageBot (mainRoom) {
	events.EventEmitter.call(this);

	this.ws = null;
	this.fkey = null;
	this.mainRoom = mainRoom;
	this.rooms = [];
}
util.inherits(CabbageBot, events.EventEmitter);

/**
 * Connect to chat, retrieving the chat `fkey`.
 *
 * @return {Promise} Promise to connect.
 */
CabbageBot.prototype.connect = function CabbageBot_connect () {
	return request('http://chat.stackoverflow.com/').then(function (body) {
		this.fkey = body.match(/name="fkey"[^>]+value="([a-z0-9]{32})"/)[1];
	}.bind(this));
}

/**
 * Join chat and listen to the websocket.
 *
 * @param {Number} [roomId] The room to join.
 * @return {Promise} Promise to open the conection.
 */
CabbageBot.prototype.listen = function CabbageBot_listen (roomId) {
	if (!this.fkey) {
		return Promise.reject(new Error('Not connected'));
	}
	roomId = roomId || this.mainRoom;
	if (!roomId) {
		return Promise.reject(new Error('No room to listen to'));
	}
	this.rooms.push(roomId);

	// chat auth request
	return request({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/ws-auth',
		form: {
			roomid: roomId,
			fkey: this.fkey
		}
	}).then(function (body) {
		return JSON.parse(body).url;
	}).then(function (websocketAddress) {
		var self = this;
		var ws = this.ws = new WebSocket(websocketAddress + '?l=0', { origin: 'http://chat.stackoverflow.com' });

		ws.on('error', function (err) {
			self.emit('error', err);
		});

		ws.on('message', function (message, flags) {
			var data = JSON.parse(message);
			for (var room in data) {
				if (data[room].e && data[room].t != data[room].d) {
					data[room].e.forEach(function (evt) {
						self.emit('event', evt);
					});
				}
			}
		});

		return promiseEvent(this.ws, 'open').then(function () {
			self.emit('open');
		});
	}.bind(this));
}

/**
 * Leave all chat rooms.
 *
 * @return {Promise} Promise to leave.
 */
CabbageBot.prototype.leaveAll = function CabbageBot_leaveAll () {
	if (!this.fkey) {
		return Promise.reject(new Error('Not connected'));
	}

	// leave request
	return request({
		method: 'POST',
		uri: 'http://chat.stackoverflow.com/chats/leave/all',
		form: {
			quiet: true,
			fkey: this.fkey
		}
	});
}

/**
 * Quit the chat, closing all connections.
 *
 * @return {Promise} Promise to close.
 */
CabbageBot.prototype.quit = function CabbageBot_quit () {
	var promise = Promise.resolve(null);

	if (this.ws && this.ws.readyState != WebSocket.CLOSED) {
		promise = promise.then(promiseEvent(this.ws, 'close'));
		this.ws.close();
	}

	if (this.fkey) {
		promise = promise.then(this.leaveAll.bind(this));
	}

	return promise.then(function () {
		this.emit('close');
	}.bind(this));
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
		return Promise.reject(new Error('No fkey specified'));
	}

	return request(requestOptions).then(function (response) {
		return (response && response.length > 0) ? JSON.parse(response) : {};
	});
};

/**
 * Send a new chat message to the specified room.
 *
 * @param {String} text The message text.
 * @param {Number} [roomId] The room id, or the default room if missing.
 * @return {Promise} Promise for the message id.
 */
CabbageBot.prototype.send = function cabbageBot_send (text, roomId) {
	roomId = roomId || this.mainRoom;
	if (!roomId) {
		return Promise.reject(new Error('No room id specified'));
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

// module exports
module.exports = CabbageBot;

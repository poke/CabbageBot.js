var Promise = require('es6-promise').Promise;

var request = require('./utils').request;

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
 * Connect to chat, receiving the chat `fkey`.
 *
 * @return {Promise} Promise for the `fkey`.
 */
CabbageBot.prototype.connect = function CabbageBot_connect () {
	return request('http://chat.stackoverflow.com/').then(function (body) {
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
	return request({
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

// module exports
module.exports = CabbageBot;

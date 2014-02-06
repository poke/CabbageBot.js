var WebSocket = require('ws');

var CabbageBot = require('./lib/cabbage');
var delay = require('./lib/utils').delay;
var openIdLogin = require('./lib/auth').openIdLogin;
var request = require('./lib/utils').request;

// load configuration
try {
	var config = require('./config');
}
catch (e) {
	console.error('Please set up the configuration file `config.js` first.')
	process.exit(1);
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

// start bot
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

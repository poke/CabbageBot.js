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
			if (!msgId) {
				throw new Error('Invalid id');
			}

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
var cbg = new CabbageBot(config.roomId);
openIdLogin(config.emailAddress, config.password)
.then(cbg.connect.bind(cbg))
.then(cbg.listen.bind(cbg))
.catch(console.error);

// SIGINT event handler
process.on('SIGINT', cbg.quit.bind(cbg));

// event handler
cbg.once('open', function () {
	console.log('Connection established.');
});
cbg.once('close', function () {
	console.log('Connection closed.');
});
cbg.on('error', function (err) {
	console.error(err);
})
cbg.on('event', function (evt) {
	if (evt.event_type == 1) {
		handleMessageEvent(evt, cbg);
	}
	else {
		console.log(evt);
	}
});

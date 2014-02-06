var request = require('./utils').request;

/**
 * Log into StackOverflow with the StackExchange OpenID provider.
 *
 * @param {String} emailAddress The email address to log in with.
 * @param {String} password The password to log in with.
 * @return {Promise} Promise to log in.
 */
function openIdLogin (emailAddress, password) {
	return request('https://stackoverflow.com/users/login').then(function (body) {
		// auth request
		return request({
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
		return request({
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
};

// module exports
module.exports.openIdLogin = openIdLogin;

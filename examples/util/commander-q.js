/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External modules
var Q = require('q');
var commander = require('commander');
var cmd = new commander.Command();

/**
* 
*/
var prompt = function(promptText, defaultValue, done) {
	if (typeof defaultValue === 'function' && typeof done === 'undefined') {
		done = defaultValue;
		defaultValue = undefined;
	}

	cmd.prompt(promptText, function(value) {
		if (!value) {
			if (!defaultValue) {
				// Default value
				done(null, defaultValue);
			}
			else {
				// Default value
				done(new Error('You must supply a value!'));
			}
		}
		else {
			done(null, value);
		}
	});
};

/**
* 
*/
var password = function(promptText, done) {
	cmd.password((promptText || 'Password: '), '*', function(pass) {
		if (!pass) {
			done(new Error('You must supply a password!'));
		}
		else {
			process.stdin.destroy();
			done(null, pass);
		}
	});
};

/**
* 
*/
var CommanderQ = Object.create(null);

// Pre-bind all the Node promises for Q
CommanderQ.prompt   = Q.nfbind(prompt);
CommanderQ.password = Q.nfbind(password);

module.exports = CommanderQ;


/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External module wrappers, all pre-bound as Node promises for Q
var cmd = require('./util/commander-q');

// Internal module wrappers
var migrator = require('./util/gc2gh-issue-migrator-q');

var projConfig = {
	gc: {
		project:  null,      //'phantomjs',
		username: null,      //'ariya.hidayat@gmail.com',
		password: null,      //'phantomjsFTW!',
		closingStatus: null  //'Migrated'
	},
	gh: {
		startingIssueId: 1  //10001
	}
};


console.log("Let's close out all of your old Google Code issues!\nFirst, we'll need some information....\n");
console.log('GOOGLE CODE');
cmd.prompt('Project (phantomjs): ').then(function(gcProjectName) {
	projConfig.gc.project = gcProjectName || 'phantomjs';
	return cmd.prompt('Email (james.m.greene@gmail.com): ');
}).then(function(gcUsername) {
	projConfig.gc.username = gcUsername || 'james.m.greene@gmail.com';
	return cmd.password('Password: ');
}).then(function(gcPassword) {
	projConfig.gc.password = gcPassword;
	return cmd.prompt('Closing status (Migrated): ');
}).then(function(closingStatus) {
	projConfig.gc.closingStatus = closingStatus || 'Migrated';
	
	console.log('\nGITHUB');
	return cmd.prompt('Starting Issue ID (1): ');
}).then(function(ghStartingIssueNumber) {
	var num = parseInt(ghStartingIssueNumber, 10);
	projConfig.gh.startingIssueId = (isNaN(num) || num < 1) ? 1 : num;
	
	console.log('\n\nCloseout beginning!');
	return migrator.closeOldIssues(projConfig);
}).then(function(/* gcClosedIssues */) {
	console.log('Completed successfully! All old issues on Google Code have been closed.');
}).fail(function(err) {
	console.error(err);
}).done();

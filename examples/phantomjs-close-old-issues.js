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
		project:  'phantomjs',
		username: 'james.m.greene@gmail.com',
		password: null,  //'phantomjsFTW!'
		closingStatus: 'Migrated'
	},
	gh: {
		repo: 'ariya/phantomjs',
		startingIssueId: 10001
	}
};


console.log("Let's close out all of your old Google Code issues!\nFirst, we'll need some information....\n");
console.log('GOOGLE CODE');
console.log('Project: ' + projConfig.gc.project);
console.log('Email: ' + projConfig.gc.username);

cmd.password('Password: ').then(function(gcPassword) {
	projConfig.gc.password = gcPassword;

	console.log('GITHUB');
	console.log('Repo: ' + projConfig.gh.repo)
	console.log('Starting Issue ID: ' + projConfig.gh.startingIssueId);

	console.log('\n\nCloseout beginning!');
	return migrator.closeOldIssues(projConfig);
}).then(function(gcClosedIssues) {
	console.log('Completed successfully! All old issues on Google Code have been closed.');
}).fail(function(err) {
	console.error(err);
}).done();

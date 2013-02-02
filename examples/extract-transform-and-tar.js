/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// Node.js core modules
var path = require('path');

// External module wrappers, all pre-bound as Node promises for Q
var cmd = require('./util/commander-q');

// Internal module wrappers
var migrator = require('./util/gc2gh-issue-migrator-q');

// Default the final output file if it was not provided as a commandline arg
var outputFilePath = process.argv[2];
if (!outputFilePath) {
	outputFilePath = path.resolve(process.cwd(), 'out/github-importable-issues.tar');
	console.warn('WARNING: Did not provide an output filename as an argument. Defaulting to:\n\t' + outputFilePath + '\n');
}

var projConfig = {
	gc: {
		project:  null, //'phantomjs',
		username: null, //'ariya.hidayat@gmail.com',
		password: null  //'phantomjsFTW!'
	},
	gh: {
		startingIssueId: 1  //10001
	}
};

var milestones = [];


console.log('Let\'s extract all of our Google Code issues and convert them into the GitHub v3 issue format!\nFirst, we\'ll need some information....\n');
console.log('GOOGLE CODE');
cmd.prompt('Project: ').then(function(gcProjectName) {
	projConfig.gc.project = gcProjectName;
	return cmd.prompt('Email: ');
}).then(function(gcUsername) {
	projConfig.gc.username = gcUsername;
	return cmd.password('Password: ');
}).then(function(gcPassword) {
	projConfig.gc.password = gcPassword;

	console.log('GITHUB');
	return cmd.prompt('Starting Issue ID (1): ');
}).then(function(ghStartingIssueNumber) {
	var num = parseInt(ghStartingIssueNumber, 10);
	projConfig.gh.startingIssueId = (isNaN(num) || num < 1) ? 1 : num;

	console.log('\nExtract and transform beginning!');
	return migrator.extractAndTransform(projConfig, milestones);
}).spread(function(ghRawIssues, ghRawComments, ghRawMilestones) {
	return migrator.exportAsTar(ghRawIssues, ghRawComments, ghRawMilestones, outputFilePath);
}).then(function() {
	console.log('Completed successfully! Go check out your TAR file:\n  ' + outputFilePath);
}).fail(function(err) {
	console.error(err);
}).done();

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
var fs = require('fs');

// External modules
var Q = require('q');

// External module wrappers, all pre-bound as Node promises for Q
var cmd = require('./util/commander-q');

// Internal module wrappers
//var migrator = require('./util/gc2gh-issue-migrator-q');
var migrator = require('../lib/gc2gh-issue-migrator').create();

// Pre-bind all the Node promises for Q
var extractAndTransform = Q.nfbind(migrator.extractAndTransform.bind(migrator));

// Internal modules
var Milestone = require('../lib/milestone');

// Pre-bind all as Node promises for Q
var writeFile = Q.nfbind(fs.writeFile.bind(fs));

var mkdir = function(dirPath) {
	if (
		!(
			fs.existsSync(dirPath) || 
			(function() {
				try { return fs.statSync(dirPath).isDirectory(); }
				catch (e) { return false; }
			})()
		)
	) {
		fs.mkdirSync(dirPath);
	}
};

// Default the final output file if it was not provided as a commandline arg
var outputDirPath = process.argv[2];
if (!outputDirPath) {
	var outputDir = path.resolve(process.cwd(), 'out/');
	mkdir(outputDir);
	outputDirPath = path.resolve(outputDir, 'phantomjs_github-import/');
	mkdir(outputDirPath);
	
	mkdir(path.resolve(outputDirPath, 'issues/'));
	mkdir(path.resolve(outputDirPath, 'milestones/'));
	
	console.warn('WARNING: Did not provide an output directory as an argument. Defaulting to:\n\t' + outputDirPath + '\n');
}

var projConfig = {
	gc: {
		project:  'phantomjs',
		username: 'james.m.greene@gmail.com',
		password: null  //'phantomjsFTW!'
	},
	gh: {
		startingIssueId: 10001
	}
};

var milestones = createMilestones();

console.log('Let\'s extract all of our Google Code issues and convert them into the GitHub v3 issue format!\nFirst, we\'ll need some information....\n');
console.log('GOOGLE CODE');
console.log('Project: ' + projConfig.gc.project);
console.log('Email: ' + projConfig.gc.username);

cmd.password('Password: ').then(function(gcPassword) {
	projConfig.gc.password = gcPassword;

	console.log('GITHUB');
	console.log('Starting Issue ID: ' + projConfig.gh.startingIssueId);
	console.log('\nExtract and transform beginning!');

// HACK HACK HACK - START - To stop hitting Google Code so hard....
//(function() {
//	projConfig.gc.password = 'fakePassword';
//	var readAndTransform = function(config, milestones, done) {
//		var inputFile = path.resolve(process.cwd(), 'in/phantomjs_localData.json');
//		migrator._extractFromFile(inputFile, function(err, gcIssuesWithComments) {
//			if (err) {
//				done(err);
//			}
//			else {
//				migrator._transform(config, milestones, gcIssuesWithComments, done);
//			}
//		});
//	};
//	extractAndTransform = Q.nfbind(readAndTransform);
//})();
	return extractAndTransform(projConfig, milestones);
}).then(function(ghImportableOutput) {
	// TODO: Implement and use `migrator.exportAsTar` instead
	//return migrator.exportAsTar(ghRawIssues, ghRawComments, ghRawMilestones, outputDirPath);

	var milestonesDir = path.resolve(outputDirPath, 'milestones/');
	var issuesDir = path.resolve(outputDirPath, 'issues/');

	return Q.all(
		milestones.map(function(milestone) {
		var rawMilestone = milestone.toRawMilestone();
		return writeFile(path.resolve(milestonesDir, rawMilestone.number + '.json'), JSON.stringify(rawMilestone, null, '\t'));
	})).then(function() {
		return Q.all(ghImportableOutput.issues.map(function(rawIssueAndRawComments) {
			return writeFile(path.resolve(issuesDir, rawIssueAndRawComments.issue.number + '.json'), JSON.stringify(rawIssueAndRawComments.issue, null, '\t'));
		}));
	}).then(function() {
		return Q.all(ghImportableOutput.issues.map(function(rawIssueAndRawComments) {
			return writeFile(path.resolve(issuesDir, rawIssueAndRawComments.issue.number + '.comments.json'), JSON.stringify(rawIssueAndRawComments.comments, null, '\t'));
		}));
	});
}).then(function() {
	console.log('Completed successfully!\nTAR/ZIP up your export directory and send it to GitHub!\n  ' + outputDirPath);
}).fail(function(err) {
	console.error(err + '\n' + err.stack);
}).done();



function createMilestones() {
	return [
		new Milestone({
			'number': 1,
			'title': 'FutureRelease',
			'state': 'open',
			'description': 'Changes targeted for an unknown future version.',
			'created_at': '2010-12-26T19:49:33-08:00',
			'due_on': null,
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 2,
			'title': 'Release1.0',
			'state': 'closed',
			'description': 'The initial release. Long live PhantomJS!',
			'created_at': '2010-12-26T19:49:33-08:00',
			'due_on': '2011-01-17T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 3,
			'title': 'Release1.1',
			'state': 'closed',
			'description': '"Cherry Blossom": http://phantomjs.org/release-1.1.html',
			'created_at': '2011-01-18T00:00:00-08:00',
			'due_on': '2011-04-27T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 4,
			'title': 'Release1.2',
			'state': 'closed',
			'description': '"Birds of Paradise": http://phantomjs.org/release-1.2.html',
			'created_at': '2011-04-28T00:00:00-08:00',
			'due_on': '2011-06-21T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 5,
			'title': 'Release1.3',
			'state': 'closed',
			'description': '"Water Lily": http://phantomjs.org/release-1.3.html',
			'created_at': '2011-06-22T00:00:00-08:00',
			'due_on': '2011-09-23T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 6,
			'title': 'Release1.4',
			'state': 'closed',
			'description': '"Glory of the Snow": http://phantomjs.org/release-1.4.html',
			'created_at': '2011-09-24T00:00:00-08:00',
			'due_on': '2011-12-22T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 7,
			'title': 'Release1.5',
			'state': 'closed',
			'description': '"Ghost Flower": http://phantomjs.org/release-1.5.html',
			'created_at': '2011-12-23T00:00:00-08:00',
			'due_on': '2012-03-20T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 8,
			'title': 'Release1.6',
			'state': 'closed',
			'description': '"Lavender": http://phantomjs.org/release-1.6.html',
			'created_at': '2012-03-21T00:00:00-08:00',
			'due_on': '2012-06-20T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 9,
			'title': 'Release1.7',
			'state': 'closed',
			'description': '"Blazing Star": http://phantomjs.org/release-1.7.html',
			'created_at': '2012-06-21T00:00:00-08:00',
			'due_on': '2012-09-22T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 10,
			'title': 'Release1.8',
			'state': 'closed',
			'description': '"Blue Winter Rose": http://phantomjs.org/release-1.8.html',
			'created_at': '2012-09-23T00:00:00-08:00',
			'due_on': '2012-12-21T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		}),
		new Milestone({
			'number': 11,
			'title': 'Release1.9',
			'state': 'open',
			'description': 'The next release of PhantomJS!',
			'created_at': '2012-12-22T00:00:00-08:00',
			'due_on': '2013-03-20T23:59:59-08:00',
			'creator': 'ariya.hidayat@gmail.com'
		})
	];
}

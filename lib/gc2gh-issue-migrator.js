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
var Pack = require('tar').Pack;
var Writer = require('fstream').Writer;
var gcph = require('gcph-client');
var GCIssue = gcph.Issue;
var GCComment = gcph.Comment;

// Internal modules
var GHIssue = require('./issue');
var GHComment = require('./comment');

// Utility function
var args = (function() {
	var slicer = Array.prototype.slice;
	return function(argumentsObj) {
		return slicer.call(argumentsObj, 0);
	};
})();

// This module's main purpose
var Migrator = function() {

	// External module wrappers, all pre-bound as Node promises for Q
	var gcClient = new gcph.Client({ honorPrivacy: true });

	// Pre-bind all as Node promises for Q
	var loginP       = Q.nfbind(gcClient.login.bind(gcClient));
	var getIssuesP   = Q.nfbind(gcClient.getIssues.bind(gcClient));
	var getCommentsP = Q.nfbind(gcClient.getComments.bind(gcClient));
	var updateIssueP = Q.nfbind(gcClient.updateIssue.bind(gcClient));
	var writeFileP   = Q.nfbind(fs.writeFile.bind(fs));

	// Create a name-to-ID map for the milestones
	function createMilestoneMap(milestones) {
		var milestoneMap = {};
		milestones.forEach(function(e) {
			milestoneMap[e.title] = e.number;
		});
		return milestoneMap;
	}

	// Validate and normalize the arguments common to both the `extractAndTransform` and `closeOldIssues` methods
	var validateDoneCallback = function(done) {
		// Argument validation
		if (typeof done !== 'function') {
			throw new TypeError('`doneCallback` was not a function');
		}
		return done;
	};
	var validateMilestoneMap = function(milestoneMap, done) {
		if (milestoneMap == null) {
			return {};
		}
		if (
			typeof milestoneMap !== 'object' ||
			milestoneMap.__proto__ === Array.prototype ||
			milestoneMap.__proto__ === RegExp.prototype ||
			milestoneMap.__proto__ === Date.prototype
		) {
			done(new TypeError('`milestoneMap` must be an Object'));
		}
		return milestoneMap;
	};
	var validateCommonConfig = function(config, done) {
		if (
			!(
				config && config.gc && config.gh &&
				((typeof config.gc.project === 'string') && config.gc.project) &&
				((typeof config.gc.username === 'string') && config.gc.username) &&
				((typeof config.gc.password === 'string') && config.gc.password) &&
				(
					(typeof config.gh.startingIssueId === 'number') &&
					(config.gh.startingIssueId === parseInt(config.gh.startingIssueId, 10)) &&
					(config.gh.startingIssueId > 0)
				)
			)
		) {
			done(new TypeError('The input arguments were invalid. Please refer to the documentation/examples/JSDoc.'));
		}
		
		return config;
	};
	var validateGHRepoConfig = function(config, done) {
		if (
			!(
				((typeof config.gh.repo === 'string') && config.gh.repo) &&
				(
					(
						(config.gh.repo.indexOf('/') === -1) &&
						(
							((typeof config.gh.organization === 'string') && config.gh.organization) ||
							((typeof config.gh.username === 'string') && config.gh.username)
						)
					) ||
					(
						(config.gh.repo.indexOf('/') !== -1) &&
						(config.gh.repo.indexOf('/') === config.gh.repo.lastIndexOf('/'))
					)
				)
			)
		) {
			done(new TypeError('The input arguments were invalid. Please refer to the documentation/examples/JSDoc.'));
		}
		
		if (config.gh.repo.indexOf('/') !== -1) {
			var splitRepo = config.gh.repo.split('/'),
				orgOrUser = splitRepo[0],
				repoName = splitRepo.slice(1).join('/');
			
			config.gh.repo = repoName;
			
			if (config.gh.organization !== orgOrUser && config.gh.username !== orgOrUser) {
				if (!config.gh.username) {
					config.gh.username = orgOrUser;
				}
				else if (!config.gh.organization) {
					config.gh.organization = orgOrUser;
				}
				else {
					done(new TypeError('The `config.gh.repo` value (' + config.gh.repo + ') conflicted with the GH username/organization'));
				}
			}
		}
		
		return config;
	};
	
	
	/**
	* @private
	*/
	this._extractFromFile = function(filePath, done) {
		fs.readFile(filePath, function(err, jsonData) {
			if (err) {
				done(err);
			}
			else {
				var gcIssuesWithCommentsData = JSON.parse(jsonData);
				// Map the raw data to the expected classes
				var gcIssuesWithComments = gcIssuesWithCommentsData.map(function(gcIssueData) {
					gcIssueData.comments = gcIssueData.comments.map(function(gcCommentData) {
						return new GCComment(gcCommentData);
					}
					return new GCIssue(gcIssueData);
				});
				done(null, gcIssuesWithComments);
			}
		});
	};

	/**
	* @private
	*/
	this._extractFromGoogleCode = function(config, done) {
		done = validateDoneCallback(done);
		config = validateCommonConfig(config, done);

		loginP(config.gc.username, config.gc.password).then(function() {
			return getIssuesP(config.gc.project);
		}).then(function(gcIssues) {
			return Q.all(gcIssues.map(function(gcIssue) {
				return getCommentsP(config.gc.project, gcIssue.id).then(function(comments) {
					gcIssue.comments = comments || [];
					return gcIssue;
				});
			}));
		}).then(function(gcIssuesWithComments) {
			done(null, gcIssuesWithComments);
		}).fail(done).done();
	};

	/**
	* @private
	*/
	this._transform = function(config, milestones, gcIssuesWithComments, done) {
		var ghIssueIdOffset = config.gh.startingIssueId - 1;
		var milestoneMap = validateMilestoneMap(createMilestoneMap(milestones), done);

		Q.all(gcIssuesWithComments.map(function(gcIssueWithComments) {
			// Convert each `gcIssueWithComments` into a `ghIssue`
			var issue = GHIssue.fromGCIssue(gcIssueWithComments, ghIssueIdOffset).toRawIssue(milestoneMap);
			var comments =
				gcIssueWithComments.comments.map(function(gcComment) {
					return GHComment.fromGCComment(gcComment, ghIssueIdOffset).toRawComment();
				});
			return {
				'issue': issue,
				'comments': comments
			};
		})).then(function(ghRawIssueGroupings) {
			done(null, {
				'issues': ghRawIssueGroupings,
				'milestones':
					(milestones || []).map(function(e) {
						return e.toRawMilestone();
					})
			});
		}).fail(done).done();
	};

	/**
	* Extract all of the issues from a Google Code project and convert them into the GitHub v3 issue format.
	*
	* @example
	*	var migrator = require('gc2gh-issue-migrator').create();
	*	migrator.extractAndTransform(
	*		{
	*			gc: {
	*				project:  'phantomjs',
	*				username: 'ariya.hidayat@gmail.com',
	*				password: 'phantomjsFTW!'
	*			},
	*			gh: {
	*				startingIssueId: 1001
	*			}
	*		},
	*		{
	*			'v1.0': 1
	*		},
	*		function(err, result) {}
	*	);
	*/
	this.extractAndTransform = function(config, milestones, done) {
		var extractP = Q.nfbind(this._extractFromGoogleCode.bind(this));
		var transformP = Q.nfbind(this._transform.bind(this));

		extractP(config).then(function(gcIssuesWithComments) {
			return transformP(config, milestones, gcIssuesWithComments);
		}).then(function(ghImportableIssuesWithComments) {
			done(null, ghImportableIssuesWithComments);
		}).fail(done).done();
	};

	/**
	* 
	*/
	this.exportAsTar = function(ghIssues, milestones, outputTar, done) {
		//
		// TODO: May need to write `ghIssues` to the file system before TARing them...?
		//
		
		// WARNING: The below is untested, half-baked, etc.
		if (!outputTar) {
			outputTar = path.resolve(process.cwd(), 'out/github-importable-issues.tar');
			console.warn('WARNING: Did not provide an output filename for `outputTar`! Defaulting to:\n  ' + outputTar + '\n');
		}

		var msgPrefix = '[TAR] ';
		
		var writer = Writer(outputTar);
		writer.on('error', function(err) {
			console.error(msgPrefix + 'Writing: FAILED!');
			done(err, outputTar);
		});
		writer.on('close', function() {
			console.log(msgPrefix + 'Writing: DONE!');
			done(null, outputTar);
		});
		
		var packer = Pack(null);
		packer.on('data', function(data) {
			//console.log(msgPrefix + 'Packing: Data received...');
		});
		packer.on('end', function() {
			console.log(msgPrefix + 'Packing: DONE!');
		});
		packer.on('error', function(err) {
			console.error(msgPrefix + 'Packing: FAILED!');
			
			// writer.emit('error', err);
			done(err, outputTar);
		});
		
		packer.pipe(writer);
		
		packer.add(inputDir);
	};

	/**
	* Close all of the issues from a Google Code project and add a comment to each linking to the new location on GitHub.
	*
	* @example
	*	var migrator = require('gc2gh-issue-migrator').create();
	*	migrator.closeOldIssues(
	*		{
	*			gc: {
	*				project:  'phantomjs',
	*				username: 'ariya.hidayat@gmail.com',
	*				password: 'phantomjsFTW!',
	*				closingStatus: 'Migrated'
	*			},
	*			gh: {
	*				startingIssueId: 1001,
	*				repo: 'ariya/phantomjs'
	*			}
	*		},
	*		function(err, result) {}
	*	);
	* @example
	*	var migrator = require('gc2gh-issue-migrator').create();
	*	migrator.closeOldIssues(
	*		{
	*			gc: {
	*				project:  'phantomjs',
	*				username: 'ariya.hidayat@gmail.com',
	*				password: 'phantomjsFTW!'
	*			},
	*			gh: {
	*				startingIssueId: 1001,
	*				username: 'ariya',
	*				repo: 'phantomjs'
	*			}
	*		},
	*		function(err, result) {}
	*	);
	* @example
	*	var migrator = require('gc2gh-issue-migrator').create();
	*	migrator.closeOldIssues(
	*		{
	*			gc: {
	*				project:  'phantomjs',
	*				username: 'ariya.hidayat@gmail.com',
	*				password: 'phantomjsFTW!'
	*			},
	*			gh: {
	*				startingIssueId: 1001,
	*				organization: 'ariya',  // 'ariya' isn't actually an organization, but you get the idea
	*				repo: 'phantomjs'
	*			}
	*		},
	*		},
	*		function(err, result) {}
	*	);
	*/
	this.closeOldIssues = function(config, done) {
		done = validateDoneCallback(done);
		config = validateCommonConfig(config, done);
		config = validateGHRepoConfig(config, done);
		
		var ghRepoName = (function(gh) {
			return (gh.repo.indexOf('/') !== -1) ? gh.repo : ((gh.organization || gh.username) + '/' + gh.repo);
		})(config.gh);
		
		var closingStatus = config.gc.closingStatus || 'WontFix';


		// Use `gcph-client` to update all issues with a comment stating a link to their new Issue ID and closing all issues that are open.
		loginP(config.gc.username, config.gc.password).then(function() {
			return getIssuesP(config.gc.project);
		}).then(function(gcIssues) {
			return Q.all(gcIssues.map(function(gcIssue) {
				var alreadyClosed = gcIssue.state === 'closed';
				var closingComment = new GCComment({
					'author': {
						'email': config.gc.username
					},
					'content':
						(function() {
							var ghIssueNum = (parseInt(gcIssue.id, 10) + config.gh.startingIssueId - 1),
								ghUrl = 'https://github.com/' + ghRepoName + '/issues/' + ghIssueNum,
								closingOrNot = !alreadyClosed ? 'Closing. ' : '';
							return closingOrNot + 'This issue has been moved to GitHub: ' + ghUrl;
						})(),
					'issueUpdates': alreadyClosed ? {} : { 'status': closingStatus }
				});
				return updateIssueP(config.gc.project, gcIssue, closingComment);
			}));
		}).then(function(gcClosingComments) {
			done(null, gcClosingComments);
		}).fail(function(err) {
			done(err);
		}).done();
	};
};


// Export!
var Api = {
	create: function() { return new Migrator(); }
};
module.exports = Api;

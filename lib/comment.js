/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

var gcph = require('gcph-client');
var GCComment = gcph.Comment;
var GCIssue = gcph.Issue;

var convertDate = require('./util/gc2gh-date-convert');

/**
* Definition of properties gleaned from:
*   http://developer.github.com/v3/issues/comments/#create-a-comment
*   https://gist.github.com/7f75ced1fa7576412901/006a7c69f57521e026be85937c9641e861e81802
*/
var commentFields = [
	'id',           //'id'
	'user',         //'author'
	'body',         //'content' + 'issueUpdates'
	'created_at',   //'published'
	'updated_at'    //'updated'

	// Unused:
	//'title'
	//'links'
];

/**
*
*/
var Comment = function(values) {
	// Allow `Comment()` to work the same as `new Comment()`
	if (!(this instanceof Comment)) {
		return new Comment(values);
	}
	
	var me = this;
	
	commentFields.map(function(e) {
		Object.defineProperty(me, e, {
			value: values ? (values[e] || null) : null,
			writable: true,
			enumerable: true
		});
	});
	
	// Seal it off!
	Object.seal(me);
	
	return me;
};

/**
*
*/
Comment.prototype.toRawComment = function() {
	var rawComment = {
		'body': this.body,
		'created_at': this.created_at,
		'updated_at': this.updated_at
	};
	if (this.id) {
		rawComment.id = this.id;
	}
	
	if (this.user) {
		var userKeyType = (this.user.indexOf('@') !== -1) ? 'email' : 'login';
		var userObj = {};
		userObj[userKeyType] = this.user;
		rawComment.user = userObj;
	}
	
	return rawComment;
};

/**
* Create a GitHub Comment from a Google Code Comment
*/
Comment.fromGCComment = function(gcComment, ghIssueIdOffset) {
	if (!gcComment) {
		throw new TypeError('`gcComment` is empty');
	}
	if (!(gcComment instanceof GCComment)) {
		throw new TypeError('`gcComment` is not an instance of a Google Code Comment');
	}
	// Default to 0
	ghIssueIdOffset = (typeof ghIssueIdOffset === 'number') ? ghIssueIdOffset : 0;
	
	try {
		var commentValues = {
			'body': formatCommentBody(gcComment, ghIssueIdOffset),
			'created_at': convertDate(gcComment.published),
			'updated_at': convertDate(gcComment.updated),
			'user': gcComment.author.email
		};
		return new Comment(commentValues);
	}
	catch (e) {
		var id = (gcComment && gcComment.id) ? gcComment.id : 'WTF';
		var issueId = (gcComment && gcComment.issueId) ? gcComment.issueId : 'WTF';
		console.error('Error evaluating Comment #' + id + ' from GC-Issue #' + issueId + ': ' + e.stack + '\n\nJSON:\n' + JSON.stringify(gcComment) + '\n');
	}
};

var formatCommentBody = function(gcComment, ghIssueIdOffset) {
	var body = gcComment.content || '',
		cleanedContentLength = body.replace(/\s/g, '').length,
		gcProject = gcComment.project,
		formattedBody = 
			'_**[' + gcComment.author.displayName + '](' + gcComment.author.uri + ') commented:**_\r\n' +
			(
				cleanedContentLength ?
				'> ' + body.replace(/\s+$/, '').replace(/\r\n/g, '\r\n> ') :
				'> &nbsp;'
			);
	if (gcComment.issueUpdates) {
		var metadataUpdateKeys = Object.keys(gcComment.issueUpdates);
		if (metadataUpdateKeys.length) {
			formattedBody += '\r\n\r\n&nbsp;  \r\n_**Metadata Updates**_';
		}
		metadataUpdateKeys.forEach(function(key) {
			//title, status, owner, mergedInto, blocks, ccs, labels
			var metadataUpdateText = '';
			switch (key) {
				case 'title':
				case 'status':
				case 'owner':
					metadataUpdateText += '\r\n - **' + key.charAt(0).toUpperCase() + key.substring(1) + ' updated:** ' + gcComment.issueUpdates[key];
					break;
				
				case 'mergedInto':
					var gcMergedIssueId = gcComment.issueUpdates[key],
						gcMergedIssueHtmlUrl = GCIssue.getUrl(gcComment.project, gcMergedIssueId),
						ghMergedIssueId = gcMergedIssueId + ghIssueIdOffset;
						
					metadataUpdateText += '\r\n - **Merged into:** #' + ghMergedIssueId + ' ([GC-' + gcMergedIssueId + '](' + gcMergedIssueHtmlUrl + '))';
					break;
				
				case 'blocks':
					var blocks = gcComment.issueUpdates[key],
						blocksRemoved = blocks.removed,
						blocksAdded = blocks.added;
					if (blocksRemoved.length) {
						metadataUpdateText += '\r\n - **Blocking issue(s) removed:**\r\n' +
							blocksRemoved.map(function(block) {
								return '    - #' + (block + ghIssueIdOffset) + ' ([GC-' + block + '](' + GCIssue.getUrl(gcProject, block) + '))\r\n';
							}).join('');
					}
					if (blocksAdded.length) {
						metadataUpdateText += '\r\n - **Blocking issue(s) added:**\r\n' +
							blocksAdded.map(function(block) {
								return '    - #' + (block + ghIssueIdOffset) + ' ([GC-' + block + '](' + GCIssue.getUrl(gcProject, block) + '))\r\n';
							}).join('');
					}
					break;
				
				case 'ccs':
					var ccs = gcComment.issueUpdates[key],
						ccsRemoved = ccs.removed,
						ccsAdded = ccs.added;
					if (ccsRemoved.length) {
						metadataUpdateText += '\r\n - **CC(s) removed:**\r\n' +
							ccsRemoved.map(function(cc) {
								return '    - ' + cc + '\r\n';
							}).join('');
					}
					if (ccsAdded.length) {
						metadataUpdateText += '\r\n - **CC(s) added:**\r\n' +
							ccsAdded.map(function(cc) {
								return '    - ' + cc + '\r\n';
							}).join('');
					}
					break;
				
				case 'labels':
					var labels = gcComment.issueUpdates[key],
						labelsAdded =
							labels.added.filter(function(label) {
								// Return all non-Milestone labels
								return label.indexOf('Milestone-') !== 0;
							}),
						milestonesAdded =
							labels.added.filter(function(label) {
								// Return only Milestone labels
								return label.indexOf('Milestone-') === 0;
							}).map(function(milestone) {
								return milestone.substring(10);  // 10 === 'Milestone-'.length;
							}),
						labelsRemoved =
							labels.removed.filter(function(label) {
								// Return all non-Milestone labels
								return label.indexOf('Milestone-') !== 0;
							}),
						milestonesRemoved =
							labels.removed.filter(function(label) {
								// Return only Milestone labels
								return label.indexOf('Milestone-') === 0;
							}).map(function(milestone) {
								return milestone.substring(10);  // 10 === 'Milestone-'.length;
							});
					
					if (labelsRemoved.length) {
						metadataUpdateText += '\r\n - **Label(s) removed:**\r\n' +
							labelsRemoved.map(function(e) {
								return '    - ' + e + '\r\n';
							}).join('');
					}
					if (labelsAdded.length) {
						metadataUpdateText += '\r\n - **Label(s) added:**\r\n' +
							labelsAdded.map(function(e) {
								return '    - ' + e + '\r\n';
							}).join('');
					}
					
					// If any Milestones were updated
					if (!(milestonesRemoved.length === 0 && milestonesAdded.length === 0)) {
						// Milestone added
						if (milestonesRemoved.length === 0 && milestonesAdded.length === 1) {
							metadataUpdateText += '\r\n - **Milestone updated:** ' + milestonesAdded[0] + ' (was: ---)';
						}
						// Milestone changed
						else if (milestonesRemoved.length === 1 && milestonesAdded.length === 1) {
							metadataUpdateText += '\r\n - **Milestone updated:** ' + milestonesAdded[0] + ' (was: ' + milestonesRemoved[0] + ')';
						}
						// Milestone removed
						else if (milestonesRemoved.length === 1 && milestonesAdded.length === 0) {
							metadataUpdateText += '\r\n - **Milestone updated:** --- (was: ' + milestonesRemoved[0] + ')';
						}
						// Multiple Milestones updated... allowed by Google Code but NOT by GitHub
						else {
							if (milestonesRemoved.length) {
								metadataUpdateText += '\r\n - **Milestone(s) removed:**\r\n' +
									milestonesRemoved.map(function(e) {
										return '    - ' + e + '\r\n';
									}).join('');
							}
							if (milestonesAdded.length) {
								metadataUpdateText += '\r\n - **Milestone(s) added:**\r\n' +
									milestonesAdded.map(function(e) {
										return '    - ' + e + '\r\n';
									}).join('');
							}
						}
					}
					break;
				
				default:
					break;
			}
			formattedBody += metadataUpdateText;
		});
	}
	return formattedBody;
};

// Export!
module.exports = Comment;

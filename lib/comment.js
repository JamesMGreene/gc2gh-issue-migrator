/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

var GCComment = require('gcph-client').Comment;

var convertDate = require('./util/gc2gh-date-convert');
var formatCommentBody = require('./util/gc2gh-comment-formatter');
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

// Export!
module.exports = Comment;

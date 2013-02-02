/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

var gcph = require('gcph-client');
var GCIssue = gcph.Issue;

var convertDate = require('./util/gc2gh-date-convert');

/**
* Definition of properties gleaned from:
*   http://developer.github.com/v3/issues/#get-a-single-issue
*   https://gist.github.com/7f75ced1fa7576412901/006a7c69f57521e026be85937c9641e861e81802
*/
var issueFields = [
	'number',      //'id'
	'title',       //'title'
	'body',        //'content'
	'labels',      //'labels', 'status' (but more advanced)
	'milestone',   //'labels' (but sliced out separately)
	'state',       //'state'
	'created_at',  //'published'
	'updated_at',  //'updated'
	'closed_at',   //'closedDate'
	'user',        //'author' (but more advanced)
	'assignee',    //'owner' (but more advanced)
	'closed_by',   // author of the relevant closing comment
	'comments'     // --> comments.length (GH starts as a number, then can query further and replace)
	//'# of comments with +1 in body' --> 'stars'
	//'watchers'?      -->'ccs'
	//more 'labels'    -->'status'
	//'url'            -->'links' (partial)
	//'pull_request'   --> comments with revision links in them
	//'id',            --> N/A  (GitHub's unique internal ID)
	//'html_url',      -->'links' (partial)
	//'events_url',    -->'links' (partial)
	//'comments_url',  -->'links' (partial)
	//'labels_url',    -->'links' (partial)
];

/**
*
*/
var Issue = function(values) {
	// Allow `Issue()` to work the same as `new Issue()`
	if (!(this instanceof Issue)) {
		return new Issue(values);
	}
	
	var me = this;
	
	issueFields.map(function(e) {
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
* Convert the conveniently notated Issue into the equivalent raw notation necessary for the GitHub API
*/
Issue.prototype.toRawIssue = function(ghMilestoneMap) {
	var rawIssue = {
		'number': this.number,
		'title': this.title,
		'body': this.body,
		'labels':
			(this.labels || []).map(function(label) {
				if (typeof label === 'string') {
					return { 'name': label };
				}
				return label;
			}).filter(function(label) {
				return (typeof label === 'object' && label !== null);
			}),
		'milestone':
			!this.milestone ?
				null :
				(function(milestone) {
					if (typeof milestone === 'number') {
						return { 'number': parseInt(milestone, 10) };
					}
					if ((typeof milestone === 'string') && ghMilestoneMap && Object.keys(ghMilestoneMap).length) {
						var milestoneId = parseInt(ghMilestoneMap[milestone], 10);
						return milestoneId ? { 'number': milestoneId } : null;
					}
					return null;
				})(this.milestone),
		'state': (typeof this.state !== 'string' || this.state.toLowerCase() !== 'closed' ? 'open' : 'closed'),
		'created_at': this.created_at,
		'updated_at': this.updated_at,
		'closed_at': this.closed_at
	};
	
	['user', 'assignee', 'closed_by'].forEach(function(e) {
		var userObj = null;
		if (this[e]) {
			var userKeyType = (this[e].indexOf('@') !== -1) ? 'email' : 'login';
			userObj = {};
			userObj[userKeyType] = this[e];
		}
		rawIssue[e] = userObj;
	}, this);
	
	return rawIssue;
};

// We suggest adding a special 'Migrated' closed status to your Google Code project for closing them out during migration
var closedIssueStatuses = ['Fixed', 'Invalid', 'Duplicate', 'WontFix', 'Migrated'];

/**
* Create a GitHub Issue (without comments) from a Google Code Issue (with comments, if any, to bridge the metadata gap)
*/
Issue.fromGCIssue = function(gcIssueWithComments, ghIssueIdOffset) {
	if (!gcIssueWithComments) {
		throw new TypeError('`gcIssueWithComments` is empty');
	}
	if (!(gcIssueWithComments instanceof GCIssue)) {
		throw new TypeError('`gcIssueWithComments` is not an instance of a Google Code Issue');
	}
	// Default to 0
	ghIssueIdOffset = (typeof ghIssueIdOffset === 'number') ? ghIssueIdOffset : 0;
	
	try {
		var issueValues = {
			'number': gcIssueWithComments.id + ghIssueIdOffset,
			'title': normalizeSpace(gcIssueWithComments.title),
			'body': formatIssueBody(gcIssueWithComments),
			'labels':
				(gcIssueWithComments.labels || []).filter(function(label) {
					// Return all non-Milestone labels
					return label.indexOf('Milestone-') !== 0;
				}).concat(['Status-' + gcIssueWithComments.status]),
			'milestone':
				// At this stage, just get the milestone NAME from the GC Issue
				(function() {
					var milestones = (gcIssueWithComments.labels || []).filter(function(label) {
						// Return only Milestone labels
						return label.indexOf('Milestone-') === 0;
					});
					if (milestones.length) {
						return milestones[milestones.length - 1].substring(10);  // 10 === 'Milestone-'.length;
					}
					return null;
				})(),
			'state': gcIssueWithComments.state,
			'created_at': convertDate(gcIssueWithComments.published),
			'updated_at': convertDate(gcIssueWithComments.updated),
			'closed_at': convertDate(gcIssueWithComments.closedDate),
			'user': gcIssueWithComments.author.email,
			'assignee': (gcIssueWithComments.owner && gcIssueWithComments.owner.email) || null,
			'closed_by':
				(gcIssueWithComments.state !== 'closed') ?
					null :
					(function(comments) {
						// Get the author of the relevant closing comment
						var closingComments = comments.filter(function(comment) {
							return (
								comment.issueUpdates &&
								comment.issueUpdates.status &&
								closedIssueStatuses.indexOf(comment.issueUpdates.status) !== -1
							);
						});
						return closingComments.length ? closingComments[closingComments.length - 1].author.email : null;
					})(gcIssueWithComments.comments || [])
		};
		return new Issue(issueValues);
	}
	catch (e) {
		var id = (gcIssueWithComments && gcIssueWithComments.id) ? gcIssueWithComments.id : 'WTF';
		console.error('Error evaluating Issue #' + id + ': ' + e.stack + '\n\nJSON:\n' + JSON.stringify(gcIssueWithComments) + '\n');
	}
};

var normalizeSpace = function(s) {
	if (!s) {
		return '';
	}
	return ('' + s).replace(/\s+/g, ' ').replace(/^\s|\s$/, '');
};

var formatIssueBody = (function() {
	var pad2zero = function(s) {
		s = '' + (s || '');
		while (s.length < 2) {
			s = '0' + s;
		}
		return s;
	};

	var formatDate = function(date) {
		return date.getFullYear() + '-' + pad2zero(date.getMonth() + 1) + '-' + pad2zero(date.getDate());
	};

	var getTodaysDate = function() {
		return formatDate(new Date());
	};
	
	var getHtmlUrl = function(gcIssue) {
		var url, i, len, link;
		for (i = 0, len = gcIssue.links.length; i < len; i++) {
			link = gcIssue.links[i];
			if (link.rel === "alternate" && link.type === "text/html" && link.href) {
				url = link.href;
				break;
			}
		}
		return url;
	};

	return function(gcIssue) {
		var body = gcIssue.content || '',
			formattedBody = 
				'_**[' + gcIssue.author.displayName + '](' + gcIssue.author.uri + ') commented:**_\r\n' +
				'> ' + body.replace(/\s+$/, '').replace(/\r\n/g, '\r\n> ') + '\r\n' +
				'\r\n' +
				'**Disclaimer:**\r\n' +
				'This issue was migrated on ' + getTodaysDate() + ' from the project\'s former issue tracker on Google Code, [Issue #' + gcIssue.id + '](' + getHtmlUrl(gcIssue) + ').\r\n' +
				':star2: &nbsp; **' + gcIssue.stars + '** people had starred this issue at the time of migration.';
		return formattedBody;
	};
})();


// Export!
module.exports = Issue;

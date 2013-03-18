/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

var GCIssue = require('gcph-client').Issue;

module.exports = function formatCommentBody(gcComment, ghIssueIdOffset) {
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
			formattedBody += '\r\n\r\n&nbsp;  \r\n_**Metadata Updates**_\r\n';
		}
		metadataUpdateKeys.forEach(function(key) {
			//title, status, owner, mergedInto, blocks, ccs, labels
			var metadataUpdateText = '';
			switch (key) {
				case 'title':
				case 'status':
				case 'owner':
					metadataUpdateText += ' - **' + key.charAt(0).toUpperCase() + key.substring(1) + ' updated:** ' + gcComment.issueUpdates[key] + '\r\n';
					break;
				
				case 'mergedInto':
					var gcMergedIssueId = gcComment.issueUpdates[key],
						gcMergedIssueHtmlUrl = GCIssue.getUrl(gcComment.project, gcMergedIssueId),
						ghMergedIssueId = gcMergedIssueId + ghIssueIdOffset;
						
					metadataUpdateText += ' - **Merged into:** #' + ghMergedIssueId + ' ([GC-' + gcMergedIssueId + '](' + gcMergedIssueHtmlUrl + '))\r\n';
					break;
				
				case 'blocks':
					var blocks = gcComment.issueUpdates[key],
						blocksRemoved = blocks.removed,
						blocksAdded = blocks.added;
					if (blocksRemoved.length) {
						metadataUpdateText += ' - **Blocking issue(s) removed:**\r\n' +
							blocksRemoved.map(function(block) {
								return '    - #' + (block + ghIssueIdOffset) + ' ([GC-' + block + '](' + GCIssue.getUrl(gcProject, block) + '))\r\n';
							}).join('');
					}
					if (blocksAdded.length) {
						metadataUpdateText += ' - **Blocking issue(s) added:**\r\n' +
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
						metadataUpdateText += ' - **CC(s) removed:**\r\n' +
							ccsRemoved.map(function(cc) {
								return '    - ' + cc + '\r\n';
							}).join('');
					}
					if (ccsAdded.length) {
						metadataUpdateText += ' - **CC(s) added:**\r\n' +
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
						metadataUpdateText += ' - **Label(s) removed:**\r\n' +
							labelsRemoved.map(function(e) {
								return '    - ' + e + '\r\n';
							}).join('');
					}
					if (labelsAdded.length) {
						metadataUpdateText += ' - **Label(s) added:**\r\n' +
							labelsAdded.map(function(e) {
								return '    - ' + e + '\r\n';
							}).join('');
					}
					
					// If any Milestones were updated
					if (!(milestonesRemoved.length === 0 && milestonesAdded.length === 0)) {
						// Milestone added
						if (milestonesRemoved.length === 0 && milestonesAdded.length === 1) {
							metadataUpdateText += ' - **Milestone updated:** ' + milestonesAdded[0] + ' (was: ---)\r\n';
						}
						// Milestone changed
						else if (milestonesRemoved.length === 1 && milestonesAdded.length === 1) {
							metadataUpdateText += ' - **Milestone updated:** ' + milestonesAdded[0] + ' (was: ' + milestonesRemoved[0] + ')\r\n';
						}
						// Milestone removed
						else if (milestonesRemoved.length === 1 && milestonesAdded.length === 0) {
							metadataUpdateText += ' - **Milestone updated:** --- (was: ' + milestonesRemoved[0] + ')\r\n';
						}
						// Multiple Milestones updated... allowed by Google Code but NOT by GitHub
						else {
							if (milestonesRemoved.length) {
								metadataUpdateText += ' - **Milestone(s) removed:**\r\n' +
									milestonesRemoved.map(function(e) {
										return '    - ' + e + '\r\n';
									}).join('');
							}
							if (milestonesAdded.length) {
								metadataUpdateText += ' - **Milestone(s) added:**\r\n' +
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
/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

module.exports = convertGCDateToISO8601;

function convertGCDateToISO8601(dateStr) {
	if (dateStr && typeof dateStr === 'string') {
		return dateStr.replace(/\.\d\d\dZ$/, 'Z');
	}
	return null;
}
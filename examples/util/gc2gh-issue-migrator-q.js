/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External modules
var Qify = require('../../lib/util/q-ify');
var migrator = require('../../lib/gc2gh-issue-migrator').create();

module.exports = Qify(migrator);

#!/usr/bin/env node

'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var INFO = _chalk2.default.bold.white.bgBlue;
var ERR = _chalk2.default.bold.white.bgRed;
var OK = _chalk2.default.bold.black.bgGreen;

_commander2.default.version('v0.2.1', '-v, --version').option('-p, --project <path>', 'your PipelineDog project file', null, null).option('-l, --list <path>', 'file lists for the run, separated by commas', function (val) {
  return val.split(',');
}, null).option('-o, --output [path]', 'path to output shell command file', null, null).parse(process.argv);

if (!_commander2.default.project) {
  console.log(ERR('Error:') + ' Missing pipeline file. Specify using the -p option.');
  process.exit();
}
if (!_commander2.default.list) {
  console.log(ERR('Error:') + ' Missing list file. Specify using the -l option.');
  process.exit();
}
if (!_commander2.default.output) _commander2.default.output = "pipeline_command.sh";

try {
  (function () {
    var inTxt = _fs2.default.readFileSync(_commander2.default.project, 'utf8');
    var flists = [];
    _commander2.default.list.map(function (l) {
      flists.push({ name: _path2.default.basename(l), content: _fs2.default.readFileSync(l, 'utf8') });
    });

    var _resolveSteps = new _parser2.default().resolveSteps(inTxt);

    var gvar = _resolveSteps.gvar;
    var steps = _resolveSteps.steps;


    var newSteps = new _parser2.default().parseAllSteps(gvar, flists, steps);
    var exportTxt = new _parser2.default().combineCommands(newSteps);
    _fs2.default.writeFileSync(_commander2.default.output, exportTxt, 'utf8');
    console.log(OK('Success') + ' Pipeline commands sucessfully parsed.');
  })();
} catch (e) {
  console.log(ERR('Error:') + ' ' + e);
}
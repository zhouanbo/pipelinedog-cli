'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _flat = require('flat');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Parser = function () {
  function Parser() {
    _classCallCheck(this, Parser);
  }

  _createClass(Parser, [{
    key: 'parseStep',
    value: function parseStep(text, gvar, flists, steps) {
      //concat global vars with the step code
      var parseText = gvar + "\n" + text;
      //read raw step obj
      var rawObj = {};
      try {
        rawObj = _jsYaml2.default.safeLoad(parseText);
      } catch (e) {
        throw { type: "Malformated YAML", message: e };
      }
      //replace vars
      var rvObj = this.replaceVars(rawObj);
      //get only the keys inside step
      var stepObj = rvObj[Object.keys(rvObj)[0]];
      //check stepOjb status
      if (!stepObj || !stepObj['name'] || !stepObj['in'] || !stepObj['run']) throw { type: "Missing Keys", message: "You are missing one of the mandatory keys: name, in, or run." };
      //console.log("stepObj:")
      //console.log(stepObj)
      //set step ID
      var haveID = false;
      steps.map(function (step) {
        if (step.id === stepObj.id) haveID = true;
      });
      if (!haveID) {
        stepObj.id = Object.keys(rvObj)[0];
      } else {
        throw { type: "Duplicate ID", message: "You already have a same step ID defined before." };
      }
      //process input lines
      var lines = this.processInArr(stepObj, flists, steps);
      //console.log("inLines:\n"+lines)
      //count loops for this step
      var loopNum = this.countLoop(stepObj, lines);
      //console.log("loopNum:\n"+loopNum)
      //parse the LEASH expressions

      var _parseLEASH = this.parseLEASH(stepObj, lines, loopNum);

      var command = _parseLEASH.command;
      var outObj = _parseLEASH.outObj;
      //console.log("command:\n"+command)

      return {
        id: stepObj.id,
        name: stepObj.name,
        code: text,
        command: command,
        out: outObj,
        comment: stepObj.comment
      };
    }
  }, {
    key: 'combineCommands',
    value: function combineCommands(steps) {
      var result = '#!/bin/bash\n\n';
      var previousNum = void 0;
      var currentNum = void 0;
      steps.concat().sort(function (a, b) {
        return Number(a.id.replace('-', '')) - Number(b.id.replace('-', ''));
      }).map(function (step, idx) {
        if (idx === 0) previousNum = Number(step.id.split('-')[0]);
        currentNum = Number(step.id.split('-')[0]);
        if (idx !== 0) {
          if (currentNum !== previousNum && steps[idx - 1].command) {
            result += 'wait\n';
            previousNum = currentNum;
          }
          result += '\n';
        }
        result += step.id ? '# Step ID: ' + step.id + '\n' : "";
        result += step.name ? '# Step Name: ' + step.name + '\n' : "";
        result += step.comment ? '# Comment: ' + step.comment + '\n' : "";
        result += step.command ? '# Command: \n' + step.command + '\n' : "";
      });
      return result;
    }
  }, {
    key: 'parseAllSteps',
    value: function parseAllSteps(gvar, flists, steps) {
      var _this = this;

      var newSteps = steps;
      newSteps.forEach(function (step, index) {
        try {
          var newStep = _this.parseStep(step.code, gvar, flists, steps);
          newSteps[index] = newStep;
        } catch (e) {
          throw { type: 'Step: ' + (step.name ? step.name.toString() : "Undefined") + ' Failed', message: "One or more of your steps failed for " + e.type + ", please check. Message: " + e.message };
        }
      });
      return newSteps;
    }
  }, {
    key: 'combineSteps',
    value: function combineSteps(gvar, steps) {
      var rText = gvar ? gvar + "\n\n" : "";
      steps.map(function (step) {
        rText += step.code + '\n\n';
      });
      return rText;
    }
  }, {
    key: 'resolveSteps',
    value: function resolveSteps(text) {
      var isStep = function isStep(testObj) {
        var stepTest = false;
        if (testObj && (typeof testObj === 'undefined' ? 'undefined' : _typeof(testObj)) === 'object') {
          Object.keys(testObj).map(function (testKey) {
            if (testKey.indexOf('~') === 0) {
              stepTest = true;
            }
          });
        }
        return stepTest;
      };

      var objs = _jsYaml2.default.safeLoad(text);
      var steps = [];
      var objsKeys = Object.keys(objs);
      objsKeys.map(function (key) {
        var dumpObj = {};
        dumpObj[key] = objs[key];
        if (isStep(objs[key])) {
          steps.push({
            id: "",
            name: "",
            code: _jsYaml2.default.safeDump(dumpObj),
            command: "",
            out: {},
            comment: ""
          });
          delete objs[key];
        }
      });
      var gvar = _jsYaml2.default.safeDump(objs);

      if (gvar === "{}\n") gvar = "";
      console.log(gvar);
      return { gvar: gvar, steps: steps };
    }
  }, {
    key: 'replaceVars',
    value: function replaceVars(rawObj) {
      var varObj = {};
      var gvarObj = {};
      var rObj = rawObj;

      var flatObj = (0, _flat.flatten)(rObj, { safe: true });

      //change numbers to strings
      Object.keys(flatObj).map(function (key) {
        if (typeof flatObj[key] === 'number') flatObj[key] = flatObj[key].toString();
      });

      //get vars
      Object.keys(rObj).map(function (key, index) {
        if (index === Object.keys(rObj).length - 1) {
          (function () {
            Object.keys(rObj[key]).map(function (stepKey) {
              varObj[stepKey] = rObj[key][stepKey];
            });
            var flatStepObj = (0, _flat.flatten)(rObj[key], { safe: true });
            Object.keys(flatStepObj).map(function (stepKey) {
              varObj[stepKey] = flatStepObj[stepKey];
            });
          })();
        } else {
          gvarObj[key] = rObj[key];
        }
      });

      var flatVarObj = Object.assign(varObj, (0, _flat.flatten)(gvarObj, { safe: true }));

      //switch vars in a string
      var processValue = function processValue(value) {
        if (typeof value === 'string') {
          //sort to make sure the longer vars get recognized first
          Object.keys(flatVarObj).sort(function (a, b) {
            return b.length - a.length;
          }).map(function (processKey) {
            var pos = typeof value === 'string' ? value.indexOf('$' + processKey, pos + 1) : -1;
            while (pos !== -1) {
              if (typeof flatVarObj[processKey] === 'string') {
                value = value.replace('$' + processKey, flatVarObj[processKey]);
              } else {
                value = flatVarObj[processKey];
              }
              pos = typeof value === 'string' ? value.indexOf('$' + processKey, pos + 1) : -1;
            }
          });
          return value;
        }
      };

      //replace keys
      Object.keys(flatObj).map(function (key) {
        var processedKey = processValue(key);
        if (processedKey !== key) {
          flatObj[processedKey] = flatObj[key];
          delete flatObj[key];
        }
      });
      //replace values
      var haveVar = function haveVar() {
        var rKey = false;
        Object.keys(flatObj).map(function (key) {
          Object.keys(flatVarObj).map(function (varKey) {
            if (flatObj[key] && typeof flatObj[key] === 'string' && flatObj[key].indexOf('$' + varKey) > -1 && key.indexOf("comment") === -1) {
              rKey = key;
            }
          });
        });
        return rKey;
      };
      var varKey = void 0;
      while (varKey = haveVar()) {
        flatObj[varKey] = processValue(flatObj[varKey]);
      }

      rObj = (0, _flat.unflatten)(flatObj);
      //remove var definitions
      var rObjKeys = Object.keys(rObj);
      rObjKeys.map(function (key, index) {
        if (index !== rObjKeys.length - 1) {
          delete rObj[key];
        }
      });

      return rObj;
    }
  }, {
    key: 'processInArr',
    value: function processInArr(stepObj, flists, steps) {
      //process in array
      var inArr = [];
      if (stepObj['in']) {
        if (typeof stepObj['in'] === 'string') {
          inArr.push(stepObj['in']);
        } else {
          stepObj['in'].map(function (input) {
            inArr.push(input);
          });
        }
      } else {
        return;
      }
      //concat in content
      var lines = [];
      inArr.map(function (inFile) {
        flists.map(function (flist) {
          if (inFile === '$' + flist.name.replace(/ /g, '_')) {
            (function () {
              var subLine = [];
              flist.content.split('\n').map(function (line) {
                if (line !== "") subLine.push(line);
              });
              lines.push(subLine);
            })();
          }
        });
        steps.map(function (step) {
          Object.keys(step.out).map(function (outKey) {
            var outStr = outKey === 'default' ? "" : outKey;
            if (inFile === '$' + step.id + ".out" + outStr) {
              (function () {
                var subLine = [];
                step.out[outKey].split('\n').map(function (line) {
                  subLine.push(line);
                });
                lines.push(subLine);
              })();
            }
          });
        });
      });

      return lines;
    }
  }, {
    key: 'countLoop',
    value: function countLoop(stepObj, lines) {
      var _ref,
          _this2 = this;

      var flatLines = (_ref = []).concat.apply(_ref, _toConsumableArray(lines));
      var loopNum = flatLines.length;
      var eachLoop = 1;

      Object.keys(stepObj).map(function (key) {
        //find LEASH expressions
        if (key.indexOf('~') === 0) {
          if (stepObj[key]['file'] && stepObj['in']) {
            (function () {
              var _ref2;

              var fileArr = _this2.parseRange(stepObj[key]['file'], stepObj['in']).map(function (v) {
                return v - 1;
              });
              var concatArr = lines.filter(function (v, i) {
                return fileArr.includes(i);
              });
              flatLines = (_ref2 = []).concat.apply(_ref2, _toConsumableArray(concatArr));
            })();
          }

          var lineStr = stepObj[key]['line'] ? stepObj[key]['line'] : "-";
          var lineArr = [];
          if (lineStr.indexOf(':') > -1) {
            lineArr = lineStr.split(':');
            eachLoop = Number(lineArr[1]) === 0 ? flatLines.length : Number(lineArr[1]);
          } else {
            lineArr[0] = lineStr;
          }
          var selectedLineNum = _this2.parseRange(lineArr[0], flatLines).length;
          var actualLineNum = selectedLineNum < flatLines.length ? selectedLineNum : flatLines.length;
          var newNum = Math.floor(actualLineNum / eachLoop);
          loopNum = newNum < loopNum ? newNum : loopNum;
        }
      });
      return loopNum;
    }
  }, {
    key: 'parseLEASH',
    value: function parseLEASH(stepObj, lines, loopNum) {
      var _this3 = this;

      var LEASH = function LEASH(LEASHObj, loop) {
        var out = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

        var flatLines = [];
        var eachLoop = 1;

        //file key
        if (LEASHObj.file) {
          (function () {
            var _ref3;

            var fileArr = _this3.parseRange(LEASHObj['file'], stepObj['in']).map(function (v) {
              return v - 1;
            });
            var concatArr = lines.filter(function (v, i) {
              return fileArr.includes(i);
            });
            flatLines = (_ref3 = []).concat.apply(_ref3, _toConsumableArray(concatArr));
          })();
        } else {
          var _ref4;

          flatLines = (_ref4 = []).concat.apply(_ref4, _toConsumableArray(lines));
        }

        //line key
        var selectedLines = [];
        var lineStr = LEASHObj.line ? LEASHObj['line'] : "-";
        var lineArr = [];
        if (lineStr.indexOf(':') > -1) {
          lineArr = lineStr.split(':');
          eachLoop = Number(lineArr[1]) === 0 ? flatLines.length : Number(lineArr[1]);
        } else {
          lineArr[0] = lineStr;
        }
        var selectedLineArr = _this3.parseRange(lineArr[0], flatLines).map(function (v) {
          return v - 1;
        });
        selectedLines = flatLines.filter(function (v, i) {
          return selectedLineArr.includes(i);
        });

        //filter lines for each loop
        var loopingLines = selectedLines.filter(function (v, i) {
          return i >= eachLoop * loop && i < eachLoop * (loop + 1);
        });

        //mods key
        var modsLines = loopingLines;
        if (LEASHObj.mods) {
          modsLines = loopingLines.map(function (line) {
            var modsLine = LEASHObj.mods;
            //predefined vars
            var pvars = {
              "$ENTRY": line,
              "$FILENAME_NOEXT": _path2.default.basename(line).substr(0, _path2.default.basename(line).lastIndexOf('.')),
              "$FILENAME": _path2.default.basename(line),
              "$DIRNAME": _path2.default.dirname(line),
              "$PARENT_DIR": _path2.default.resolve(_path2.default.dirname(line), "../"),
              "$SEP": _path2.default.sep
            };
            Object.keys(pvars).map(function (key) {
              var pos = LEASHObj.mods.indexOf(key);
              while (pos !== -1) {
                modsLine = modsLine.replace(key, pvars[key]);
                pos = LEASHObj.mods.indexOf(key, pos + 1);
              }
            });
            return modsLine;
          });
        }

        //mod key
        var modLines = modsLines;
        if (LEASHObj.mod) {
          (function () {
            var matchArr = LEASHObj.mod.match(/\w'.+'/g);
            modLines = modLines.map(function (line) {
              var modLine = line;
              matchArr.map(function (seg) {
                var segArr = seg.split("'");

                (function () {
                  switch (segArr[0]) {
                    case 'P':
                      modLine = segArr[1] + modLine;
                      break;
                    case 'S':
                      modLine = modLine + segArr[1];
                      break;
                    case 'L':
                      var levelArr = _path2.default.dirname(modLine).split(_path2.default.sep);
                      var selectedLevelArr = [];
                      _this3.parseRange(segArr[1], levelArr).map(function (index) {
                        if (_path2.default.dirname(modLine).indexOf(_path2.default.sep) === 0) {
                          selectedLevelArr.push(levelArr[index]);
                        } else {
                          selectedLevelArr.push(levelArr[index - 1]);
                        }
                      });
                      modLine = _path2.default.resolve(selectedLevelArr.join(_path2.default.sep), _path2.default.basename(modLine));
                      break;
                    case 'F':
                      var fileArr = _path2.default.basename(modLine).split('.');
                      var selectedFileArr = [];
                      _this3.parseRange(segArr[1], fileArr).map(function (index) {
                        selectedFileArr.push(fileArr[index - 1]);
                      });
                      modLine = _path2.default.resolve(_path2.default.dirname(modLine), selectedFileArr.join('.'));
                      break;
                  }
                })();
              });
              return modLine;
            });
          })();
        }

        //sep key
        var sepStr = "";
        if (out) {
          sepStr = modLines.join('\n');
        } else if (LEASHObj.sep) {
          sepStr = modLines.join(LEASHObj.sep);
        } else {
          sepStr = modLines.join(' ');
        }

        return sepStr;
      };

      //generate commands
      var command = [];

      var _loop = function _loop(i) {
        //parse one command without loop
        var run = stepObj.run;
        Object.keys(stepObj).map(function (key) {
          if (key.indexOf('~') === 0) {
            var pos = run.indexOf(key);
            while (pos !== -1) {
              run = run.replace(key, LEASH(stepObj[key], i));
              pos = stepObj.run.indexOf(key, pos + 1);
            }
          }
        });
        command.push(run);
      };

      for (var i = 0; i < loopNum; i++) {
        _loop(i);
      }
      command = command.join('\n');

      //generate out
      var outObj = {};
      Object.keys(stepObj).map(function (outKey) {
        if (outKey.indexOf('out') === 0) {
          (function () {
            var outStr = stepObj[outKey];
            var rStr = outStr;
            var result = [];

            var _loop2 = function _loop2(_i) {
              //decide to parse LEASH or string
              if (typeof outStr === 'string') {
                Object.keys(stepObj).map(function (key) {
                  if (key.indexOf('~') === 0) {
                    var pos = outStr.indexOf(key);
                    while (pos !== -1) {
                      rStr = outStr.replace(key, LEASH(stepObj[key], _i));
                      pos = outStr.indexOf(key, pos + 1);
                    }
                  }
                });
              } else {
                rStr = LEASH(outStr, _i, true);
              }
              result.push(rStr);
            };

            for (var _i = 0; _i < loopNum; _i++) {
              _loop2(_i);
            }
            if (outKey === 'out') {
              outObj['default'] = result.join('\n');
            } else {
              outObj[outKey.substr(3, outKey.length)] = result.join('\n');
            }
          })();
        }
      });

      return { command: command, outObj: outObj };
    }
  }, {
    key: 'parseRange',
    value: function parseRange(s, arr) {
      var length = arr.length;
      var r = [];
      if (s.indexOf('/') > -1) {
        var _ret11 = function () {
          //parse regex range
          var regex = new RegExp(s.slice(1, -1));
          arr.map(function (string, i) {
            if (string.search(regex) > -1) {
              r.push(i + 1);
            }
          });
          return {
            v: r
          };
        }();

        if ((typeof _ret11 === 'undefined' ? 'undefined' : _typeof(_ret11)) === "object") return _ret11.v;
      } else {
        //parse numeric range
        var a = s.split(',');
        a.map(function (ss, i) {
          if (ss.indexOf('-') > -1) {
            var b = ss.split('-');
            if (b[0] === "" && b[1] === "") {
              b[0] = 1;b[1] = length;
            } else if (b[1] === "") b[1] = length;else if (b[0] === "") b[0] = 1;else if (b.length > 2 || Number(b[0]) > Number(b[1])) {
              console.log("illegal range.");
              return;
            }
            for (var _i2 = Number(b[0]); _i2 <= Number(b[1]); _i2++) {
              r.push(_i2);
            }
          } else {
            r.push(Number(ss));
          }
        });
        r.sort(function (x, y) {
          return x - y;
        });
        return [].concat(_toConsumableArray(new Set(r)));
      }
    }
  }]);

  return Parser;
}();

exports.default = Parser;
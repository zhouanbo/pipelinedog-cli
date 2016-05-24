#!/usr/bin/env node
var fs = require('fs');
var spawn = require('child_process').spawn;
var path = require('path');
var program = require('commander');
var CodeParse = require('./codeParse');
var Util = require('./util');
var chalk = require('chalk');
var INFO = chalk.bold.white.bgBlue;
var ERR = chalk.bold.white.bgRed;
var OK = chalk.bold.black.bgGreen;

program
  .version('v0.0.1', '-v, --version')
  .option('-a, --action <string>', 'Action to perform: run or parse', null, null)
  .option('-p, --pipeline <path>', 'Pipeline file exported by PipelineDog', null, null)
  .option('-i, --input-list <path>', 'Input list for the run', null, null)
  .option('-d, --work-directory [path]', 'Directory to run pipeline', null, null)
  .option('-o, --output [path]', 'Path to output shell command file', null, null)
  .parse(process.argv);

if(!program.action) {
  console.log(ERR('Error:')+' Missing action. Specify by using -a option.');
  process.exit();
}
if(!program.pipeline) {
  console.log(ERR('Error:')+' Missing pipeline file. Specify by using -p option.');
  process.exit();
}
if(!program.workDirectory) {
  program.workDirectory = __dirname;
}
if(!program.output) {
  program.output = path.join(program.workDirectory, process.platform != 'win32' ? "pipeline_command.sh" : "pipeline_command.BAT");
}

//Read pipeline
var pipelineJSON = fs.readFileSync(program.pipeline);
var pipelineObj;
try{
  pipelineObj = JSON.parse(pipelineJSON);
}catch(e){
  console.log(ERR('Error:')+' Pipeline JSON is not valid.');
  process.exit();
}

//Simulate a React app state
var app = {
  state: {
    workDir: program.workDirectory,
    currentTool: 0,
    lastId: Util.objToArray(pipelineObj).lastId,
    tools: Util.objToArray(pipelineObj).array
  }
};

if(program.action === "run") {
  if(CodeParse.generateCommand(app)) {
    var pipeline;
    fs.writeFileSync(path.join(app.state.workDir, process.platform != 'win32' ? ".pipelinecommand.sh" : ".pipelinecommand.BAT"), app.state.command);
    if(process.platform != 'win32') {
      pipeline = spawn("bash", [path.join(app.state.workDir, ".pipelinecommand.sh")]);
    } else {
      pipeline = spawn(path.join(app.state.workDir, ".pipelinecommand.BAT"));
    }
    pipeline.stdout.on('data', function(data) {
      process.stdout.write(INFO('Output:')+' '+data.toString());
    });
    pipeline.stderr.on('data', function(data) {
      process.stdout.write(INFO('Output:')+' '+data.toString());
    });
    pipeline.on('close', function(code) {
      console.log(`PipelineDog exited with code ${code}`);
      fs.unlinkSync(path.join(app.state.workDir, process.platform != 'win32' ? ".pipelinecommand.sh" : ".pipelinecommand.BAT"));
    });
  }
}

if(program.action === "parse") {
  if(CodeParse.generateCommand(app)) {
    var writeState = app.state.command;
    fs.writeFile(program.output, writeState, function (err) {
      if (err) {
        return console.log(err);
      }
      console.log(OK('Success:')+" Command exported.");
    });
  }
}
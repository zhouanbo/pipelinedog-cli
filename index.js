#!/usr/bin/env node
'use strict'

import fs from 'fs'
import path from 'path'
import program from 'commander'
import Parser from './parser'
import chalk from 'chalk'

let INFO = chalk.bold.white.bgBlue
let ERR = chalk.bold.white.bgRed
let OK = chalk.bold.black.bgGreen

program.version('v0.2.1', '-v, --version')
  .option('-p, --project <path>', 'your PipelineDog project file', null, null)
  .option('-l, --list <path>', 'file lists for the run, separated by commas', (val)=>{return val.split(',')}, null)
  .option('-o, --output [path]', 'path to output shell command file', null, null)
  .parse(process.argv)

if (!program.project) {
  console.log(ERR('Error:') + ' Missing pipeline file. Specify using the -p option.')
  process.exit()
}
if (!program.list) {
  console.log(ERR('Error:') + ' Missing list file. Specify using the -l option.')
  process.exit()
}
if (!program.output) program.output = "pipeline_command.sh"

try {
  let inTxt = fs.readFileSync(program.project, 'utf8')
  let flists = []
  program.list.map(l=>{
    flists.push({name: path.basename(l), content: fs.readFileSync(l, 'utf8')})
  })

  let {gvar, steps} = new Parser().resolveSteps(inTxt)

  let newSteps = new Parser().parseAllSteps(gvar, flists, steps)
  let exportTxt = new Parser().combineCommands(newSteps)
  fs.writeFileSync(program.output, exportTxt, 'utf8')
  console.log(OK('Success') + ' Pipeline commands sucessfully parsed.')
} catch (e) {
  console.log(ERR('Error:') + ' ' + e)
}

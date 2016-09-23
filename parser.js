import path from 'path'
import yaml from 'js-yaml'
import { flatten, unflatten } from 'flat'


export default class Parser {

  constructor() {

  }

  parseStep(text, gvar, flists, steps) {
    //concat global vars with the step code
    let parseText = gvar + "\n" + text
    //read raw step obj
    let rawObj = {}
    try {
      rawObj = yaml.safeLoad(parseText)
    } catch(e) {
      throw {type: "Malformated YAML", message: e}
    }
    //replace vars
    let rvObj = this.replaceVars(rawObj)
    //get only the keys inside step
    let stepObj = rvObj[Object.keys(rvObj)[0]]
    //check stepOjb status
    if (!stepObj || !stepObj['name'] || !stepObj['in'] || !stepObj['run']) throw {type: "Missing Keys", message: "You are missing one of the mandatory keys: name, in, or run."}
    //console.log("stepObj:")
    //console.log(stepObj)
    //set step ID
    let haveID = false
    steps.map(step => {
      if (step.id === stepObj.id) haveID = true
    })
    if (!haveID) {
      stepObj.id = Object.keys(rvObj)[0]
    } else {
      throw {type: "Duplicate ID", message: "You already have a same step ID defined before."}
    }
    //process input lines
    let lines = this.processInArr(stepObj, flists, steps)
    //console.log("inLines:\n"+lines)
    //count loops for this step
    let loopNum = this.countLoop(stepObj, lines)
    //console.log("loopNum:\n"+loopNum)
    //parse the LEASH expressions
    let { command, outObj } = this.parseLEASH(stepObj, lines, loopNum)
    //console.log("command:\n"+command)

    return { 
      id: stepObj.id,
      name: stepObj.name, 
      code: text,
      command: command, 
      out: outObj, 
      comment: stepObj.comment 
    }
  }

  combineCommands(steps) {
    let result = `#!/bin/bash\n\n`
    let previousNum
    let currentNum
    steps.concat().sort((a,b)=>{
      return Number(a.id.replace('-',''))-Number(b.id.replace('-',''))
    }).map((step, idx) => {
      if (idx === 0) previousNum = Number(step.id.split('-')[0])
      currentNum = Number(step.id.split('-')[0])
      if (idx !== 0) {
        if (currentNum !== previousNum && steps[idx-1].command) {
          result += `wait\n`
          previousNum = currentNum
        } 
        result += '\n'
      }
      result += step.id ? `# Step ID: ${step.id}\n`: ""
      result += step.name ? `# Step Name: ${step.name}\n`: ""
      result += step.comment ? `# Comment: ${step.comment}\n` : ""
      result += step.command ? `# Command: \n${step.command}\n` : ""
    })
    return result
  }

  parseAllSteps(gvar, flists, steps) {
    let newSteps = steps
    newSteps.forEach((step, index) => {
      try {
        let newStep = this.parseStep(step.code, gvar, flists, steps)
        newSteps[index] = newStep
      } catch(e) {
        throw {type: `Step: ${step.name?step.name.toString():"Undefined"} Failed`, message: "One or more of your steps failed for "+e.type+", please check. Message: "+e.message}
      }
    })
    return newSteps
  }

  combineSteps(gvar, steps) {
    let rText = gvar?gvar+"\n\n":""
    steps.map(step => {
      rText += `${step.code}\n\n`
    })
    return rText
  }

  resolveSteps(text) {
    const isStep = (testObj) => {
      let stepTest = false
      if (testObj && typeof(testObj) === 'object') {
        Object.keys(testObj).map((testKey) => {
          if (testKey.indexOf('~') === 0) {
            stepTest = true
          }
        })
      }
      return stepTest
    }

    let objs = yaml.safeLoad(text)
    let steps = []
    let objsKeys = Object.keys(objs)
    objsKeys.map(key => {
      let dumpObj = {}
      dumpObj[key] = objs[key]
      if (isStep(objs[key])) {
        steps.push({
          id: "",
          name: "",
          code: yaml.safeDump(dumpObj),
          command: "",
          out: {},
          comment: ""
        })
        delete objs[key]
      }
    })
    let gvar = yaml.safeDump(objs)

    if (gvar === "{}\n") gvar = ""
        console.log(gvar)
    return {gvar, steps}
  }

  replaceVars(rawObj) {
    let varObj = {}
    let gvarObj = {}
    let rObj = rawObj

    let flatObj = flatten(rObj, {safe: true})
     
    //change numbers to strings
    Object.keys(flatObj).map(key => {
      if (typeof(flatObj[key]) === 'number') flatObj[key] = flatObj[key].toString()
    })

    //get vars
    Object.keys(rObj).map((key, index) => {
      if (index === Object.keys(rObj).length-1) {
        Object.keys(rObj[key]).map(stepKey => {
          varObj[stepKey] = rObj[key][stepKey]
        })      
        let flatStepObj = flatten(rObj[key], {safe: true})
        Object.keys(flatStepObj).map(stepKey => {
            varObj[stepKey] = flatStepObj[stepKey]
        })
      } else {
        gvarObj[key] = rObj[key]
      }
    })

    let flatVarObj = Object.assign(varObj, flatten(gvarObj, {safe: true}))

    //switch vars in a string
    const processValue = (value) => {
      if (typeof(value) === 'string') {
        //sort to make sure the longer vars get recognized first
        Object.keys(flatVarObj).sort((a, b)=>{return b.length-a.length}).map((processKey) => { 
          let pos = typeof(value) === 'string' ? value.indexOf('$'+processKey, pos + 1) : -1
          while (pos !== -1) {
            if (typeof(flatVarObj[processKey]) === 'string') {
              value = value.replace('$'+processKey, flatVarObj[processKey])
            } else {
              value = flatVarObj[processKey]
            }
            pos = typeof(value) === 'string' ? value.indexOf('$'+processKey, pos + 1) : -1
          }      
        })
        return value
      }
    }

    //replace keys
    Object.keys(flatObj).map(key => {
      let processedKey = processValue(key)
      if (processedKey !== key) {
        flatObj[processedKey] = flatObj[key]
        delete flatObj[key]
      }
    })
    //replace values
    const haveVar = () => {
      let rKey = false
      Object.keys(flatObj).map(key => {
        Object.keys(flatVarObj).map(varKey => { 
          if (flatObj[key] && typeof(flatObj[key]) === 'string' && flatObj[key].indexOf('$'+varKey) > -1 && key.indexOf("comment") === -1) {
            rKey = key
          }
        })
      })
      return rKey
    }
    let varKey
    while (varKey = haveVar()) {
      flatObj[varKey] = processValue(flatObj[varKey])
    }

    rObj = unflatten(flatObj)
    //remove var definitions
    let rObjKeys = Object.keys(rObj)
    rObjKeys.map((key, index) => {
      if (index !== rObjKeys.length-1) {
        delete rObj[key]
      }
    })

    return rObj
  }

  processInArr(stepObj, flists, steps) {
    //process in array
    let inArr = []
    if (stepObj['in']) {
      if (typeof(stepObj['in']) === 'string') {
        inArr.push(stepObj['in'])
      } else {
        stepObj['in'].map((input) => {
          inArr.push(input)
        })
      }
    } else {
      return
    }
    //concat in content
    let lines = []
    inArr.map((inFile) => {
      flists.map(flist => {
        if(inFile === '$'+flist.name.replace(/ /g, '_')) {
          let subLine = []
          flist.content.split('\n').map(line => {
            if (line !== "") subLine.push(line)
          })
          lines.push(subLine)
        }
      })
      steps.map((step) => { 
        Object.keys(step.out).map(outKey => {
          let outStr = outKey === 'default' ? "" : outKey
          if (inFile === '$'+step.id+".out"+outStr) {
            let subLine = []
            step.out[outKey].split('\n').map(line => {
              subLine.push(line)
            })
            lines.push(subLine)
          }
        })
      })
    })

    return lines
  }

  countLoop(stepObj, lines) {
    let flatLines = [].concat(...lines)
    let loopNum = flatLines.length
    let eachLoop = 1

    Object.keys(stepObj).map(key => {
      //find LEASH expressions
      if (key.indexOf('~') === 0) {
        if (stepObj[key]['file'] && stepObj['in']) {
          let fileArr = this.parseRange(stepObj[key]['file'], stepObj['in']).map((v) => v-1)
          let concatArr = lines.filter((v, i) => {return fileArr.includes(i)})
          flatLines = [].concat(...concatArr)
        }

        let lineStr = stepObj[key]['line'] ? stepObj[key]['line'] : "-"
        let lineArr = []
        if (lineStr.indexOf(':') > -1) {
          lineArr = lineStr.split(':')
          eachLoop = Number(lineArr[1]) === 0 ? flatLines.length : Number(lineArr[1])
        } else {
          lineArr[0] = lineStr
        }
        let selectedLineNum = this.parseRange(lineArr[0], flatLines).length
        let actualLineNum = selectedLineNum < flatLines.length ? selectedLineNum : flatLines.length
        let newNum = Math.floor(actualLineNum / eachLoop)
        loopNum = newNum < loopNum ? newNum : loopNum

      }
    })
    return loopNum
  }

  parseLEASH(stepObj, lines, loopNum) {
    const LEASH = (LEASHObj, loop, out=false) => {
      let flatLines = []
      let eachLoop = 1

      //file key
      if (LEASHObj.file) {
        let fileArr = this.parseRange(LEASHObj['file'], stepObj['in']).map((v) => v-1)
        let concatArr = lines.filter((v, i) => {return fileArr.includes(i)})
        flatLines = [].concat(...concatArr)
      } else {
        flatLines = [].concat(...lines)
      }

      //line key
      let selectedLines = []
      let lineStr = LEASHObj.line ? LEASHObj['line'] : "-"
      let lineArr = []
      if (lineStr.indexOf(':') > -1) {
        lineArr = lineStr.split(':')
        eachLoop = Number(lineArr[1]) === 0 ? flatLines.length : Number(lineArr[1])
      } else {
        lineArr[0] = lineStr
      }
      let selectedLineArr = this.parseRange(lineArr[0], flatLines).map((v) => v-1)
      selectedLines = flatLines.filter((v, i) => {return selectedLineArr.includes(i)})

      //filter lines for each loop
      let loopingLines = selectedLines.filter((v, i) => {return i >= eachLoop*loop && i < eachLoop*(loop+1)})

      //mods key
      let modsLines = loopingLines
      if (LEASHObj.mods) {
        modsLines = loopingLines.map(line => {
          let modsLine = LEASHObj.mods
          //predefined vars
          let pvars = {
            "$ENTRY": line,
            "$FILENAME_NOEXT": path.basename(line).substr(0, path.basename(line).lastIndexOf('.')),
            "$FILENAME": path.basename(line),
            "$DIRNAME": path.dirname(line),
            "$PARENT_DIR": path.resolve(path.dirname(line), "../"),
            "$SEP": path.sep
          }
          Object.keys(pvars).map(key => {
            let pos = LEASHObj.mods.indexOf(key)
            while (pos !== -1) {
              modsLine = modsLine.replace(key, pvars[key])
              pos = LEASHObj.mods.indexOf(key, pos + 1)
            }
          })
          return modsLine
        })
      }

      //mod key
      let modLines = modsLines
      if (LEASHObj.mod) {
        let matchArr = LEASHObj.mod.match(/\w'.+'/g)
        modLines = modLines.map(line => {
          let modLine = line
          matchArr.map(seg => {
            let segArr = seg.split("'")
            switch (segArr[0]) {
              case 'P':
                modLine = segArr[1] + modLine
                break
              case 'S':
                modLine = modLine + segArr[1]
                break
              case 'L':
                let levelArr = path.dirname(modLine).split(path.sep)
                let selectedLevelArr = []
                this.parseRange(segArr[1], levelArr).map(index => {
                  if (path.dirname(modLine).indexOf(path.sep) === 0) {
                    selectedLevelArr.push(levelArr[index])
                  } else {
                    selectedLevelArr.push(levelArr[index-1])
                  }
                })
                modLine = path.resolve(
                  selectedLevelArr.join(path.sep), 
                  path.basename(modLine)
                )
                break
              case 'F':
                let fileArr = path.basename(modLine).split('.')
                let selectedFileArr = []
                this.parseRange(segArr[1], fileArr).map(index => {
                  selectedFileArr.push(fileArr[index-1])
                })
                modLine = path.resolve( 
                  path.dirname(modLine),
                  selectedFileArr.join('.')
                )
                break
            }
          })
          return modLine
        })      
      }

      //sep key
      let sepStr = ""
      if (out) {
        sepStr = modLines.join('\n')
      } else if (LEASHObj.sep) {
        sepStr = modLines.join(LEASHObj.sep)
      } else {
        sepStr = modLines.join(' ')
      }
      
      return sepStr
      
    }

    //generate commands
    let command = []
    for (let i = 0; i < loopNum; i++) {
      //parse one command without loop
      let run = stepObj.run
      Object.keys(stepObj).map(key => {
        if (key.indexOf('~') === 0) {
          let pos = run.indexOf(key)
          while (pos !== -1) {
            run = run.replace(key, LEASH(stepObj[key], i))
            pos = stepObj.run.indexOf(key, pos + 1)
          }
        }
      })
      command.push(run)
    }
    command = command.join('\n')
    
    //generate out
    let outObj = {}
    Object.keys(stepObj).map(outKey => {
      if (outKey.indexOf('out') === 0) {
        let outStr = stepObj[outKey]
        let rStr = outStr
        let result = []
        for (let i = 0; i < loopNum; i++) {
          //decide to parse LEASH or string
          if (typeof(outStr) === 'string') {
            Object.keys(stepObj).map((key) => {
              if (key.indexOf('~') === 0) {
                let pos = outStr.indexOf(key)
                while (pos !== -1) {
                  rStr = outStr.replace(key, LEASH(stepObj[key], i))
                  pos = outStr.indexOf(key, pos + 1)
                }
              }
            })
          } else {
            rStr = LEASH(outStr, i, true)
          }
          result.push(rStr)
        }
        if (outKey === 'out') {
          outObj['default'] = result.join('\n')
        } else {
          outObj[outKey.substr(3, outKey.length)] = result.join('\n')
        }
      }
    })

    return { command, outObj }
  }

  parseRange(s, arr) {
    let length = arr.length
    let r = []
    if (s.indexOf('/') > -1) {
      //parse regex range
      let regex = new RegExp(s.slice(1,-1))
      arr.map((string, i) => {
        if (string.search(regex) > -1) {
          r.push(i+1)
        }
      })
      return r
    } else {
      //parse numeric range
      let a = s.split(',')
      a.map((ss, i) => {
        if (ss.indexOf('-') > -1) {
          let b = ss.split('-');
          if (b[0]==="" && b[1]==="") {b[0] = 1; b[1] = length}
          else if (b[1]==="") b[1] = length
          else if (b[0]==="") b[0] = 1
          else if (b.length > 2 || Number(b[0]) > Number(b[1])) {
            console.log("illegal range.")
            return
          }
          for (let i = Number(b[0]); i <= Number(b[1]); i++) {
            r.push(i)
          }
        } else {
          r.push(Number(ss))
        }
      })
      r.sort((x,y) => x-y)
      return [...new Set(r)]
    }
  }

} 

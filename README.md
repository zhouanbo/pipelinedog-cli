# PipelineDog-CLI

A command line interface for [PipelineDog](http://pipeline.dog).

## Installation
- First, make sure you have node.js installed on your machine. To check,
  ```
  node -v
  ```
  You should see a version number.

  If not, please refer to the [Nodejs installation guide](https://nodejs.org/en/download/package-manager/).

  Note that in Ubuntu distributions a symlink needs to be installed: 
  ```
  sudo ln -s /usr/bin/nodejs /usr/bin/node
  ```

- To install the CLI:
  ```
  npm install -g pipelinedog
  ```

- After doing this, you'll be able to invoke the tool manual by typing:
  ```
  pipelinedog -h
  ```
  in the terminal.

## Usage:
- Use
  ```
  pipelinedog -h
  ```
  to invoke the manual:

  ```
  Usage: pipelinedog [options]

  Options:

    -h, --help            output usage information
    -v, --version         output the version number
    -p, --project <path>  your PipelineDog project file
    -l, --list <path>     file lists for the run, separated by commas
    -o, --output [path]   path to output shell command file
  ```

- For a comprehensive documentation and explaination of concepts, please visit the [PipelineDog Wiki](https://github.com/zhouanbo/pipelinedog/wiki)
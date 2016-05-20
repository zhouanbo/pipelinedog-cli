#PipelineDog-CLI

A command line interface for [PipelineDog](http://pipeline.dog).

##Installation
- First, make sure you have node.js installed on your machine. To check,
  ```
  node -v
  ```
  You should see a version number.

- To install the CLI:
  ```
  npm install -g pipelinedog
  ```

- After doing this, you'll be able to invoke the tool manual by typing:
  ```
  pipelinedog -h
  ```
  in the terminal.

##Usage:
- Use
  ```
  pipelinedog -h
  ```
  to invoke the manual:

  ```
  pipelinedog [options]

    Options:

      -h, --help                   output usage information
      -v, --version                output the version number
      -a, --action <string>        Action to perform: run or parse
      -p, --pipeline <path>        Pipeline file exported by PipelineDog
      -i, --input-list <path>      Input list for the run
      -d, --work-directory [path]  Directory to run pipeline
      -o, --output [path]          Path to output shell command file
  ```
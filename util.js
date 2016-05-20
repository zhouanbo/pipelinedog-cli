var Util = {

  filterByProperty: function (array, prop, value) {
    for (var i = 0; i < array.length; i++) {
      for (var j = 0; j < array[i].length; j++) {
        var obj = array[i][j];
        if(obj[prop] == value) {
          return obj;
        }
      }
    }
  },

  objToArray: function (obj) {
    var array = [];
    var index = -1;
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        index++;
        
        if(!obj[key].name || !obj[key].description) {
          console.log('Mal-formatted Pipeline JSON');
          process.exit();
        }

        if(!array[key.split('_')[1] - 1]) array[key.split('_')[1] - 1] = [];
        array[key.split('_')[1] - 1][key.split('_')[2] - 1] = {
          id: index,
          name: obj[key].name,
          description: obj[key].description,
          codeobj: obj[key], //JSON object parsed from the code
          parsedOptions: {}, //LEASH converted options of the tool
          looping: false, //if the command is to run as a loop, or the values to loop
          expressions: [], //direct LEASH parsing result
          options: [], //keys for options
          parsedCommand: "", //the command to finally run
          valid: true,
          output_files: [] //the array of predicted output files path
        };
      }
    }
    return {array: array, lastId: index};
  },

  getHierarchy: function(array, toolid) {
    for (var i = 0; i < array.length; i++) {
      for (var j = 0; j < array[i].length; j++) {
        var obj = array[i][j];
        if(obj["id"] == toolid) {
          return i;
        }
      }
    }
  },
  
  getHierarchyByName: function(array, toolname) {
    for (var i = 0; i < array.length; i++) {
      for (var j = 0; j < array[i].length; j++) {
        var obj = array[i][j];
        if(obj["name"] == toolname) {
          return i;
        }
      }
    }
  }

};

module.exports = Util;

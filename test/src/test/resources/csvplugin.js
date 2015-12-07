var getCsv = function(varietyResults) {
  var delimiter = this.delimiter || '|';
  var headers = ['key', 'types', 'occurrences', 'percents'];
  var table = [headers.join(delimiter)];
  var rows = varietyResults.map(function(key) {
    return [key._id.key, Object.keys(key.value.types).sort(), key.totalOccurrences, key.percentContaining].join(delimiter);
  }, this);
  return table.concat(rows).join('\n');
};

var setConfig = function(pluginConfig) {
  this.delimiter = pluginConfig.delimiter;
};

module.exports = {
  init: setConfig,
  formatResults: getCsv
};

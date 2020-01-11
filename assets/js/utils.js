function getShortTimeframe(value) {
  switch (value) {
    case "1 minute":
      return "1m";
    case "3 minutes":
      return "3m";
    case "5 minutes":
      return "5m";
    case "15 minutes":
      return "15m";
    case "30 minutes":
      return "30m";
    case "1 hour":
      return "1h";
    case "2 hours":
      return "2h";
    case "4 hours":
      return "4h";
    case "6 hours":
      return "6h";
    case "12 hours":
      return "12h";
    case "1 day":
      return "1d";
  }
}

//Add additional 300 ticks to the start date in order to calculate RSIs and EMAs
function getStartDate(value, date) {
  let startDate = new Date(date.getTime());
  switch (value) {
    case "1 minute":
      startDate.setDate(startDate.getDate() - 1);
      break;
    case "5 minutes":
      startDate.setDate(startDate.getDate() - 1);
      break;
    case "15 minutes":
      startDate.setDate(startDate.getDate() - 3);
      break;
    case "30 minutes":
      startDate.setDate(startDate.getDate() - 6);
      break;
    case "1 hour":
      startDate.setDate(startDate.getDate() - 12);
      break;
    case "2 hours":
      startDate.setDate(startDate.getDate() - 25);
      break;
    case "4 hours":
      startDate.setDate(startDate.getDate() - 50);
      break;
    case "12 hours":
      startDate.setDate(startDate.getDate() - 150);
      break;
    case "1 day":
      startDate.setDate(startDate.getDate() - 300);
      break;
  }
  return startDate;
}

function getTimeframes(strategy) {
  let timeframes = [];
  for (let rule of strategy.buyRules) {
    if (rule.timeframe === null || rule.timeframe === undefined) {
      return null;
    }
    if (!timeframes.includes(rule.timeframe)) {
      timeframes.push(rule.timeframe);
    }
  }
  for (let rule of strategy.sellRules) {
    if (rule.timeframe === null || rule.timeframe === undefined) {
      return null;
    }
    if (!timeframes.includes(rule.timeframe)) {
      timeframes.push(rule.timeframe);
    }
  }
  sortTimeframes(timeframes);
  return timeframes;
}
function sortTimeframes(timeframes) {
  let allTimeframes = [
    "1 minute",
    "5 minutes",
    "15 minutes",
    "30 minutes",
    "1 hour",
    "2 hours",
    "4 hours",
    "12 hours",
    "1 day"
  ];
  timeframes.sort(function(a, b) {
    return allTimeframes.indexOf(b) - allTimeframes.indexOf(a);
  });
}

function getEndPeriod(startDate, timeframe) {
  let endDate = new Date(startDate.getTime());
  switch (timeframe) {
    case "1 minute":
      endDate.setMinutes(endDate.getMinutes());
      break;
    case "5 minutes":
      endDate.setMinutes(endDate.getMinutes() + 4);
      break;
    case "15 minutes":
      endDate.setMinutes(endDate.getMinutes() + 14);
      break;
    case "30 minutes":
      endDate.setMinutes(endDate.getMinutes() + 29);
      break;
    case "1 hour":
      endDate.setHours(endDate.getHours(), 59);
      break;
    case "2 hours":
      endDate.setHours(endDate.getHours() + 1, 59);
      break;
    case "4 hours":
      endDate.setHours(endDate.getHours() + 3, 59);
      break;
    case "12 hours":
      endDate.setHours(endDate.getHours() + 11, 59);
      break;
    case "1 day":
      endDate.setHours(endDate.getHours() + 23, 59);
      break;
  }
  return endDate;
}

function getQuotedCurrency(pair) {
  if (pair.endsWith("btc")) {
    return "BTC";
  } else if (pair.endsWith("bnb")) {
    return "BNB";
  } else if (pair.endsWith("eth")) {
    return "ETH";
  } else if (pair.endsWith("xrp")) {
    return "XRP";
  } else if (pair.endsWith("usdt")) {
    return "USDT";
  } else if (pair.endsWith("pax")) {
    return "PAX";
  } else if (pair.endsWith("tusd")) {
    return "TUSD";
  } else if (pair.endsWith("usdc")) {
    return "USDC";
  } else if (pair.endsWith("usds")) {
    return "USDS";
  } else {
    return "";
  }
}

function getBaseCurrency(pair) {
  if (pair.endsWith("btc")) {
    return pair.substring(0, pair.lastIndexOf("btc")).toUpperCase();
  } else if (pair.endsWith("bnb")) {
    return pair.substring(0, pair.lastIndexOf("bnb")).toUpperCase();
  } else if (pair.endsWith("eth")) {
    return pair.substring(0, pair.lastIndexOf("eth")).toUpperCase();
  } else if (pair.endsWith("xrp")) {
    return pair.substring(0, pair.lastIndexOf("xrp")).toUpperCase();
  } else if (pair.endsWith("usdt")) {
    return pair.substring(0, pair.lastIndexOf("usdt")).toUpperCase();
  } else if (pair.endsWith("pax")) {
    return pair.substring(0, pair.lastIndexOf("pax")).toUpperCase();
  } else if (pair.endsWith("tusd")) {
    return pair.substring(0, pair.lastIndexOf("tusd")).toUpperCase();
  } else if (pair.endsWith("usdc")) {
    return pair.substring(0, pair.lastIndexOf("usdc")).toUpperCase();
  } else if (pair.endsWith("usds")) {
    return pair.substring(0, pair.lastIndexOf("usds")).toUpperCase();
  } else {
    return "";
  }
}

module.exports = {
  getShortTimeframe: getShortTimeframe,
  getStartDate: getStartDate,
  getTimeframes: getTimeframes,
  getEndPeriod: getEndPeriod,
  getBaseCurrency: getBaseCurrency,
  getQuotedCurrency: getQuotedCurrency
};

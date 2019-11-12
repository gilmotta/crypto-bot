//EasyCryptoBot Copyright (C) 2018 Stefan Hristov
const Binance = require('node-binance-api');
const binance = new Binance().options({
  APIKEY: 'key', APISECRET: 'secret', useServerTime: true, recvWindow: 60000, // If you get timestamp errors, synchronize to server time at startup
  test: false // If you want to use sandbox mode where orders are simulated
});
var binanceRealTrading = null;

let cancelBinanceData = false;
function cancelGetBinanceData() {
  cancelBinanceData = true;
}

let binanceInstruments = null;
async function getBinanceInstruments() {
  if (binanceInstruments === null) {
    return new Promise((resolve, reject) => {
      binance.useServerTime(function() {
        binance.prices((error, ticker) => {
          if (error) {
            reject(error);
          } else {
            if (ticker === null || JSON.stringify(ticker) === '{}') {
              $.ajax({
                url: 'https://easycryptobot.com/instruments.php',
                contentType: 'json',
                type: 'GET',
                success: function(data) {
                  let list = JSON.parse(data);
                  binanceInstruments = {}
                  for (let item of list) {
                    binanceInstruments['' + item + ''] = item;
                  }
                },
                error: function() {}
              });
            } else {
              binanceInstruments = ticker;
            }
            resolve(ticker);
          }
        })
      });
    });
  } else {
    return Promise.resolve(binanceInstruments);
  }
}

function getLastBinancePrice(instrument) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.prices(instrument, (error, ticker) => {
        if (error) {
          reject(error);
        } else {
          resolve(ticker[instrument]);
        }
      })
    });
  });
}

let lastBinancePricesTime = new Date();
let binancePrices = null;
let binancePricesCasheTimer = 20; //minutes

function getLastBinancePrices() {
  let date = new Date(lastBinancePricesTime.getTime());
  date.setMinutes(date.getMinutes() + binancePricesCasheTimer, date.getSeconds());
  if (binancePrices == null || date < new Date()) {
    return new Promise((resolve, reject) => {
      binance.useServerTime(function() {
        binance.prices((error, ticker) => {
          if (error) {
            reject(error);
          } else {
            binancePrices = ticker;
            lastBinancePricesTime = new Date();
            resolve(ticker);
          }
        })
      });
    });
  } else {
    return binancePrices;
  }
}

function getBinanceTicksImpl(instrument, timeframe, startTime, endTime) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.candlesticks(instrument, timeframe, (error, ticks, symbol) => {
        if (error) {
          reject(error);
        } else {
          resolve(ticks);
        }
      }, {
        limit: 500,
        startTime: startTime.getTime(),
        endTime: endTime.getTime()
      });
    });
  });
}

var binanceCache = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null
];
function getBinanceTicksDb(instrument, timeframe) {
  let dbFilename = getDbFileName('binance', instrument, timeframe);
  let cachedDataDb = new Datastore({
    filename: getAppDataFolder() + '/db/tmp/' + dbFilename,
    autoload: true
  });
  return new Promise((resolve, reject) => {
    cachedDataDb.find({}).sort({d: 1}).exec((error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    })
  });
}

function storeBinanceTicks(instrument, timeframe, data) {
  let dbFilename = getDbFileName('binance', instrument, timeframe);
  let dataDb = new Datastore({
    filename: getAppDataFolder() + '/db/tmp/' + dbFilename,
    autoload: true
  });
  return new Promise((resolve, reject) => {
    dataDb.insert(data, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    })
  });
}

function getDateWithoutLastTick(timeframe, date) {
  let tmpDate = new Date(date.getTime());
  switch (timeframe) {
    case '1m':
      tmpDate.setMinutes(tmpDate.getMinutes() - 1, 0, 0);
      break;
    case '3m':
      tmpDate.setMinutes(tmpDate.getMinutes() - 3, 0, 0);
      break;
    case '5m':
      tmpDate.setMinutes(tmpDate.getMinutes() - 5, 0, 0);
      break;
    case '15m':
      tmpDate.setMinutes(tmpDate.getMinutes() - 15, 0, 0);
      break;
    case '30m':
      tmpDate.setMinutes(tmpDate.getMinutes() - 30, 0, 0);
      break;
    case '1h':
      tmpDate.setHours(tmpDate.getHours() - 1, 0, 0, 0);
      break;
    case '2h':
      tmpDate.setHours(tmpDate.getHours() - 2, 0, 0, 0);
      break;
    case '4h':
      tmpDate.setHours(tmpDate.getHours() - 4, 0, 0, 0);
      break;
    case '6h':
      tmpDate.setHours(tmpDate.getHours() - 6, 0, 0, 0);
      break;
    case '12h':
      tmpDate.setHours(tmpDate.getHours() - 12, 0, 0, 0);
      break;
    case '1d':
      tmpDate.setHours(tmpDate.getHours() - 24, 0, 0, 0);
      break;
  }
  return tmpDate;
}
function getCacheIndex(timeframe) {
  switch (timeframe) {
    case '1m':
      return 0;
    case '3m':
      return 1;
    case '5m':
      return 2;
    case '15m':
      return 3;
    case '30m':
      return 4;
    case '1h':
      return 5;
    case '2h':
      return 6;
    case '4h':
      return 7;
    case '6h':
      return 8;
    case '12h':
      return 9;
    case '1d':
      return 10;
  }
}

function getDateWithTickMore(timeframe, date) {
  let tmpDate = new Date(date.getTime());
  switch (timeframe) {
    case '1m':
      tmpDate.setMinutes(tmpDate.getMinutes() + 1, 0, 0);
      break;
    case '3m':
      tmpDate.setMinutes(tmpDate.getMinutes() + 3, 0, 0);
      break;
    case '5m':
      tmpDate.setMinutes(tmpDate.getMinutes() + 5, 0, 0);
      break;
    case '15m':
      tmpDate.setMinutes(tmpDate.getMinutes() + 15, 0, 0);
      break;
    case '30m':
      tmpDate.setMinutes(tmpDate.getMinutes() + 30, 0, 0);
      break;
    case '1h':
      tmpDate.setHours(tmpDate.getHours() + 1, 0, 0, 0);
      break;
    case '2h':
      tmpDate.setHours(tmpDate.getHours() + 2, 0, 0, 0);
      break;
    case '4h':
      tmpDate.setHours(tmpDate.getHours() + 4, 0, 0, 0);
      break;
    case '6h':
      tmpDate.setHours(tmpDate.getHours() + 6, 0, 0, 0);
      break;
    case '12h':
      tmpDate.setHours(tmpDate.getHours() + 12, 0, 0, 0);
      break;
    case '1d':
      tmpDate.setDate(tmpDate.getDate() + 1);
      break;
  }
  return tmpDate;
}

function setBinanceCache(instrument, timeframe, startTime, endTime, data) {
  if (data == null || data.length === 0) {
    return;
  }
  let index = getCacheIndex(timeframe);
  binanceCache[index] = {
    'instrument': instrument,
    'timeframe': timeframe,
    'startTime': startTime,
    'endTime': endTime,
    'data': data,
    'time': new Date()
  }
}

async function getBinanceTicks(instrument, timeframe, startTime, endTime, bt) {
  cancelBinanceData = false;
  for (let cache of binanceCache) {
    let now = new Date();
    now.setMinutes(now.getMinutes() - 30);
    if (cache !== null && cache.instrument === instrument && cache.timeframe === timeframe && cache.startTime.getTime() === startTime.getTime() && cache.endTime.getTime() === endTime.getTime() && now <= cache.time) {
      return cache.data;
    }
  }
  let result = null;
  try {
    result = await getBinanceTicksDb(instrument, timeframe, startTime, endTime);
  } catch (err) {
    log('error', 'getBinanceTicks', err.stack);
  }
  let leftSite = false;
  let rightSite = false;

  let noData = result === null || result.length === 0;
  if (!noData) {
    leftSite = result[0].d > startTime;
    let endTimeTmp = getDateWithoutLastTick(timeframe, endTime);
    rightSite = result[result.length - 1].d < endTimeTmp;
  }
  let popped = null;
  try {
    if (noData) {
      let data = await downloadBinanceTicks(instrument, timeframe, startTime, endTime, bt);
      if (data !== null && data.length > 0) {
        //TO prevent storing unfinished candle in DB
        await removeDbFile(getDbFileName('binance', instrument, timeframe));
        let lastValue = data.pop();
        await storeBinanceTicks(instrument, timeframe, data);
        if (cancelBinanceData) {
          return null;
        }
        data.push(lastValue);
        setBinanceCache(instrument, timeframe, startTime, endTime, data);
        return data;
      } else {
        return null;
      }
    } else {
      if (leftSite) {
        let ticksLeft = await downloadBinanceTicks(instrument, timeframe, startTime, result[0].d, bt);
        if (ticksLeft !== null && ticksLeft.length > 0) {
          await storeBinanceTicks(instrument, timeframe, ticksLeft);
          if (cancelBinanceData) {
            return null;
          }
        }
      }
      if (rightSite) {
        let tmpDate = getDateWithTickMore(timeframe, result[result.length - 1].d);
        let ticksRight = await downloadBinanceTicks(instrument, timeframe, tmpDate, endTime, bt);
        if (ticksRight !== null && ticksRight.length > 0) {
          //remove
          popped = ticksRight.pop();
          await storeBinanceTicks(instrument, timeframe, ticksRight);
          if (cancelBinanceData) {
            return null;
          }
        }
      }
    }

  } catch (err) {
    log('error', 'getBinanceTicks', err.stack);
    return null;
  }
  if (noData || leftSite || rightSite) {
    result = await getBinanceTicksDb(instrument, timeframe, startTime, endTime);
  }
  let filteredResult = [];
  for (let item of result) {
    if (item.d >= startTime && item.d <= endTime)
      filteredResult.push(item)
  }
  if (popped !== null) {
    filteredResult.push(popped);
  }

  setBinanceCache(instrument, timeframe, startTime, endTime, filteredResult);
  return filteredResult;

}
async function downloadBinanceTicks(instrument, timeframe, startTime, endTime, bt) {
  let infoId = bt
    ? '#btRunPercent'
    : '#opRunPercent';
  let infoId2 = bt
    ? '#btRunPercent2'
    : '#opRunPercent2';
  $(infoId).html('Downloading ' + instrument + ' historical data from Binance. Please wait..');
  $(infoId2).show();
  $(infoId2).html(timeframe + ' data download progress: 0%');
  let ticks = [];
  try {
    ticks = await getBinanceTicksImpl(instrument, timeframe, startTime, endTime);
  } catch (err) {
    log('error', 'downloadBinanceTicks', err.stack);
    return null;
  }
  if (ticks === null || ticks === undefined || ticks.length === 0) {
    return null;
  }

  let lastCloseTime = new Date(ticks[ticks.length - 1][6]);
  let tmpIndex = 0;
  while (lastCloseTime < endTime) {
    if (cancelBinanceData) {
      return null;
    }
    $(infoId2).html(timeframe + ' data download progress: ' + (
    ((lastCloseTime.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100).toFixed(0) + '%');
    let nextData = [];
    try {
      nextData = await getBinanceTicksImpl(instrument, timeframe, lastCloseTime, endTime);
    } catch (err) {
      log('error', 'downloadBinanceTicks', err.stack);
      return null;
    }
    if (nextData === null || nextData === undefined || nextData.length === 0) {
      break;
    }
    lastCloseTime = new Date(nextData[nextData.length - 1][6]);
    ticks.push.apply(ticks, nextData)
  }
  let ticksTmp = [];
  let indexTmp = 0;
  //let dateTmp = new Date();
  //var userTimezoneOffset = dateTmp.getTimezoneOffset() * 60000;
  for (let tick of ticks) {
    let date = new Date(tick[0]);
    /*if (timeframe === '1d') {
      //date = new Date(date.getTime() + userTimezoneOffset);
      date.setHours(0, 0, 0, 0);
    }*/
    ticksTmp.push({
      'd': date,
      'o': Number.parseFloat(tick[1]),
      'h': Number.parseFloat(tick[2]),
      'l': Number.parseFloat(tick[3]),
      'c': Number.parseFloat(tick[4])
    });
    if (indexTmp > 500 && indexTmp % 500 === 0) {
      await sleep(0);
    }
    indexTmp++
  }
  return ticksTmp;
}

function checkBinanceApiKey(key, secret) {
  if (binanceRealTrading == null) {
    binanceRealTrading = new Binance().options({APIKEY: key, APISECRET: secret, useServerTime: true, recvWindow: 60000, test: false});
    return new Promise((resolve, reject) => {
      binanceRealTrading.useServerTime(function() {
        binanceRealTrading.balance(async (error, balances) => {
          if (error !== null) {
            binanceRealTrading = null;
            resolve(false);
          } else {
            resolve(true);
          }
        })
      });
    });
  } else {
    //Should never go here
    log('warning', 'checkBinanceApiKey', 'Method is called even binanceRealTrading != null.');
    return false;
  }
}

function getBinanceBalance(key, secret, currency) {
  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.balance((error, balances) => {
        resolve(balances[currency].available);
      })
    });
  });
}

function getBinanceLotSizeInfo(pair) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.exchangeInfo((error, data) => {

        let symbolInfo = data.symbols.filter(x => {
          return x.symbol == pair
        })[0];
        let minQty = null;
        let maxQty = null;
        let stepSize = null;

        symbolInfo.filters.forEach(filter => {
          if (filter.filterType === 'LOT_SIZE') {
            minQty = parseFloat(filter.minQty);
            maxQty = parseFloat(filter.maxQty);
            stepSize = parseFloat(filter.stepSize);
          }
        });
        resolve([minQty, maxQty, stepSize]);
      })
    });
  });
}

function getBinanceBidAsk(pair) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.depth(pair, (error, depth, symbol) => {
        let bids = binance.sortBids(depth.bids);
        let asks = binance.sortAsks(depth.asks);
        resolve([
          Number.parseFloat(binance.first(bids)),
          Number.parseFloat(binance.first(asks))
        ]);
      });
    });
  });
}

let binanceInstrumentsInfo = null;
async function getBinanceInstrumentsInfo(instrument) {
  if (binanceInstrumentsInfo === null) {
    let binanceInstrumentsInfoTmp = {};
    return new Promise((resolve, reject) => {
      binance.useServerTime(function() {
        binance.exchangeInfo(function(error, data) {
          if (error) {
            resolve(null);
          }
          for (let obj of data.symbols) {
            let item = {};
            for (let filter of obj.filters) {
              if (filter.filterType == "MIN_NOTIONAL") {
                item.minNotional = filter.minNotional;
              } else if (filter.filterType == "LOT_SIZE") {
                item.stepSize = filter.stepSize;
                item.minQty = filter.minQty;
                item.maxQty = filter.maxQty;
              } else if (filter.filterType == "PRICE_FILTER") {
                item.tickSize = filter.tickSize;
              }
            }
            item.orderTypes = obj.orderTypes;
            item.precision = getPrecisionFromTickSize(item.tickSize);
            binanceInstrumentsInfoTmp[obj.symbol] = item;
          }
          binanceInstrumentsInfo = binanceInstrumentsInfoTmp;
          resolve(binanceInstrumentsInfo[instrument.toUpperCase()]);
        });
      });
    });
  } else {
    return binanceInstrumentsInfo[instrument.toUpperCase()];
  }
}

async function binanceRoundAmmount(amount, instrument) {
  let instrumentInfo = await getBinanceInstrumentsInfo(instrument);
  let stepIndex = -1
  try {
    stepIndex = instrumentInfo.stepSize.toString().split(".")[1].indexOf('1');
  } catch (err) {}
  let precision = stepIndex != -1
    ? stepIndex + 1
    : 0;
  // easier version: binance.getPrecision(number)
  //return Number.parseFloat(binance.roundStep(amount, stepSize))

  let factor = 1;
  for (let i = 0; i < precision; i++) {
    factor *= 10;
  }
  amount = Math.round(amount * factor) / factor;
  return Number.parseFloat(amount.toFixed(precision));
}

async function binanceRoundTickAmmount(amount, instrument) {
  let instrumentInfo = await getBinanceInstrumentsInfo(instrument);
  let stepIndex = -1
  try {
    stepIndex = instrumentInfo.tickSize.toString().split(".")[1].indexOf('1');
  } catch (err) {}
  let precision = stepIndex != -1
    ? stepIndex + 1
    : 0;
  // easier version: binance.getPrecision(number)
  //return Number.parseFloat(binance.roundStep(amount, stepSize))
  return Number.parseFloat(amount.toFixed(precision));
}

function getPrecisionFromTickSize(tickSize) {
  let startIndex = tickSize.indexOf('.');
  let endIndex = tickSize.indexOf('1');
  if (startIndex !== -1 && endIndex !== -1) {
    return tickSize.substring(startIndex, endIndex).length;
  }
  return 8;
}

function getBalance(instrument) {
  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.balance((error, balances) => {
        if (error) {
          resolve(0);
          return;
        }
        resolve(balances[getBaseCurrency(instrument)].available);
      })
    })
  });
}

function getBinanceBalances() {
  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.balance((error, balances) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(balances);
      })
    })
  });
}

function getBinanceTicks300(instrument, timeframe) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.candlesticks(instrument, timeframe, (error, ticks, symbol) => {
        if (error) {
          reject(error);
        } else {
          resolve(ticks);
        }
      }, {limit: 300});
    });
  });
}

function binanceTest() {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      let instrument = "SCETH";
      binance.prevDay(instrument, (error, prevDay, symbol) => {
        //openModalInfoBig(JSON.stringify(prevDay.lastPrice));
        openModalInfoBig('LastPrice: ' + prevDay.lastPrice + '<br>LastQty: ' + prevDay.lastQty + '<br>LastId: ' + prevDay.lastId + '<br>Count:' + prevDay.count);
        resolve(true);
      });
    });
  });
}

function binanceGetOrderTradePrice(instrument, orderId, type) {
  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.trades(instrument, async (error, tradesTmp, symbol) => {
        let qty = 0;
        let sum = 0;
        for (let i = tradesTmp.length - 1; i >= 0; i--) {
          if (tradesTmp[i].orderId == orderId) {
            sum += Number.parseFloat(tradesTmp[i].price) * Number.parseFloat(tradesTmp[i].qty);
            qty += Number.parseFloat(tradesTmp[i].qty);
          }
        }
        if (qty !== 0) {
          resolve([
            Number.parseFloat((sum / qty).toFixed(8)),
            Number.parseFloat((qty).toFixed(8))
          ]);
        } else {
          resolve(null);
        }
      })
    });
  });
}

function binanceCancelOrder(instrument, orderId) {
  if (binanceRealTrading == null || orderId === null || orderId === undefined) {
    return;
  }
  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.cancel(instrument, orderId, (error, response, symbol) => {
        resolve(response);
      });
    });
  });
}

async function binanceMarketSell(execution) {
  if (binanceRealTrading == null || execution == null || execution.trades.length == 0) {
    return null;
  }
  await binanceCancelOrder(execution.instrument, execution.takeProfitOrderId);
  let positionSize = execution.positionSizeToSell + execution.minNotionalAmountLeft;
  positionSize = await binanceRoundAmmount(positionSize, execution.instrument);
  let priceAndQty = await binanceGetOrderTradePrice(execution.instrument, execution.takeProfitOrderId, 'sell');
  if (priceAndQty !== null) {
    if (priceAndQty[1] >= positionSize) {
      return priceAndQty[0];
    } else {
      positionSize -= priceAndQty[1];
    }
  }
  let curPrice = null;
  for (let i = 0; i < 10; i++) {
    let bidAsk = await getBinanceBidAsk(execution.instrument);
    if (isNaN(bidAsk[0])) {
      await sleep(200);
    } else {
      curPrice = bidAsk[0];
      break;
    }
  }
  let instrumentInfo = await getBinanceInstrumentsInfo(execution.instrument);
  if (curPrice * positionSize < instrumentInfo.minNotional) {
    execution.minNotionalAmountLeft = positionSize;
    return (priceAndQty !== null)
      ? priceAndQty[0]
      : execution.trades[execution.trades.length - 1]['entry'];
  }

  return new Promise((resolve, reject) => {
    binanceRealTrading.useServerTime(function() {
      binanceRealTrading.marketSell(execution.instrument, positionSize, async (error, response) => {
        try {
          if (error !== null) {
            openModalInfoBig('Error selling ' + positionSize + ' ' + execution.instrument + '. Error message from Binance: ' + JSON.parse(error.body).msg);
            resolve(null);
          } else {
            let tradePrice = await binanceGetOrderTradePrice(execution.instrument, response.orderId, 'sell');
            resolve(tradePrice[0]);
          }
        } catch (err) {
          resolve(null);
        }
      })
    });
  });
}

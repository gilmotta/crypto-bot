//EasyCryptoBot Copyright (C) 2018 Stefan Hristov
const checkTradeRules = require('./indicators.js').checkTradeRules
const Binance = require('node-binance-api');
const Mutex = require('./mutex.js').Mutex
const getShortTimeframe = require('./utils.js').getShortTimeframe
const getEndPeriod = require('./utils.js').getEndPeriod
const getQuotedCurrency = require('./utils.js').getQuotedCurrency
const getBaseCurrency = require('./utils.js').getBaseCurrency

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBidAsk(pair) {
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

function binanceRoundAmmount(amount) {
  let stepIndex = -1
  try {
    stepIndex = instrumentInfo.stepSize.toString().split(".")[1].indexOf('1');
  } catch (err) {}
  let precision = stepIndex != -1
    ? stepIndex + 1
    : 0;

  let factor = 1;
  for (let i = 0; i < precision; i++) {
    factor *= 10;
  }
  amount = Math.round(amount * factor) / factor;

  return Number.parseFloat(amount.toFixed(precision));
}

function getBalance(instrument) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.balance((error, balances) => {
        if (error) {
          resolve(0);
          return;
        }
        resolve(balances[getBaseCurrency(instrument)].available);
      })
    })
  });
}

function getBinanceUSDTValue(ammount, pair, quoted) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.prices((error, ticker) => {
        if (pair.toLowerCase().endsWith('usdt')) {
          resolve(ammount * Number.parseFloat(ticker[pair.toUpperCase()]));
        } else {
          resolve(ammount * Number.parseFloat(ticker[pair.toUpperCase()]) * Number.parseFloat(ticker[quoted.toUpperCase() + 'USDT']));
        }
      })
    });
  });
}

function getOrderTradePrice(execution, orderId, type) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.trades(execution.instrument, async (error, tradesTmp, symbol) => {
        let qty = 0;
        let sum = 0;
        let commision = 0;
        let bnbCommision = 0;
        for (let i = tradesTmp.length - 1; i >= 0; i--) {
          if (tradesTmp[i].orderId == orderId) {
            sum += Number.parseFloat(tradesTmp[i].price) * Number.parseFloat(tradesTmp[i].qty);
            qty += Number.parseFloat(tradesTmp[i].qty);

            if (tradesTmp[i].commissionAsset !== 'BNB') {
              commision += Number.parseFloat(tradesTmp[i].commission);
              if (feeRate === null || feeRate === undefined) {
                try {
                  feeRate = (Number.parseFloat(tradesTmp[i].commission) / qty) * 100;
                  if (feeRate > 0.095) {
                    feeRate = 0.1;
                  } else if (feeRate > 0.085) {
                    feeRate = 0.09
                  } else if (feeRate > 0.075) {
                    feeRate = 0.08
                  } else if (feeRate > 0.065) {
                    feeRate = 0.07
                  } else if (feeRate > 0.055) {
                    feeRate = 0.06
                  } else if (feeRate > 0.045) {
                    feeRate = 0.03
                  } else if (feeRate > 0.035) {
                    feeRate = 0.02
                  }
                } catch (err) {
                  feeRate = 0.1;
                }
              }
            } else {
              bnbCommision += Number.parseFloat(tradesTmp[i].commission);
            }
          }
        }

        if (feeRate === null || feeRate === undefined) {
          try {
            let usdtQty = await getBinanceUSDTValue(qty, execution.instrument, getQuotedCurrency(execution.instrument));
            let usdtCommission = await getBinanceUSDTValue(bnbCommision, 'BNBUSDT', 'USDT');
            feeRate = (usdtCommission / usdtQty) * 100;
            if (feeRate > 0.095) {
              feeRate = 0.1;
            } else if (feeRate > 0.085) {
              feeRate = 0.09
            } else if (feeRate > 0.075) {
              feeRate = 0.08
            } else if (feeRate > 0.07) {
              feeRate = 0.075;
            } else if (feeRate > 0.065) {
              feeRate = 0.0675
            } else if (feeRate > 0.058) {
              feeRate = 0.06
            } else if (feeRate > 0.049) {
              feeRate = 0.0525
            } else if (feeRate > 0.04) {
              feeRate = 0.045
            } else if (feeRate > 0.035) {
              feeRate = 0.0375
            } else if (feeRate > 0.028) {
              feeRate = 0.03
            } else if (feeRate > 0.02) {
              feeRate = 0.0225
            } else if (feeRate > 0.01) {
              feeRate = 0.015
            }
          } catch (err) {
            feeRate = 0.075;
          }
        }

        if (feeRate === null || feeRate === undefined || isNaN(feeRate)) {
          feeRate = 0.075;
        }

        if (qty !== 0) {
          if (type === 'buy') {
            if (commision !== 0) {
              //Change position size as we don't have the initial ammount to sell because of the commision
              execution.positionSizeToSell = binanceRoundAmmount(qty - commision);
              self.postMessage([execId, 'CH_POS_SIZE', execution.positionSizeToSell]);
            } else if (bnbCommision !== 0 && execution.instrument.indexOf('BNB') == 0) {
              let balance = await getBalance(execution.instrument);
              if (balance < execution.positionSize) {
                //Change position size as we don't have the initial ammount to sell because of the commision
                execution.positionSizeToSell = binanceRoundAmmount(qty - bnbCommision);
                self.postMessage([execId, 'CH_POS_SIZE', execution.positionSizeToSell]);
              } else {
                execution.positionSizeToSell = binanceRoundAmmount(qty);
                self.postMessage([execId, 'CH_POS_SIZE', execution.positionSizeToSell]);
              }
            } else {
              execution.positionSizeToSell = qty;
              self.postMessage([execId, 'CH_POS_SIZE', execution.positionSizeToSell]);
            }
          }
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

async function updatePositionSize(curPrice) {
  if (execution.positionSizeQuoted != null && execution.positionSizeQuoted != undefined && execution.positionSizeQuoted > 0) {
    let tradeSize = execution.positionSizeQuoted / curPrice;
    execution.positionSize = binanceRoundAmmount(tradeSize);
  }
}

async function marketBuy(execution, curPrice) {
  await updatePositionSize(curPrice);
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.marketBuy(execution.instrument, execution.positionSize, async (error, response) => {
        if (error !== null) {
          let binanceError = JSON.parse(error.body).msg;
          if (tooManyOrders < MAX_ORDER_RETRIES && binanceError.indexOf('Too many new orders') != -1) {
            await sleep(1000);
            tooManyOrders++;
            self.postMessage([
              execId, 'LOG', 'Strategy ' + strategy.name + ' on instrumnet ' + execution.instrument + ' was not able to BUY. The bot will try again in 1 sec. Error from Binance: ' + binanceError
            ]);
            resolve(marketBuy(execution, curPrice));
            return;
          }

          tooManyOrders = 0;
          paused = true;
          lastUpdated = null;
          self.postMessage([
            execId, 'ERROR', 'Error buying ' + execution.positionSize + ' ' + execution.instrument + '. Error message from Binance: ' + binanceError
          ]);
          resolve(false);
        } else {
          let tradePrice = await getOrderTradePrice(execution, response.orderId, 'buy');
          let trade = {
            'openDate': new Date(),
            'entry': tradePrice[0],
            'result': 0,
            'posSize': execution.positionSizeToSell
          };
          execution.trades.push(trade);
          self.postMessage([execId, 'BUY', trade, feeRate]);
          tooManyOrders = 0;
          resolve(true);
        }
      });
    });
  });
}

async function marketSell(execution, curPrice) {
  await cancelOrder(execution.instrument, execution.takeProfitOrderId);
  let takeProfitExecutedQty = await checkTakeProfitExecuted();
  let positionSize = execution.positionSizeToSell + execution.minNotionalAmountLeft;
  positionSize = binanceRoundAmmount(positionSize);
  if (takeProfitExecutedQty >= positionSize) {
    return;
  }
  positionSize -= takeProfitExecutedQty;

  if (curPrice * positionSize < instrumentInfo.minNotional) {

    let priceAndQty = await getOrderTradePrice(execution, execution.takeProfitOrderId, 'sell');
    if (priceAndQty === null || priceAndQty[1] == null) {
      self.postMessage([execId, 'ERROR', 'Connection to Binance Lost!']);
      return;
    }
    execution.minNotionalAmountLeft = positionSize;
    self.postMessage([execId, 'MIN_NOTIONAL', execution.minNotionalAmountLeft]);
    trailingSlPriceUsed = -1;
    stoploss = null;
    self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
    tradeType = 'buy';
    let tradeIndex = execution.trades.length - 1;
    execution.trades[tradeIndex]['closeDate'] = new Date();
    execution.trades[tradeIndex]['exit'] = priceAndQty[0];
    execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
    execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (priceAndQty[1] * priceAndQty[0]);
    execution.trades[tradeIndex]['posSize'] = priceAndQty[1];
    self.postMessage([
      execId, 'SELL', execution.trades[tradeIndex]
    ]);
    return;
  }

  positionSize = binanceRoundAmmount(positionSize);

  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.marketSell(execution.instrument, positionSize, async (error, response) => {
        if (error !== null) {
          let binanceError = JSON.parse(error.body).msg;
          if (tooManyOrders < MAX_ORDER_RETRIES && binanceError.indexOf('Too many new orders') != -1) {
            await sleep(1000);
            tooManyOrders++;
            self.postMessage([
              execId, 'LOG', 'Strategy ' + strategy.name + ' on instrumnet ' + execution.instrument + ' was not able to SELL. The bot will try again in 1 sec. Error from Binance: ' + binanceError
            ]);
            resolve(marketSell(execution, curPrice));
            return;
          }

          tooManyOrders = 0;
          paused = true;
          lastUpdated = null;
          self.postMessage([
            execId, 'ERROR', 'Error selling ' + positionSize + ' ' + execution.instrument + '. Error message from Binance: ' + binanceError
          ]);
          resolve(false);
        } else {
          execution.minNotionalAmountLeft = 0;
          self.postMessage([execId, 'MIN_NOTIONAL', execution.minNotionalAmountLeft]);
          let tradePrice = await getOrderTradePrice(execution, response.orderId, 'sell');
          let finalPrice = tradePrice[0];
          if (takeProfitExecutedQty !== 0) {
            let takeProfitPrice = await getOrderTradePrice(execution, execution.takeProfitOrderId, 'sell');
            finalPrice = ((takeProfitPrice[0] * takeProfitPrice[1]) + (tradePrice[0] * tradePrice[1])) / positionSize;
          }
          let tradeIndex = execution.trades.length - 1;
          execution.trades[tradeIndex]['closeDate'] = new Date();
          execution.trades[tradeIndex]['exit'] = finalPrice;
          execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
          execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (positionSize * finalPrice);
          self.postMessage([
            execId, 'SELL', execution.trades[tradeIndex]
          ]);
          tooManyOrders = 0;
          resolve(true);
        }
      })
    });
  });
}

function placeTakeProfitLimit(execution, target) {
  return new Promise(async (resolve, reject) => {
    let price = Number.parseFloat(target.toFixed(instrumentInfo.precision));
    let positionSize = execution.positionSizeToSell + execution.minNotionalAmountLeft;
    positionSize = binanceRoundAmmount(positionSize);
    binance.useServerTime(function() {
      binance.sell(execution.instrument, positionSize, price, {
        type: "LIMIT"
      }, async (error, response) => {
        if (error) {
          let binanceError = JSON.parse(error.body).msg;
          if (tooManyOrders < MAX_ORDER_RETRIES && binanceError.indexOf('Too many new orders') != -1) {
            await sleep(1000);
            tooManyOrders++;
            self.postMessage([
              execId, 'LOG', 'Strategy ' + strategy.name + ' on instrumnet ' + execution.instrument + ' was not able to place SELL LIMIT ORDER. The bot will try again in 1 sec. Error from Binance: ' + binanceError
            ]);
            resolve(placeTakeProfitLimit(execution, target));
            return;
          }

          tooManyOrders = 0;
          paused = true;
          lastUpdated = null;
          self.postMessage([
            execId, 'ERROR', 'Error placing TAKE_PROFIT_LIMIT order for instrument ' + execution.instrument + '. Please take in mind that the strategy has bought and hasn\'t sell. You should manually sell on Binance the ammount or place the limit take profit order. Error message from Binance: ' + binanceError
          ]);
          resolve(null);
          return;
        }
        tooManyOrders = 0;
        execution.takeProfitOrderId = response.orderId;
        self.postMessage([execId, 'TAKE_PROFIT_ORDER_ID', response.orderId]);
        resolve(response.orderId);
      });
    });
  });
}

function cancelOrder(instrument, orderId) {
  if (orderId === null || orderId === undefined) {
    return;
  }
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.cancel(instrument, orderId, (error, response, symbol) => {
        resolve(response);
      });
    });
  });
}

function balanceUpdate(data) {}

async function checkTakeProfitExecuted() {
  if (execution.type !== 'Trading' || execution.takeProfitOrderId === null || execution.takeProfitOrderId === undefined) {
    return 0;
  }
  let priceAndQty = await getOrderTradePrice(execution, execution.takeProfitOrderId, 'sell');
  if (priceAndQty === null || priceAndQty[1] == null) {
    return 0;
  }
  let positionSize = execution.positionSizeToSell + execution.minNotionalAmountLeft;
  positionSize = binanceRoundAmmount(positionSize);
  if (priceAndQty[1] >= positionSize) {
    execution.minNotionalAmountLeft = 0;
    self.postMessage([execId, 'MIN_NOTIONAL', execution.minNotionalAmountLeft]);
    tradeType = 'buy';

    let tradeIndex = execution.trades.length - 1;
    execution.trades[tradeIndex]['closeDate'] = new Date();
    execution.trades[tradeIndex]['exit'] = priceAndQty[0];
    execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
    execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (priceAndQty[1] * priceAndQty[0]);
    self.postMessage([
      execId, 'SELL', execution.trades[tradeIndex]
    ]);
  }
  return priceAndQty[1];
}

async function executionUpdate(data) {
  try {
    let {
      x: executionType,
      s: symbol,
      p: price,
      q: quantity,
      S: side,
      o: orderType,
      i: orderId,
      X: orderStatus
    } = data;
    if (orderId == execution.takeProfitOrderId) {
      await checkTakeProfitExecuted();
    }
  } catch (err) {
    self.postMessage([execId, 'ERROR', err.stack]);
  }
}

function getBinanceTicks(timeframe) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.candlesticks(execution.instrument, timeframe, (error, ticks, symbol) => {
        if (error) {
          reject(error);
        } else {
          resolve(ticks);
        }
      }, {limit: 300});
    });
  });
}

function getLastOrderId(instrument) {
  return new Promise((resolve, reject) => {
    binance.useServerTime(function() {
      binance.prevDay(instrument, (error, prevDay, symbol) => {
        if (error) {
          reject(error);
        }
        resolve(prevDay.lastId);
      });
    });
  });
}

async function retryConnection(err) {
  paused = true;
  lastUpdated = null;
  startTries++;
  if (startTries > MAX_CONENCTION_RETRIES) {
    self.postMessage([
      execId, 'ERROR', 'Connection to Binance lost. Binance may be in maintenance, ' + execution.instrument + ' trading may be halted or you may have lost connection to the Internet. : Details: ' + err
    ]);
  } else {
    self.postMessage([execId, 'STALLED']);
    await sleep(1000 * 60 * 1); // 1 minute
    paused = true;
    await mutex.release();
    let endpoints = binance.websockets.subscriptions();
    for (let endpoint in endpoints) {
      binance.websockets.terminate(endpoint);
    }
    self.postMessage([
      execId, 'LOG', 'Resetting Binance connection for strategy ' + strategy.name + ' on instrumnet ' + execution.instrument + '. Retry ' + startTries
    ]);
    await sleep(1000);
    await mutex.release();
    await sleep(4000);
    lastUpdated = null;
    startBinanceWebsocket();
  }

}

async function verifyWebsocketIsAlive(timeframe) {
  let minutes = 1;

  switch (timeframe) {
    case '1 minute':
      minutes = 1;
      break;
    case '3 minutes':
      minutes = 3;
      break;
    case '5 minutes':
      minutes = 5;
      break;
    case '15 minutes':
      minutes = 15;
      break;
    case '30 minutes':
      minutes = 30;
      break;
    case '1 hour':
      minutes = 60;
      break;
    case '2 hours':
      minutes = 60 * 2;
      break;
    case '4 hours':
      minutes = 60 * 4;
      break;
    case '6 hours':
      minutes = 60 * 6;
      break;
    case '12 hours':
      minutes = 60 * 12;
      break;
    case '1 day':
      minutes = 60 * 24;
      break;
  }
  let currentStart = startupsCount;
  while (!paused) {
    if (startupsCount !== currentStart) {
      break;
    }
    if (lastUpdated != null) {
      let date = null;
      try {
        await lastUpdateMutex.lock();
        date = new Date(lastUpdated.getTime());
        date.setMinutes(date.getMinutes() + minutes, date.getSeconds() + 30, date.getMilliseconds());
      } finally {
        await lastUpdateMutex.release();
      }
      if (date < new Date()) {
        startTries++;
        if (startTries > MAX_CONENCTION_RETRIES) {
          self.postMessage([
            execId, 'ERROR', 'Connection to Binance lost. Binance may be in maintenance, ' + execution.instrument + ' trading may be halted or you may have lost connection to the Internet.'
          ]);
          return;
        }
        paused = true;
        await mutex.release();
        let endpoints = binance.websockets.subscriptions();
        for (let endpoint in endpoints) {
          binance.websockets.terminate(endpoint);
        }
        self.postMessage([
          execId, 'LOG', 'Resetting Binance websocket listener for strategy ' + strategy.name + ' on instrumnet ' + execution.instrument + '..'
        ]);
        await sleep(1000);
        await mutex.release();
        await sleep(4000);
        lastUpdated = null;
        startBinanceWebsocket();
        break;
      }
    }
    await sleep(1000 * 10); // 10 sec
  }
}

async function startBinanceWebsocket() {
  let endpoints = binance.websockets.subscriptions();
  if (endpoints.length > 0) {
    self.postMessage([
      execId, 'LOG', 'startBinanceWebsocket() is called while there are running endpoint for execution ' + strategy.name + ' on instrumnet ' + execution.instrument + '.'
    ]);
    return;
  }

  if (execution.type === 'Trading') {
    binance.websockets.userData(balanceUpdate, executionUpdate);
  }
  let bigTf = execution.timeframes[0];
  let smallTf = execution.timeframes[execution.timeframes.length - 1];
  let bigTfEndDate = null;
  let closePrices = {};
  let highPrices = {};
  let lowPrices = {};
  for (let ft of execution.timeframes) {
    closePrices[ft] = [];
    highPrices[ft] = [];
    lowPrices[ft] = [];
  }

  let buyRulesHaveOnlyBigTf = true;
  for (let rule of strategy.buyRules) {
    if (smallTf === rule.timeframe) {
      buyRulesHaveOnlyBigTf = false;
      break;
    }
  }

  startupsCount++;
  paused = false;
  lastUpdated = null;
  verifyWebsocketIsAlive(smallTf);
  await sleep(1000);
  lastUpdated = new Date();
  tooManyOrders = 0;
  self.postMessage([execId, 'STARTED']);
  if (execution.type === 'Trading' && tradeType === 'sell') {
    if (execution.positionSizeQuoted != null && execution.positionSizeQuoted != undefined && execution.positionSizeQuoted > 0 && execution.trades.length > 0 && (execution.trades[execution.trades.length - 1].exit === undefined || execution.trades[execution.trades.length - 1].exit === null)) {
      execution.positionSize = execution.trades[execution.trades.length - 1].posSize;
    }
    await checkTakeProfitExecuted();
  }
  binance.websockets.chart(execution.instrument, getShortTimeframe(smallTf), async (symbol, interval, chart) => {
    if (paused) {
      return;
    }
    try {
      await mutex.lock();
      if (paused) {
        return;
      }
      let lastDate = binance.last(chart);
      if (chart[lastDate] === undefined) {
        retryConnection('Binance API does not return realtime prices.');
        return;
      }

      self.postMessage([execId, 'LAST_UPDATED']);
      try {
        await lastUpdateMutex.lock();
        lastUpdated = new Date();
      } finally {
        await lastUpdateMutex.release();
      }
      closePrices[smallTf] = [];
      highPrices[smallTf] = [];
      lowPrices[smallTf] = [];
      Object.keys(chart).forEach(function(key) {
        try {
          let close = Number.parseFloat(chart[key].close);
          let high = Number.parseFloat(chart[key].high);
          let low = Number.parseFloat(chart[key].low);
          if (!isNaN(close)) {
            closePrices[smallTf].push(close);
            highPrices[smallTf].push(high);
            lowPrices[smallTf].push(low);
          }
        } catch (err) {}
      });
      //Remove the last value as the current candle is not closed
      let curPrice = closePrices[smallTf].pop();
      highPrices[smallTf].pop();
      lowPrices[smallTf].pop();

      //Get big timeframe if needed
      if (smallTf !== bigTf) {
        let dateNow = new Date();
        if (bigTfEndDate === null || dateNow > bigTfEndDate) {
          let bigTfTicks = await getBinanceTicks(getShortTimeframe(bigTf));

          if (bigTfTicks === null || bigTfTicks === undefined || bigTfTicks.length === 0) {
            retryConnection('Binance API does not return realtime prices.');
            return;
          }
          closePrices[bigTf] = [];
          highPrices[bigTf] = [];
          lowPrices[bigTf] = [];
          for (let tick of bigTfTicks) {
            bigTfEndDate = new Date(tick[6]);
            closePrices[bigTf].push(Number.parseFloat(tick[4]));
            highPrices[bigTf].push(Number.parseFloat(tick[2]));
            lowPrices[bigTf].push(Number.parseFloat(tick[3]));
          }

          //Remove the last value as the current candle is not closed
          closePrices[bigTf].pop();
          highPrices[bigTf].pop();
          lowPrices[bigTf].pop();
        }
      }

      if (lastDate !== lastCheckedData) {
        //New candle, so check trading rules
        lastCheckedData = lastDate;
        if (!firstCande) {
          if (execution.type === 'Alerts') {
            if (alertType === 'buy') {
              if (!buyRulesHaveOnlyBigTf || bigTfEndDate !== lastCheckedDataBigTf) {
                lastCheckedDataBigTf = bigTfEndDate;
                if (checkTradeRules(strategy.buyRules, closePrices, highPrices, lowPrices)) {
                  alertType = 'sell';
                  self.postMessage([execId, 'BUY', curPrice, new Date()]);
                }
              }
            } else {
              if (checkTradeRules(strategy.sellRules, closePrices, highPrices, lowPrices)) {
                alertType = 'buy';
                self.postMessage([execId, 'SELL', curPrice, new Date()]);
              }
            }
          } else {

            if (tradeType === 'buy') {
              if (!buyRulesHaveOnlyBigTf || bigTfEndDate !== lastCheckedDataBigTf) {
                lastCheckedDataBigTf = bigTfEndDate;
                if (checkTradeRules(strategy.buyRules, closePrices, highPrices, lowPrices)) {
                  //Should buy at market
                  if (execution.type === 'Simulation') {
                    //Get current ASK price and use it as a trade entry.
                    for (let i = 0; i < 10; i++) {
                      //There may not be ASK price at the moment. Try 10 times to find one.
                      let bidAsk = await getBidAsk(execution.instrument);
                      if (isNaN(bidAsk[1])) {
                        await sleep(100);
                      } else {
                        curPrice = bidAsk[1];
                        break;
                      }
                    }
                    if (strategy.stoploss !== null && !isNaN(strategy.stoploss)) {
                      stoploss = curPrice * (1 - (strategy.stoploss / 100));
                    }
                    if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl)) {
                      trailingSlPriceUsed = curPrice;
                      stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
                      self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
                    }
                    if (strategy.target !== null && !isNaN(strategy.target)) {
                      target = curPrice * (1 + (strategy.target / 100));
                    }
                    await updatePositionSize(curPrice);
                    let trade = {
                      'openDate': new Date(),
                      'entry': curPrice,
                      'result': 0,
                      'posSize': execution.positionSize
                    };

                    execution.trades.push(trade);
                    if (strategy.timeClose !== null && !isNaN(strategy.timeClose)) {
                      timeClose = new Date(trade.openDate.getTime());
                      timeClose.setHours(timeClose.getHours() + strategy.timeClose);
                    }
                    self.postMessage([execId, 'BUY', trade, feeRate]);
                  } else {
                    //Real trading - market buy
                    let marketBuyOk = await marketBuy(execution, curPrice);
                    if (!marketBuyOk) {
                      return;
                    }
                    if (strategy.stoploss !== null && !isNaN(strategy.stoploss)) {
                      stoploss = execution.trades[execution.trades.length - 1].entry * (1 - (strategy.stoploss / 100));
                    }
                    if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl)) {
                      trailingSlPriceUsed = execution.trades[execution.trades.length - 1].entry;
                      stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
                      self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
                    }
                    if (strategy.target !== null && !isNaN(strategy.target)) {
                      target = execution.trades[execution.trades.length - 1].entry * (1 + (strategy.target / 100));
                      if (strategy.ttarget == null || isNaN(strategy.ttarget)) {
                        await placeTakeProfitLimit(execution, target);
                      }
                    }
                    if (strategy.timeClose !== null && !isNaN(strategy.timeClose)) {
                      timeClose = new Date(execution.trades[execution.trades.length - 1].openDate.getTime());
                      timeClose.setHours(timeClose.getHours() + strategy.timeClose);
                    }
                  } //Real trading - market buy
                  tradeType = 'sell';
                  startTries = 0;
                  return;
                } //Check BigTF only contains buy rules  bigTfEndDate !== lastCheckedDataBigTf
              } //checkTradeRules - buyRules
            } else {
              // tradeType === 'sell'
              if (checkTradeRules(strategy.sellRules, closePrices, highPrices, lowPrices)) {
                if (execution.type === 'Simulation') {
                  //Get current BID price and use it as a trade exit.
                  for (let i = 0; i < 10; i++) {
                    //There may not be BID price at the moment. Try 10 times to find one
                    let bidAsk = await getBidAsk(execution.instrument);
                    if (isNaN(bidAsk[0])) {
                      await sleep(100);
                    } else {
                      curPrice = bidAsk[0];
                      break;
                    }
                  }
                  let tradeIndex = execution.trades.length - 1;
                  execution.trades[tradeIndex]['closeDate'] = new Date();
                  execution.trades[tradeIndex]['exit'] = curPrice;
                  execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
                  execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (execution.trades[tradeIndex].posSize * curPrice);
                  self.postMessage([
                    execId, 'SELL', execution.trades[tradeIndex]
                  ]);
                } else {
                  await marketSell(execution, curPrice);
                }
                trailingSlPriceUsed = -1;
                stoploss = null;
                self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
                tradeType = 'buy';
                startTries = 0;
                return;
              } //checkTradeRules - sellRules
            } // tradeType === 'sell'
          } //Simulation and Real Trading
        } else {
          firstCande = false;
        }
      } // if (lastDate !== lastCheckedData)

      //Same candle check only stoploss and target
      if (tradeType === 'sell') {
        if (execution.type !== 'Alerts') {
          if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl) && trailingSlPriceUsed !== -1 && trailingSlPriceUsed < curPrice) {
            trailingSlPriceUsed = curPrice;
            stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
            self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
          }
          if (strategy.target !== null && !isNaN(strategy.target) && strategy.ttarget !== null && !isNaN(strategy.ttarget)) {
            if (trailingSlPriceUsed == -1) {
              if (target <= curPrice) {
                trailingSlPriceUsed = curPrice;
                stoploss = trailingSlPriceUsed * (1 - (strategy.ttarget / 100));
                self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
              }
            } else {
              if (trailingSlPriceUsed < curPrice) {
                trailingSlPriceUsed = curPrice;
                stoploss = trailingSlPriceUsed * (1 - (strategy.ttarget / 100));
                self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
              }
            }
          }

          if (execution.type === 'Simulation') {
            if ((stoploss !== null && stoploss >= curPrice) || (target !== null && target <= curPrice && (strategy.ttarget == null || isNaN(strategy.ttarget))) || (timeClose !== null && timeClose <= new Date())) {
              //Get current BID price and use it as a trade exit.
              for (let i = 0; i < 10; i++) {
                //There may not be BID price at the moment. Try 10 times to find one
                let bidAsk = await getBidAsk(execution.instrument);
                if (isNaN(bidAsk[0])) {
                  await sleep(100);
                } else {
                  curPrice = bidAsk[0];
                  break;
                }
              }

              let tradeIndex = execution.trades.length - 1;
              execution.trades[tradeIndex]['closeDate'] = new Date();
              execution.trades[tradeIndex]['exit'] = curPrice;
              execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
              execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (execution.trades[tradeIndex].posSize * curPrice);
              self.postMessage([
                execId, 'SELL', execution.trades[tradeIndex]
              ]);
              trailingSlPriceUsed = -1;
              stoploss = null;
              self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
              tradeType = 'buy';
            }
          }
          if (execution.type === 'Trading') {
            if ((stoploss !== null && stoploss >= curPrice) || (timeClose !== null && timeClose <= new Date())) {
              await marketSell(execution, curPrice);
              trailingSlPriceUsed = -1;
              stoploss = null;
              self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
              tradeType = 'buy';
            }
          }

        }

      }
      startTries = 0;
    } catch (err2) {
      retryConnection(err2.stack);
    } finally {
      await mutex.release();
    }
  });
}

let binance = null;
let execution = null;
let strategy = null;
let apiKey = null;
let apiSecret = null;
let testMode = true;
let tradeType = 'buy';
let stoploss = null;
let target = null;
let timeClose = null;
let trailingSlPriceUsed = -1;
let alertType = 'buy';
let feeRate = null;
let execId = null;
let mutex = new Mutex();
let lastUpdateMutex = new Mutex();
let startupsCount = 0;
let lastCheckedData = -1;
let lastCheckedDataBigTf = -1;
let firstCande = true; // skip the first candle
let instrumentInfo = null;
let paused = false;
let startTries = 0;
let lastUpdated = null;
const MAX_CONENCTION_RETRIES = 10;
const MAX_ORDER_RETRIES = 10;
let tooManyOrders = 0;

self.addEventListener('message', async function(e) {
  try {
    if (typeof e.data === 'string' && e.data === ('PAUSE')) {
      paused = true;
      lastUpdated = null;
      startTries = 0;
      tooManyOrders = 0;
      let endpoints = binance.websockets.subscriptions();
      for (let endpoint in endpoints) {
        binance.websockets.terminate(endpoint);
      }
      await mutex.release();
      return;
    }
    if (typeof e.data === 'string' && e.data === ('DELAYED_TERMINATE')) {
      await mutex.release();
      await sleep(5000)
      self.close();
      return;
    }
    if (typeof e.data === 'string' && e.data === ('SELL_AND_STOP')) {
      paused = true;
      lastUpdated = null;
      startTries = 0;
      tooManyOrders = 0;
      let endpoints = binance.websockets.subscriptions();
      for (let endpoint in endpoints) {
        binance.websockets.terminate(endpoint);
      }
      await mutex.release();

      //get current price
      if (tradeType == "sell") {
        let curPrice = null;
        for (let i = 0; i < 100; i++) {
          //There may not be BID price at the moment. Try 100 times to find one
          let bidAsk = await getBidAsk(execution.instrument);
          if (isNaN(bidAsk[0])) {
            await sleep(200);
          } else {
            curPrice = bidAsk[0];
            break;
          }
        }
        if (curPrice == null) {
          self.postMessage([]);
          execId,
          'ERROR',
          'Cannot connect to Binance and sell ' + execution.instrument
          return;
        }

        if (execution.type === 'Simulation') {
          let tradeIndex = execution.trades.length - 1;
          execution.trades[tradeIndex]['closeDate'] = new Date();
          execution.trades[tradeIndex]['exit'] = curPrice;
          execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (feeRate * 2);
          execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (execution.trades[tradeIndex].posSize * curPrice);
          self.postMessage([
            execId, 'SELL', execution.trades[tradeIndex]
          ]);
          trailingSlPriceUsed = -1;
          stoploss = null;
          self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
          tradeType = 'buy';
        } else if (execution.type === 'Trading') {
          await marketSell(execution, curPrice);
          trailingSlPriceUsed = -1;
          stoploss = null;
          self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
          tradeType = 'buy';
        }
      }
      return;
    }
    if (typeof e.data === 'string' && e.data === ('TERMINATE')) {
      let endpoints = binance.websockets.subscriptions();
      for (let endpoint in endpoints) {
        binance.websockets.terminate(endpoint);
      }
      await mutex.release();
      //Reset to deaults
      binance = null;
      execution = null;
      strategy = null;
      apiKey = null;
      apiSecret = null;
      testMode = true;
      tradeType = 'buy';
      stoploss = null;
      target = null;
      timeClose = null;
      trailingSlPriceUsed = -1;
      alertType = 'buy';
      feeRate = null;
      execId = null;
      mutex = new Mutex();
      lastCheckedData = -1;
      lastCheckedDataBigTf = -1;
      firstCande = true;
      instrumentInfo = null;
      paused = false;
      startTries = 0;
      tooManyOrders = 0;
      lastUpdated = null;
      return;
    } else if (typeof e.data === 'string' && e.data === ('RESUME')) {
      startBinanceWebsocket();
      return;
    } else if (typeof e.data[0] === 'string' && e.data[0] === ('UPDATE_EXECUTION')) {
      execution.positionSize = e.data[1].positionSize;
      execution.positionSizeQuoted = e.data[1].positionSizeQuoted;
      execution.feeRate = e.data[1].feeRate;
      return;
    } else if (typeof e.data[0] === 'string' && e.data[0] === ('UPDATE_TRADE')) {
      let tradeIndex = execution.trades.length - 1;
      execution.trades[tradeIndex]['closeDate'] = new Date();
      execution.trades[tradeIndex]['exit'] = e.data[1];
      execution.trades[tradeIndex]['result'] = (((execution.trades[tradeIndex].exit - execution.trades[tradeIndex].entry) / execution.trades[tradeIndex].entry) * 100) - (execution.feeRate * 2);
      if (execution.positionSizeQuoted != null && execution.positionSizeQuoted != undefined && execution.positionSizeQuoted > 0) {
        execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (execution.positionSizeQuoted);
      } else {
        execution.trades[tradeIndex]['resultMoney'] = (execution.trades[tradeIndex]['result'] / 100) * (execution.trades[tradeIndex].posSize * e.data[1]);
      }
      execution.takeProfitOrderId = null;
      trailingSlPriceUsed = -1;
      self.postMessage([execId, 'TRAILING_STOP_PRICE', trailingSlPriceUsed]);
      tradeType = 'buy';
      return;
    } else if (typeof e.data[0] === 'string' && e.data[0] === ('UPDATE_STRATEGY')) {
      strategy = e.data[1];

      if (execution.trades.length > 0 && (execution.trades[execution.trades.length - 1].exit === undefined || execution.trades[execution.trades.length - 1].exit === null)) {
        if (strategy.stoploss !== null && !isNaN(strategy.stoploss)) {
          stoploss = execution.trades[execution.trades.length - 1].entry * (1 - (strategy.stoploss / 100));
        }
        if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl)) {
          if (execution.trailingSlPriceUsed !== undefined && execution.trailingSlPriceUsed !== null) {
            trailingSlPriceUsed = execution.trailingSlPriceUsed;
            stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
          } else {
            trailingSlPriceUsed = execution.trades[execution.trades.length - 1].entry;
            stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
          }
        }
        if (strategy.target !== null && !isNaN(strategy.target)) {
          target = execution.trades[execution.trades.length - 1].entry * (1 + (strategy.target / 100));
          if (strategy.ttarget !== null && !isNaN(strategy.ttarget) && execution.trailingSlPriceUsed !== undefined && execution.trailingSlPriceUsed !== null) {
            trailingSlPriceUsed = execution.trailingSlPriceUsed;
            stoploss = trailingSlPriceUsed * (1 - (strategy.ttarget / 100));
          }
        }
        if (strategy.timeClose !== null && !isNaN(strategy.timeClose)) {
          timeClose = new Date(execution.trades[execution.trades.length - 1].openDate.getTime());
          timeClose.setHours(timeClose.getHours() + strategy.timeClose);
        }
      }
      return;
    }

    //Initialize
    execution = e.data[0];
    strategy = e.data[1];
    apiKey = e.data[2];
    apiSecret = e.data[3];
    instrumentInfo = e.data[4];
    execId = execution.id;
    if (execution.feeRate === null || execution.feeRate === undefined) {
      feeRate = execution.feeRate;
    }
    if (execution.type === 'Trading') {
      testMode = false;
    }
    binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      'reconnect': false,
      useServerTime: true,
      recvWindow: 60000,
      test: testMode
    });

    if (execution.trades.length > 0 && (execution.trades[execution.trades.length - 1].exit === undefined || execution.trades[execution.trades.length - 1].exit === null)) {
      tradeType = 'sell';
      if (execution.positionSizeToSell == null || execution.positionSizeToSell == undefined) {
        if (execution.positionSize != null && execution.positionSize != undefined && execution.positionSize > 0) {
          execution.positionSizeToSell = execution.positionSize;
        } else {
          let curPrice = null;
          for (let i = 0; i < 10; i++) {
            let bidAsk = await getBidAsk(execution.instrument);
            if (isNaN(bidAsk[0])) {
              await sleep(500);
            } else {
              curPrice = bidAsk[0];
              break;
            }
          }
          if (curPrice == null) {
            self.postMessage([]);
            execId,
            'ERROR',
            'Cannot connect to Binance ' + execution.instrument
            return;
          }
          execution.positionSizeToSell = binanceRoundAmmount(execution.positionSizeQuoted / curPrice);
        }
      }
      if (strategy.stoploss !== null && !isNaN(strategy.stoploss)) {
        stoploss = execution.trades[execution.trades.length - 1].entry * (1 - (strategy.stoploss / 100));
      }
      if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl)) {
        if (execution.trailingSlPriceUsed !== undefined && execution.trailingSlPriceUsed !== null) {
          trailingSlPriceUsed = execution.trailingSlPriceUsed;
          stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
        } else {
          trailingSlPriceUsed = execution.trades[execution.trades.length - 1].entry;
          stoploss = trailingSlPriceUsed * (1 - (strategy.trailingSl / 100));
        }
      }
      if (strategy.target !== null && !isNaN(strategy.target)) {
        target = execution.trades[execution.trades.length - 1].entry * (1 + (strategy.target / 100));
        if (strategy.ttarget !== null && !isNaN(strategy.ttarget) && execution.trailingSlPriceUsed !== undefined && execution.trailingSlPriceUsed !== null) {
          trailingSlPriceUsed = execution.trailingSlPriceUsed;
          stoploss = trailingSlPriceUsed * (1 - (strategy.ttarget / 100));
        }
      }
      if (strategy.timeClose !== null && !isNaN(strategy.timeClose)) {
        timeClose = new Date(execution.trades[execution.trades.length - 1].openDate.getTime());
        timeClose.setHours(timeClose.getHours() + strategy.timeClose);
      }
    }
    startBinanceWebsocket();
  } catch (err) {
    paused = true;
    lastUpdated = null;
    self.postMessage([execId, 'ERROR', err.stack]);
  }
}, false);

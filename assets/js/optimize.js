//EasyCryptoBot Copyright (C) 2018 Stefan Hristov

async function opFillBinanceInstruments() {
  await getBinanceInstruments();
}

let opInstrumentMutex = new Mutex();
async function opInstrumentKeyup() {
  try {
    opInstrumentMutex.lock();
    $("#opInstrumentList>ul").html("");
    let instruments = null;
    if ($("#opExchangeCombobox").text() === "Binance") {
      instruments = await getBinanceInstruments();
    } else {
      $("#opInstrumentSearch").val("");
      openModalInfo("Please Choose Exchange First!");
      return;
    }

    let lastKey = null;

    if (instruments !== null) {
      let instrumentsToAdd = "";
      let search = $("#opInstrumentSearch")
        .val()
        .toLowerCase();
      Object.keys(instruments).forEach(function(key) {
        if (key.toLowerCase().indexOf(search) != -1) {
          lastKey = key.toLowerCase();
          instrumentsToAdd += '<li><a href="#/"  onclick="opFillInstrument(\'' + key + "')\">" + key + "</a></li>";
        }
      });
      if (lastKey !== null && lastKey !== search) {
        $("#opInstrumentList>ul").html(instrumentsToAdd);
        $("#opInstrument>div>ul").show();
      }
    }
  } catch (err) {
    log("error", "opInstrumentKeyup", err.stack);
  } finally {
    opInstrumentMutex.release();
  }
}

function opFillInstrument(name) {
  $("#opInstrument>div>ul").hide();
  $("#opInstrumentSearch").val(name);
}

let strategyVariations = [];
let strategyVariationsTested = 0;
let ft = 0;
let strategyVariationsResults = [];
let strategyVariationsIntermitBestResults = [];
let opExecutionCanceled = false;
let opExecutionWorkers = {};
let opExecutedIndex = 0;
let opCompleted = 0;
let maxOpWorkers = 1;
let webWorkersInitialized = false;
let or = false;
let runningWorkiers = 0;
let marketReturn;
let timeframes = null;
let startDate = null;
let ticks = {};
let feeRate = null;
let optType = "return";
let changeStoploss;
let changeTarget;
let changeStoplossFine;
let changeTargetFine;
let etaLastDate = null;
let etaStr = "";
let etaLastNum = null;
let strategyNameToUse = "";
let useTrailingStop = false;
let useTrailingTarget = false;
const executionOpMutex = new Mutex();
const addOpResultMutex = new Mutex();
const opWorkerTerminateMutex = new Mutex();
const runningWorkersMutex = new Mutex();

function isor() {
  return or;
}

async function getNextOpStrategy() {
  try {
    await executionOpMutex.lock();
    if (opExecutedIndex < strategyVariations.length) {
      let strategy = strategyVariations[opExecutedIndex];
      opExecutedIndex++;
      return strategy;
    } else {
      return null;
    }
  } finally {
    executionOpMutex.release();
  }
}
async function addOpResult(result) {
  try {
    await addOpResultMutex.lock();
    opCompleted++;
    if (result !== null) {
      strategyVariationsResults.push(result);
    }
    return opCompleted;
  } finally {
    addOpResultMutex.release();
  }
}
async function runOptimize() {
  if (isBacktestRunning()) {
    openModalInfo("Cannot run optimization while executing backtest!");
    return;
  }
  $("#runOptBtn").addClass("disabled");
  if (hasTradingStrategies()) {
    let continueExecution = 0;
    openModalConfirm(
      '<h3>Warning</h3><div style="text-align:justify">You have realtime strategies running under Trade & Alerts tab. It is highly recommended to pause them before using the optimization feature, as it consumes a lot of your PC resources and the realtime execution may not be executed in time!</div><br><div class="text-center">Continue anyway?</div>',
      function() {
        continueExecution = 1;
      },
      function() {
        continueExecution = -1;
      }
    );

    while (continueExecution === 0) {
      await sleep(500);
      let continueExecution = 0;
    }
    if (continueExecution === -1) {
      $("#runOptBtn").removeClass("disabled");
      return;
    }
  }

  $("#opCancelBtn").removeClass("disabled");
  let strategyName = $("#opStrategyCombobox").text();
  let exchange = $("#opExchangeCombobox").text();
  let instrument = $("#opInstrumentSearch")
    .val()
    .toUpperCase();
  feeRate = $("#opFeeSearch").val();
  if (strategyName === "Choose Strategy") {
    openModalInfo("Please Choose a Strategy!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  if (exchange === "Choose Exchange") {
    openModalInfo("Please Choose an Exchange!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  if (exchange === "Binance") {
    let instruments = await getBinanceInstruments();
    if (!(instrument in instruments)) {
      openModalInfo("Invalid Instrument!<br>Please Choose an Instrument!");
      $("#runOptBtn").removeClass("disabled");
      return;
    }
  }
  if (feeRate <= 0) {
    openModalInfo("Fee rate should be a positive number!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  let startDateStr = $("#opFromDate").val();
  let endDateStr = $("#opToDate").val();

  startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    openModalInfo("Please Choose a Start Date!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  startDate.setHours(0, 0, 0, 0);
  let endDate = new Date(endDateStr);

  if (isNaN(endDate.getTime())) {
    openModalInfo("Please Choose an End Date!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  if (startDate >= endDate) {
    openModalInfo("Start Date must be before End Date!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  endDate.setHours(23, 59, 59, 59);
  let endDateTmp = new Date(endDate.getTime());
  endDateTmp.setMonth(endDate.getMonth() - 2);
  endDateTmp.setDate(endDateTmp.getDate() - 1);
  if (startDate < endDateTmp) {
    openModalInfo("The maximum period is 3 months. Please change the selected dates.");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  if (startDate >= endDate) {
    openModalInfo("Start Date must be before End Date!");
    $("#runOptBtn").removeClass("disabled");
    return;
  }
  if ($("#opTypeMaxReturn").is(":checked")) {
    optType = "return";
  } else if ($("#opTypeSmooth").is(":checked")) {
    optType = "smooth";
  } else if ($("#opTypeRiskReward").is(":checked")) {
    optType = "riskReward";
  }
  changeStoploss = $("#opChangeStoplossYes").is(":checked") || $("#opChangeStoplossFine").is(":checked");
  changeTarget = $("#opChangeTargetYes").is(":checked") || $("#opChangeTargetFine").is(":checked");

  changeStoplossFine = $("#opChangeStoplossFine").is(":checked");
  changeTargetFine = $("#opChangeTargetFine").is(":checked");

  try {
    or = true;
    opExecutionCanceled = false;
    let strategy = await getStrategyByName(strategyName);
    if (strategy === null) {
      openModalInfo("Please Choose a Strategy!");
      $("#opStrategyCombobox").html("Choose Strategy");
      or = false;
      $("#runOptBtn").removeClass("disabled");
      return;
    }

    if (
      $("#opChangeStoplossFine").is(":checked") &&
      (strategy.stoploss == undefined || strategy.stoploss == null || isNaN(strategy.stoploss)) &&
      (strategy.trailingSl == undefined || strategy.trailingSl == null || isNaN(strategy.trailingSl))
    ) {
      openModalInfo("The Fine Tune Stoploss option works only for strategies with a stoploss or a trailing stoploss.");
      or = false;
      $("#runOptBtn").removeClass("disabled");
      return;
    }

    if (
      $("#opChangeTargetFine").is(":checked") &&
      (strategy.target == undefined || strategy.target == null || isNaN(strategy.target))
    ) {
      openModalInfo("The Fine Tune Target option works only for strategies with a target.");
      or = false;
      $("#runOptBtn").removeClass("disabled");
      return;
    }
    strategyNameToUse = strategy.name + " (" + instrument + " Opt.)";
    $("#opRunPercent").html("Starting Optimization..");
    $("#opRunRemaining").html("&nbsp;");
    $("#opRunPercent2").hide();
    $("#opRunRocket").hide();
    $("#opCancelDiv").hide();
    $("#opRunning").show();
    $("#opResult").hide();
    $("#opResultNoTrades").hide();
    $("#opExecInfo").hide();
    $("#opResultDiv").show();
    $("#opStrategiesTable").html(
      "<thead><tr><td>Strategy</td><td>Total Return</td><td>Max Drawdown</td><td>Winning %</td><td>Avg. Trade</td><td>Best Trade</td><td>Worst Trade</td><td>Trades N.</td><td>Save</td></tr></thead><tbody>"
    );
    $("#opCancelDiv").show();

    timeframes = getTimeframes(strategy);
    if (timeframes === null) {
      $("#runOptBtn").removeClass("disabled");
      $("#opRunning").hide();
      $("#opResult").hide();
      openModalInfo("Your strategy contains a rule without a timeframe. Please edit your strategy!");
      or = false;
      return;
    }

    let fieldsToChange = calculateFieldsToChange(strategy);
    if (fieldsToChange > 20) {
      openModalInfo(
        "Your strategy contains too many input fields (" +
          fieldsToChange +
          ") to be optimized. The maximum allowed number is 20."
      );
      $("#runOptBtn").removeClass("disabled");
      $("#opRunning").hide();
      $("#opResult").hide();
      or = false;
      return;
    }

    useTrailingStop = strategy.trailingSl !== null && !isNaN(strategy.trailingSl);
    useTrailingTarget = strategy.ttarget !== null && !isNaN(strategy.ttarget);
    if (strategy.ttarget != null && strategy.ttarget != undefined) ticks = {};
    for (let tf of timeframes) {
      let tfTicks = await getBinanceTicks(
        instrument,
        getShortTimeframe(tf),
        getStartDate(tf, startDate),
        endDate,
        false
      );
      if (tfTicks === null) {
        $("#runOptBtn").removeClass("disabled");
        $("#opRunning").hide();
        $("#opResult").hide();
        if (!opExecutionCanceled) {
          openModalInfo(
            "Could not optain data from " +
              exchange +
              " for the given period. The period may be too long. Please try with smaller period or try again later!"
          );
        }
        or = false;
        return;
      }
      ticks[tf] = tfTicks;

      if (opExecutionCanceled) {
        return;
      }
    }

    marketReturn = 0;
    let ticksTmp = ticks[timeframes[0]];
    for (let tick of ticksTmp) {
      if (tick.d >= startDate) {
        marketReturn = ((ticksTmp[ticksTmp.length - 1].c - tick.o) / tick.o) * 100;
        break;
      }
    }

    $("#opRunPercent2").hide();
    $("#opRunPercent").html("Optimization Execution: 0%");
    $("#opRunRemaining").html("&nbsp;");
    $("#opRunRocket").show();
    strategyVariations = [];
    ft = 0;
    strategyVariationsTested = 0;
    setrvp(strategy);

    strategyVariations = await getStrategyVariations(strategy, ft);
    strategyVariations.push(strategy);
    strategyVariationsTested = strategyVariations.length;

    strategyVariationsResults = [];
    strategyVariationsIntermitBestResults = [];
    opExecutedIndex = 0;
    opExecutionCanceled = false;
    opCompleted = 0;
    etaLastDate = null;
    etaStr = "";
    etaLastNum = null;
    //Initialize webworkers
    let cpus = os.cpus().length;

    let maxCPUs = cpus > 1 ? cpus - 1 : 1;
    if ($("#opOneCore").is(":checked")) {
      maxOpWorkers = 1;
    } else if ($("#opHalfCores").is(":checked")) {
      maxOpWorkers = cpus > 1 ? cpus / 2 : 1;
    } else {
      maxOpWorkers = maxCPUs;
    }

    if (!webWorkersInitialized) {
      for (let i = 0; i < maxCPUs; i++) {
        opExecutionWorkers[i] = new Worker("./assets/js/optimize-execution.js");
        opExecutionWorkers[i].addEventListener(
          "error",
          async function(e) {
            log("error", "opExecutionWorkers.EventListener error", e.message + "<br>" + e.filename + " " + e.lineno);
            openModalInfo("Internal Error Occurred!<br>" + e.message + "<br>" + e.filename + " " + e.lineno);
          },
          false
        );
        opExecutionWorkers[i].addEventListener(
          "message",
          async function(e) {
            try {
              if (typeof e.data === "string" && e.data.startsWith("ERR")) {
                log("error", "opExecutionWorkers.EventListener error", e.data);
                openModalInfo("Internal Error Occurred!<br>" + e.data);
                return;
              } else if (e.data instanceof Array && e.data[0] === "STARTED") {
                let nextStrategy = await getNextOpStrategy();
                if (nextStrategy !== null) {
                  try {
                    await opWorkerTerminateMutex.lock();
                    if (opExecutionCanceled) {
                      return;
                    }
                    if (opExecutionWorkers[e.data[1]] !== undefined) {
                      opExecutionWorkers[e.data[1]].postMessage(["STRATEGY", nextStrategy]);
                    }
                  } finally {
                    opWorkerTerminateMutex.release();
                  }
                }
              } else if (e.data instanceof Array && e.data[0] === "STOPPED") {
                try {
                  await runningWorkersMutex.lock();
                  runningWorkiers--;
                } finally {
                  runningWorkersMutex.release();
                }
              } else if (e.data instanceof Array && e.data[0] === "RESULT") {
                let nextStrategy = await getNextOpStrategy();
                if (nextStrategy !== null) {
                  try {
                    await opWorkerTerminateMutex.lock();
                    if (opExecutionCanceled) {
                      return;
                    }
                    if (opExecutionWorkers[e.data[1]] !== undefined) {
                      opExecutionWorkers[e.data[1]].postMessage(["STRATEGY", nextStrategy]);
                    }
                  } finally {
                    opWorkerTerminateMutex.release();
                  }
                }
                let completed = await addOpResult(e.data[2]);

                let percentCompleted =
                  (100 / (ftmc + 1)) * ft + (completed / strategyVariations.length) * (100 / (ftmc + 1));
                if (percentCompleted > 100) {
                  percentCompleted = 100;
                }

                let lap = 2;
                //if (percentCompleted > (100 / (ftmc + 1))) {
                if (etaLastDate == null) {
                  etaLastDate = new Date();
                  etaLastNum = percentCompleted;
                } else if (etaLastNum + lap <= percentCompleted) {
                  let dateNow = new Date();
                  let dateDiff =
                    (Math.abs((dateNow.getTime() - etaLastDate.getTime()) / 1000) * (100 - percentCompleted)) / lap;

                  let minutes = Math.floor(dateDiff / 60);
                  let seconds = dateDiff % 60;
                  if (minutes > 0) {
                    if (seconds > 30) {
                      minutes++;
                    }
                    if (minutes === 1) {
                      etaStr = "~ " + minutes.toFixed(0) + " min";
                    } else {
                      etaStr = "~ " + minutes.toFixed(0) + " mins";
                    }
                  } else {
                    etaStr = "< 1 min";
                  }

                  etaLastDate = new Date();
                  etaLastNum = percentCompleted;
                  $("#opRunRemaining").html("time left " + etaStr);
                }
                //}
                $("#opRunPercent").html("Optimization Execution: " + percentCompleted.toFixed(0) + "%");

                if (completed === strategyVariations.length) {
                  if (opExecutionCanceled) {
                    return;
                  }
                  if (ft < ftmc) {
                    doftOfResult();
                  } else {
                    fillOptimizationResult(marketReturn);
                  }
                }
              } else {
                log("error", "opExecutionWorkers.EventListener error", e.data);
                openModalInfo("Unexpected Internal Error Occurred!<br>" + e.data);
              }
            } catch (err) {
              log("error", "runOptimize", err.stack);
              openModalInfo("Internal Error Occurred!<br>" + err.stack);
            } finally {
              executionOpMutex.release();
            }
          },
          false
        );
      }
      webWorkersInitialized = true;
    }

    for (let i = 0; i < maxOpWorkers; i++) {
      try {
        await opWorkerTerminateMutex.lock();
        if (opExecutionCanceled) {
          or = false;
          return;
        }
        opExecutionWorkers[i].postMessage(["INITIALIZE", i, timeframes, startDate, ticks, feeRate]);
        runningWorkiers++;
      } finally {
        opWorkerTerminateMutex.release();
      }
    }
  } catch (err) {
    log("error", "runOptimize", err.stack);
    $("#opRunning").hide();
    or = false;
    await terminateOpWorkers();
    openModalInfo("Internal Error Occurred!<br>" + err.stack);
  }
}

function countRuleFields(rule) {
  let fieldsToChange = 0;
  switch (rule.indicator) {
    case "sma":
    case "ema":
      if (rule.direction === "crossing") {
        fieldsToChange++;
      } else {
        fieldsToChange += 2;
      }
      break;
    case "cma":
      fieldsToChange += 2;
      break;
    case "rsi":
      fieldsToChange += 2;
      break;
    case "macd":
      if (rule.type === "signal line") {
        if (rule.direction === "crossing") {
          fieldsToChange += 3;
        } else {
          fieldsToChange += 4;
        }
      } else {
        fieldsToChange += 2;
      }
      break;
    case "bb":
      if (rule.direction === "crossing") {
        fieldsToChange += 2;
      } else {
        fieldsToChange += 3;
      }
      break;
    case "sto":
      fieldsToChange += 4;
      break;
    case "stoRsi":
      fieldsToChange += 5;
      break;
  }

  return fieldsToChange;
}

function calculateFieldsToChange(strategy) {
  let fieldsToChange = changeStoploss ? 1 : 0;
  if (changeTarget) {
    fieldsToChange++;
    if (useTrailingTarget) {
      fieldsToChange++;
    }
  }

  for (let rule of strategy.buyRules) {
    fieldsToChange += countRuleFields(rule);
  }
  for (let rule of strategy.sellRules) {
    fieldsToChange += countRuleFields(rule);
  }
  return fieldsToChange;
}

function rulesAreSame(rule1, rule2) {
  return (
    rule1.period == rule2.period &&
    rule1.period2 == rule2.period2 &&
    rule1.period3 == rule2.period3 &&
    rule1.value == rule2.value &&
    rule1.period4 == rule2.period4
  );
}

function pushNewStrategyVariation(variations, strategy) {
  for (let strategyTmp of variations) {
    let allBuyRulesAreSame = true;
    for (let i = 0; i < strategyTmp.buyRules.length; i++) {
      if (!rulesAreSame(strategyTmp.buyRules[i], strategy.buyRules[i])) {
        allBuyRulesAreSame = false;
        break;
      }
    }
    if (allBuyRulesAreSame) {
      let allSellRulesAreSame = true;
      for (let i = 0; i < strategyTmp.sellRules.length; i++) {
        if (!rulesAreSame(strategyTmp.sellRules[i], strategy.sellRules[i])) {
          allSellRulesAreSame = false;
          break;
        }
      }
      if (allSellRulesAreSame) {
        if (
          strategyTmp.stoploss == strategy.stoploss &&
          strategyTmp.trailingSl == strategy.trailingSl &&
          strategyTmp.target == strategy.target &&
          strategyTmp.ttarget == strategy.ttarget
        ) {
          return false;
        }
      }
    }
  }
  variations.push(strategy);
  return true;
}

async function getStrategyVariationsFromResult(strategiesToAdd) {
  let addedStrategies = 0;
  let result = [];
  let usedStrategies = [];
  let counter = 0;
  for (let strategyRes of strategyVariationsResults) {
    let pushedRes = pushNewStrategyVariation(usedStrategies, strategyRes.strategy);
    if (!pushedRes) {
      continue;
    }

    strategyVariationsIntermitBestResults.push(strategyRes);
    let strategyVariationsTmp = await getStrategyVariations(strategyRes.strategy, ft);

    for (let strategyTmp of strategyVariationsTmp) {
      result.push(strategyTmp);
      counter = await incrementCounterWithSleep(counter);
    }
    addedStrategies++;
    if (addedStrategies >= strategiesToAdd) {
      break;
    }
  }
  return result;
}

function compareStrategyResults(a, b) {
  let ratioA = null;
  let ratioB = null;
  //Max return for lowest risk
  if (optType === "riskReward") {
    ratioA = a.maxDrawdown != 0 ? a.totalReturn / Math.abs(a.maxDrawdown) : a.totalReturn;
    ratioB = b.maxDrawdown != 0 ? b.totalReturn / Math.abs(b.maxDrawdown) : b.totalReturn;
  } else if (optType === "return") {
    ratioA = a.totalReturn;
    ratioB = b.totalReturn;
  } else if (optType === "smooth") {
    //ratioA = a.totalReturn - (a.biggestGain-Math.abs(a.avgGainLossPerTrade));
    //ratioB = b.totalReturn - (b.biggestGain-Math.abs(b.avgGainLossPerTrade));
    let returnWithoutBestTradeA = a.totalReturn - (a.biggestGain - Math.abs(a.avgGainLossPerTrade));
    let returnWithoutBestTradeB = b.totalReturn - (b.biggestGain - Math.abs(b.avgGainLossPerTrade));

    let avgTradesCountA = a.executedTrades - 1;
    let avgTradesCountB = b.executedTrades - 1;

    let avgTradeWithoutBestTradeA = avgTradesCountA > 0 ? returnWithoutBestTradeA / avgTradesCountA : 0;
    let avgTradeWithoutBestTradeB = avgTradesCountB > 0 ? returnWithoutBestTradeB / avgTradesCountB : 0;

    let totalReturnToMaxDrawdownA =
      a.maxDrawdown != 0 ? returnWithoutBestTradeA / Math.abs(a.maxDrawdown) : returnWithoutBestTradeA;
    let totalReturnToMaxDrawdownB =
      b.maxDrawdown != 0 ? returnWithoutBestTradeB / Math.abs(b.maxDrawdown) : returnWithoutBestTradeB;

    ratioA =
      totalReturnToMaxDrawdownA < 0 && avgTradeWithoutBestTradeA < 0
        ? -1 * totalReturnToMaxDrawdownA * avgTradeWithoutBestTradeA
        : totalReturnToMaxDrawdownA * avgTradeWithoutBestTradeA;

    ratioB =
      totalReturnToMaxDrawdownB < 0 && avgTradeWithoutBestTradeB < 0
        ? -1 * totalReturnToMaxDrawdownB * avgTradeWithoutBestTradeB
        : totalReturnToMaxDrawdownB * avgTradeWithoutBestTradeB;
  }

  return ratioA < ratioB ? 1 : ratioB < ratioA ? -1 : 0;
}

async function doftOfResult() {
  try {
    if (strategyVariationsResults.length == 0) {
      ft = ftmc;
      fillOptimizationResult(marketReturn);
      return;
    }
    await terminateOpWorkers();
    strategyVariationsResults.sort(function(a, b) {
      return compareStrategyResults(a, b);
    });
    ft++;
    strategyVariations = [];
    opExecutedIndex = 0;
    opExecutionCanceled = false;
    opCompleted = 0;

    let strategiesToAdd = 10;
    strategyVariations = await getStrategyVariationsFromResult(strategiesToAdd);
    strategyVariationsTested += strategyVariations.length;

    if (strategyVariations.length == 0) {
      ft = ftmc;
      fillOptimizationResult(marketReturn);
      return;
    }
    strategyVariationsResults = [];
    for (let i = 0; i < maxOpWorkers; i++) {
      try {
        await opWorkerTerminateMutex.lock();
        if (opExecutionCanceled) {
          or = false;
          return;
        }
        opExecutionWorkers[i].postMessage(["INITIALIZE", i, timeframes, startDate, ticks, feeRate]);
        runningWorkiers++;
      } finally {
        opWorkerTerminateMutex.release();
      }
    }
  } catch (err) {
    or = false;
    $("#runOptBtn").removeClass("disabled");
    $("#opCancelBtn").removeClass("disabled");
    log("error", "doftOfResult", err.stack);
  }
}

function createRuleVariation(rule, period, value, crossDirection, type2, period2, period3, period4) {
  let newRule = {};
  newRule.indicator = rule.indicator;
  newRule.timeframe = rule.timeframe;
  newRule.direction = rule.direction;
  newRule.type = rule.type;
  newRule.crossDirection = rule.crossDirection;
  newRule.period = period;
  if (value != undefined && value != null) {
    newRule.value = value;
  }
  if (crossDirection != undefined && crossDirection != null) {
    newRule.crossDirection = crossDirection;
  }
  if (type2 != undefined && type2 != null) {
    newRule.type2 = type2;
  }
  if (period2 != undefined && period2 != null) {
    newRule.period2 = period2;
  }
  if (period3 != undefined && period3 != null) {
    newRule.period3 = period3;
  }
  if (period4 != undefined && period4 != null) {
    newRule.period4 = period4;
  }

  return newRule;
}

function getRuleVariations(rule) {
  let ruleVariations = [];
  if (rule.indicator === "sma" || rule.indicator === "ema") {
    if (rule.direction !== "crossing") {
      for (let period of mp) {
        for (let value of vm) {
          ruleVariations.push(createRuleVariation(rule, period, value));
        }
      }
    } else {
      for (let period of mp) {
        ruleVariations.push(createRuleVariation(rule, period, null));
      }
    }
  } else if (rule.indicator === "cma") {
    for (let period of mp) {
      for (let period2 of mp) {
        if (period >= period2) {
          continue;
        }
        ruleVariations.push(createRuleVariation(rule, period, null, rule.crossDirection, rule.type2, period2));
      }
    }
  } else if (rule.indicator === "rsi") {
    for (let period of rp) {
      for (let value of rv) {
        ruleVariations.push(createRuleVariation(rule, period, value));
      }
    }
  } else if (rule.indicator === "macd") {
    if (rule.type === "signal line") {
      if (rule.direction !== "crossing") {
        for (let period of mdp) {
          for (let period2 of mdp2) {
            if (period >= period2) {
              continue;
            }
            for (let period3 of mdp3) {
              for (let value of mdpv) {
                ruleVariations.push(createRuleVariation(rule, period, value, null, null, period2, period3));
              }
            }
          }
        }
      } else {
        for (let period of mdp) {
          for (let period2 of mdp2) {
            if (period >= period2) {
              continue;
            }
            for (let period3 of mdp3) {
              ruleVariations.push(createRuleVariation(rule, period, null, rule.crossDirection, null, period2, period3));
            }
          }
        }
      }
    } else {
      for (let period of mdp) {
        for (let period2 of mdp2) {
          if (period >= period2) {
            continue;
          }
          ruleVariations.push(createRuleVariation(rule, period, null, rule.crossDirection, null, period2, null));
        }
      }
    }
  } else if (rule.indicator === "bb") {
    if (rule.direction !== "crossing") {
      for (let period of bp) {
        for (let period2 of bp2) {
          for (let value of bv) {
            ruleVariations.push(createRuleVariation(rule, period, value, null, null, period2, null));
          }
        }
      }
    } else {
      for (let period of bp) {
        for (let period2 of bp2) {
          ruleVariations.push(createRuleVariation(rule, period, null, rule.crossDirection, null, period2, null));
        }
      }
    }
  } else if (rule.indicator === "sto") {
    for (let period of sp) {
      for (let period2 of sp2) {
        for (let period3 of sp3) {
          for (let value of sv) {
            ruleVariations.push(createRuleVariation(rule, period, value, rule.crossDirection, null, period2, period3));
          }
        }
      }
    }
  } else if (rule.indicator === "stoRsi") {
    for (let period of sp) {
      for (let period2 of sp2) {
        for (let period3 of sp3) {
          for (let period4 of sp4) {
            for (let value of sv) {
              ruleVariations.push(
                createRuleVariation(rule, period, value, rule.crossDirection, null, period2, period3, period4)
              );
            }
          }
        }
      }
    }
  }

  return ruleVariations;
}

let ftmc = 3;

let mp = [];
let vm = [];

let rp = [];
let rv = [];

let mdp = [];
let mdp2 = [];
let mdp3 = [];
let mdpv = [];

let bp = [];
let bp2 = [];
let bv = [];

let sp = [];
let sp2 = [];
let sp3 = [];
let sp4 = [];
let sv = [];

//Fina tune values

let mpft = [];
let vmft = [];
let mpft1 = [];
let vmft1 = [];
let mpft2 = [];
let vmft2 = [];
let mpft3 = [];
let vmft3 = [];
let mpft4 = [];
let vmft4 = [];
let mpft5 = [];
let vmft5 = [];
let mpft6 = [];
let vmft6 = [];

let rpft = [];
let rvft = [];
let rpft1 = [];
let rvft1 = [];
let rpft2 = [];
let rvft2 = [];
let rpft3 = [];
let rvft3 = [];
let rpft4 = [];
let rvft4 = [];
let rpft5 = [];
let rvft5 = [];
let rpft6 = [];
let rvft6 = [];

let mdpft = [];
let mdp2ft = [];
let mdp3ft = [];
let mdpvft = [];
let mdpft1 = [];
let mdp2ft1 = [];
let mdp3ft1 = [];
let mdpvft1 = [];
let mdpft2 = [];
let mdp2ft2 = [];
let mdp3ft2 = [];
let mdpvft2 = [];
let mdpft3 = [];
let mdp2ft3 = [];
let mdp3ft3 = [];
let mdpvft3 = [];
let mdpft4 = [];
let mdp2ft4 = [];
let mdp3ft4 = [];
let mdpvft4 = [];
let mdpft5 = [];
let mdp2ft5 = [];
let mdp3ft5 = [];
let mdpvft5 = [];
let mdpft6 = [];
let mdp2ft6 = [];
let mdp3ft6 = [];
let mdpvft6 = [];

let bpft = [];
let bp2ft = [];
let bvft = [];
let bpft1 = [];
let bp2ft1 = [];
let bvft1 = [];
let bpft2 = [];
let bp2ft2 = [];
let bvft2 = [];
let bpft3 = [];
let bp2ft3 = [];
let bvft3 = [];
let bpft4 = [];
let bp2ft4 = [];
let bvft4 = [];
let bpft5 = [];
let bp2ft5 = [];
let bvft5 = [];
let bpft6 = [];
let bp2ft6 = [];
let bvft6 = [];

let spft = [];
let sp2ft = [];
let sp3ft = [];
let sp4ft = [];
let svft = [];
let spft1 = [];
let spft2 = [];
let spft3 = [];
let spft4 = [];
let spft5 = [];
let spft6 = [];
let sp2ft1 = [];
let sp2ft2 = [];
let sp2ft3 = [];
let sp2ft4 = [];
let sp2ft5 = [];
let sp2ft6 = [];
let sp3ft1 = [];
let sp3ft2 = [];
let sp3ft3 = [];
let sp3ft4 = [];
let sp3ft5 = [];
let sp3ft6 = [];
let sp4ft1 = [];
let sp4ft2 = [];
let sp4ft3 = [];
let sp4ft4 = [];
let sp4ft5 = [];
let sp4ft6 = [];
let svft1 = [];
let svft2 = [];
let svft3 = [];
let svft4 = [];
let svft5 = [];
let svft6 = [];

let stoplossesft0 = [2, 4.5, 7];
let stoplossesft1 = [-0.5, 0.5];
let stoplossesft2 = [-0.25, 0.25];
let stoplossesft3 = [-0.25, 0.25];
let stoplossesft4 = [-0.25, 0.25];
let stoplossesft5 = [-0.15, 0.15];
let stoplossesft6 = [-0.1, 0.1];

let targetsft0 = [2, 4.5, 7];
let targetsft1 = [-0.5, 0.5];
let targetsft2 = [-0.25, 0.25];
let targetsft3 = [-0.25, 0.25];
let targetsft4 = [-0.25, 0.25];
let targetsft5 = [-0.15, 0.15];
let targetsft6 = [-0.1, 0.1];

let ttargetsft0 = [2, 4.5, 7];
let ttargetsft1 = [-0.5, 0.5];
let ttargetsft2 = [-0.25, 0.25];
let ttargetsft3 = [-0.25, 0.25];
let ttargetsft4 = [-0.25, 0.25];
let ttargetsft5 = [-0.15, 0.15];
let ttargetsft6 = [-0.1, 0.1];

function getRuleVariationsft(rule) {
  let ruleVariations = [];

  if (rule.indicator === "sma" || rule.indicator === "ema") {
    if (rule.direction !== "crossing") {
      for (let period of mpft) {
        let periodToUse = rule.period + period;
        if (periodToUse < 2) {
          continue;
        }
        for (let value of vmft) {
          let valueToUse = rule.value + value;
          if (valueToUse <= 0) {
            valueToUse = 0.1;
          }
          ruleVariations.push(createRuleVariation(rule, periodToUse, fixNumber(valueToUse, 2)));
        }
      }
    } else {
      for (let period of mpft) {
        let periodToUse = rule.period + period;
        if (periodToUse < 2) {
          continue;
        }
        ruleVariations.push(createRuleVariation(rule, periodToUse, null));
      }
    }
  } else if (rule.indicator === "cma") {
    for (let period of mpft) {
      let periodToUse = rule.period + period;
      if (periodToUse < 2) {
        continue;
      }
      for (let period2 of mpft) {
        let periodToUse2 = rule.period2 + period2;
        if (periodToUse >= periodToUse2) {
          continue;
        }
        ruleVariations.push(
          createRuleVariation(rule, periodToUse, null, rule.crossDirection, rule.type2, periodToUse2)
        );
      }
    }
  } else if (rule.indicator === "rsi") {
    for (let period of rpft) {
      let periodToUse = rule.period + period;
      if (periodToUse < 2) {
        continue;
      }
      for (let value of rvft) {
        let valueToUse = rule.value + value;
        if (valueToUse <= 0) {
          valueToUse = 1;
        } else if (valueToUse >= 100) {
          valueToUse = 99;
        }
        ruleVariations.push(createRuleVariation(rule, periodToUse, fixNumber(valueToUse, 2)));
      }
    }
  } else if (rule.indicator === "macd") {
    if (rule.type === "signal line") {
      if (rule.direction !== "crossing") {
        for (let period of mdpft) {
          for (let period2 of mdp2ft) {
            let periodToUse = rule.period + period;
            let periodToUse2 = rule.period2 + period2;
            if (periodToUse >= periodToUse2 || periodToUse < 2) {
              continue;
            }
            for (let period3 of mdp3ft) {
              let periodToUse3 = rule.period3 + period3;
              if (periodToUse3 < 2) {
                continue;
              }
              for (let value of mdpvft) {
                let valueToUse = rule.value + value;
                if (valueToUse <= 0) {
                  valueToUse = 0.1;
                }
                ruleVariations.push(
                  createRuleVariation(
                    rule,
                    periodToUse,
                    fixNumber(valueToUse, 2),
                    null,
                    null,
                    periodToUse2,
                    periodToUse3
                  )
                );
              }
            }
          }
        }
      } else {
        for (let period of mdpft) {
          for (let period2 of mdp2ft) {
            let periodToUse = rule.period + period;
            let periodToUse2 = rule.period2 + period2;
            if (periodToUse >= periodToUse2 || periodToUse < 2) {
              continue;
            }
            for (let period3 of mdp3ft) {
              let periodToUse3 = rule.period3 + period3;
              if (periodToUse3 < 2) {
                continue;
              }
              ruleVariations.push(
                createRuleVariation(rule, periodToUse, null, rule.crossDirection, null, periodToUse2, periodToUse3)
              );
            }
          }
        }
      }
    } else {
      for (let period of mdpft) {
        for (let period2 of mdp2ft) {
          let periodToUse = rule.period + period;
          let periodToUse2 = rule.period2 + period2;
          if (periodToUse >= periodToUse2 || periodToUse < 2) {
            continue;
          }
          ruleVariations.push(
            createRuleVariation(rule, periodToUse, null, rule.crossDirection, null, periodToUse2, null)
          );
        }
      }
    }
  } else if (rule.indicator === "bb") {
    if (rule.direction !== "crossing") {
      for (let period of bpft) {
        let periodToUse = rule.period + period;
        if (periodToUse < 2) {
          continue;
        }
        for (let period2 of bp2ft) {
          let periodToUse2 = rule.period2 + period2;
          if (periodToUse2 <= 0) {
            continue;
          }
          for (let value of bvft) {
            let valueToUse = rule.value + value;
            if (valueToUse <= 0) {
              valueToUse = 0.1;
            }
            ruleVariations.push(
              createRuleVariation(rule, periodToUse, fixNumber(valueToUse, 2), null, null, periodToUse2, null)
            );
          }
        }
      }
    } else {
      for (let period of bpft) {
        let periodToUse = rule.period + period;
        if (periodToUse < 2) {
          continue;
        }
        for (let period2 of bp2ft) {
          let periodToUse2 = rule.period2 + period2;
          if (periodToUse2 <= 0) {
            continue;
          }
          ruleVariations.push(
            createRuleVariation(rule, periodToUse, null, rule.crossDirection, null, periodToUse2, null)
          );
        }
      }
    }
  } else if (rule.indicator === "sto") {
    for (let period of spft) {
      let periodToUse = rule.period + period;
      if (periodToUse < 2) {
        continue;
      }
      for (let period2 of sp2ft) {
        let periodToUse2 = rule.period2 + period2;
        if (periodToUse2 <= 0) {
          continue;
        }
        for (let period3 of sp3ft) {
          let periodToUse3 = rule.period3 + period3;
          if (periodToUse3 <= 0) {
            continue;
          }
          for (let value of svft) {
            let valueToUse = rule.value + value;
            if (valueToUse <= 0) {
              valueToUse = 1;
            } else if (valueToUse >= 100) {
              valueToUse = 99;
            }
            ruleVariations.push(
              createRuleVariation(
                rule,
                periodToUse,
                fixNumber(valueToUse, 2),
                rule.crossDirection,
                null,
                periodToUse2,
                periodToUse3
              )
            );
          }
        }
      }
    }
  } else if (rule.indicator === "stoRsi") {
    for (let period of spft) {
      let periodToUse = rule.period + period;
      if (periodToUse < 2) {
        continue;
      }
      for (let period2 of sp2ft) {
        let periodToUse2 = rule.period2 + period2;
        if (periodToUse2 <= 0) {
          continue;
        }
        for (let period3 of sp3ft) {
          let periodToUse3 = rule.period3 + period3;
          if (periodToUse3 <= 0) {
            continue;
          }
          for (let period4 of sp4ft) {
            let periodToUse4 = rule.period4 + period4;
            if (periodToUse4 < 2) {
              continue;
            }
            for (let value of svft) {
              let valueToUse = rule.value + value;
              if (valueToUse <= 0) {
                valueToUse = 1;
              } else if (valueToUse >= 100) {
                valueToUse = 99;
              }
              ruleVariations.push(
                createRuleVariation(
                  rule,
                  periodToUse,
                  fixNumber(valueToUse, 2),
                  rule.crossDirection,
                  null,
                  periodToUse2,
                  periodToUse3,
                  periodToUse4
                )
              );
            }
          }
        }
      }
    }
  }

  return ruleVariations;
}

function getRulesVariations(rules, ft) {
  if (rules == null || rules == undefined || rules.length === 0) {
    return [];
  }

  let rulesVariations = [];

  for (let rule of rules) {
    let ruleVariations = null;
    switch (ft) {
      case 0:
        ruleVariations = getRuleVariations(rule);
        break;
      case 1:
        mpft = mpft1;
        vmft = vmft1;
        rpft = rpft1;
        rvft = rvft1;
        mdpft = mdpft1;
        mdp2ft = mdp2ft1;
        mdp3ft = mdp3ft1;
        mdpvft = mdpvft1;
        bpft = bpft1;
        bp2ft = bp2ft1;
        bvft = bvft1;
        spft = spft1;
        sp2ft = sp2ft1;
        sp3ft = sp3ft1;
        sp4ft = sp4ft1;
        svft = svft1;
        ruleVariations = getRuleVariationsft(rule);
        break;
      case 2:
        mpft = mpft2;
        vmft = vmft2;
        rpft = rpft2;
        rvft = rvft2;
        mdpft = mdpft2;
        mdp2ft = mdp2ft2;
        mdp3ft = mdp3ft2;
        mdpvft = mdpvft2;
        bpft = bpft2;
        bp2ft = bp2ft2;
        bvft = bvft2;
        spft = spft2;
        sp2ft = sp2ft2;
        sp3ft = sp3ft2;
        sp4ft = sp4ft2;
        svft = svft2;
        ruleVariations = getRuleVariationsft(rule);
        break;
      case 3:
        mpft = mpft3;
        vmft = vmft3;
        rpft = rpft3;
        rvft = rvft3;
        mdpft = mdpft3;
        mdp2ft = mdp2ft3;
        mdp3ft = mdp3ft3;
        mdpvft = mdpvft3;
        bpft = bpft3;
        bp2ft = bp2ft3;
        bvft = bvft3;
        spft = spft3;
        sp2ft = sp2ft3;
        sp3ft = sp3ft3;
        sp4ft = sp4ft3;
        svft = svft3;
        ruleVariations = getRuleVariationsft(rule);
        break;
      case 4:
        mpft = mpft4;
        vmft = vmft4;
        rpft = rpft4;
        rvft = rvft4;
        mdpft = mdpft4;
        mdp2ft = mdp2ft4;
        mdp3ft = mdp3ft4;
        mdpvft = mdpvft4;
        bpft = bpft4;
        bp2ft = bp2ft4;
        bvft = bvft4;
        spft = spft4;
        sp2ft = sp2ft4;
        sp3ft = sp3ft4;
        sp4ft = sp4ft4;
        svft = svft4;
        ruleVariations = getRuleVariationsft(rule);
        break;
      case 5:
        mpft = mpft5;
        vmft = vmft5;
        rpft = rpft5;
        rvft = rvft5;
        mdpft = mdpft5;
        mdp2ft = mdp2ft5;
        mdp3ft = mdp3ft5;
        mdpvft = mdpvft5;
        bpft = bpft5;
        bp2ft = bp2ft5;
        bvft = bvft5;
        spft = spft5;
        sp2ft = sp2ft5;
        sp3ft = sp3ft5;
        sp4ft = sp4ft5;
        svft = svft5;
        ruleVariations = getRuleVariationsft(rule);
        break;
      case 6:
        mpft = mpft6;
        vmft = vmft6;
        rpft = rpft6;
        rvft = rvft6;
        mdpft = mdpft6;
        mdp2ft = mdp2ft6;
        mdp3ft = mdp3ft6;
        mdpvft = mdpvft6;
        bpft = bpft6;
        bp2ft = bp2ft6;
        bvft = bvft6;
        spft = spft6;
        sp2ft = sp2ft6;
        sp3ft = sp3ft6;
        sp4ft = sp4ft6;
        svft = svft6;
        ruleVariations = getRuleVariationsft(rule);
        break;
      default:
        ruleVariations = getRuleVariations(rule);
        break;
    }
    rulesVariations.push(ruleVariations);
  }
  return rulesVariations;
}

function createStrategyVariationWithBuyRules(strategy, buyRules) {
  let newStrategy = {};
  newStrategy.name = strategyNameToUse;
  newStrategy.timeClose = strategy.timeClose;
  newStrategy.buyRules = [];
  newStrategy.sellRules = [];
  for (let buyRule of buyRules) {
    newStrategy.buyRules.push(buyRule);
  }
  newStrategy.stoploss = strategy.stoploss;
  newStrategy.trailingSl = strategy.trailingSl;
  newStrategy.target = strategy.target;
  newStrategy.ttarget = strategy.ttarget;
  return newStrategy;
}

function createStrategyVariationWithStoplossRules(finalStrategiesList, strategiesWithBuySellOnly, ft) {
  let stoplosses = [];
  if (changeStoplossFine) {
    switch (ft) {
      case 0:
        stoplosses = [2];
        break;
      case 1:
        stoplosses = [3];
        break;
      case 2:
        stoplosses = [1];
        break;
      case 3:
        stoplosses = [1];
        break;
      case 4:
        stoplosses = [1];
        break;
      case 5:
        stoplosses = [1];
        break;
    }
  } else {
    switch (ft) {
      case 0:
        stoplosses = stoplossesft0;
        break;
      case 1:
        stoplosses = stoplossesft1;
        break;
      case 2:
        stoplosses = stoplossesft2;
        break;
      case 3:
        stoplosses = stoplossesft3;
        break;
      case 4:
        stoplosses = stoplossesft4;
        break;
      case 5:
        stoplosses = stoplossesft5;
        break;
      case 6:
        stoplosses = stoplossesft6;
        break;
      default:
        break;
    }
  }

  for (let stoploss of stoplosses) {
    for (let strategy of strategiesWithBuySellOnly) {
      let ns = {};
      ns.name = strategy.name;
      ns.timeClose = strategy.timeClose;
      ns.buyRules = [];
      ns.sellRules = [];
      for (let buyRule of strategy.buyRules) {
        ns.buyRules.push(buyRule);
      }
      for (let sellRule of strategy.sellRules) {
        ns.sellRules.push(sellRule);
      }
      if (ft > 0 || changeStoplossFine) {
        if (useTrailingStop) {
          ns.trailingSl = fixNumber(strategy.trailingSl + stoploss, 2);
        } else {
          ns.stoploss = fixNumber(strategy.stoploss + stoploss, 2);
        }
        ns.target = strategy.target;
        ns.ttarget = strategy.ttarget;
      } else {
        if (useTrailingStop) {
          ns.trailingSl = stoploss;
        } else {
          ns.stoploss = stoploss;
        }
      }
      ns.target = null;
      ns.ttarget = null;
      finalStrategiesList.push(ns);
    }
  }
  return finalStrategiesList;
}

function createStrategyVariationWithSellRules(finalStrategiesList, strategiesWithBuyOnly, sellRules) {
  for (let strategy of strategiesWithBuyOnly) {
    let newStrategy = {};
    newStrategy.name = strategy.name;
    newStrategy.timeClose = strategy.timeClose;
    newStrategy.buyRules = [];
    newStrategy.sellRules = [];
    for (let buyRule of strategy.buyRules) {
      newStrategy.buyRules.push(buyRule);
    }
    for (let sellRule of sellRules) {
      newStrategy.sellRules.push(sellRule);
    }
    newStrategy.ttarget = strategy.ttarget;
    newStrategy.trailingSl = strategy.trailingSl;
    newStrategy.target = null;
    newStrategy.stoploss = null;
    finalStrategiesList.push(newStrategy);
  }
}

function createStrategyVariationWithTargetRules(finalStrategiesList, strategiesWithBuySellOnly, ft) {
  let targets = [];
  let ttargets = [];
  if (changeTargetFine) {
    switch (ft) {
      case 0:
        targets = [5];
        ttargets = [-0.7, 0, 0.7];
        break;
      case 1:
        targets = [1];
        ttargets = [-0.4, 0.4];
        break;
      case 2:
        targets = [1];
        ttargets = [-0.2, 0.2];
        break;
      case 3:
        targets = [1];
        ttargets = [-0.15, 0.15];
        break;
      case 4:
        targets = [1];
        ttargets = [-0.03, 0.03];
        break;
      case 5:
        targets = [1];
        ttargets = [-0.01, 0.01];
        break;
    }
  } else {
    switch (ft) {
      case 0:
        targets = targetsft0;
        ttargets = ttargetsft0;
        break;
      case 1:
        targets = targetsft1;
        ttargets = ttargetsft1;
        break;
      case 2:
        targets = targetsft2;
        ttargets = ttargetsft2;
        break;
      case 3:
        targets = targetsft3;
        ttargets = ttargetsft3;
        break;
      case 4:
        targets = targetsft4;
        ttargets = ttargetsft4;
        break;
      case 5:
        targets = targetsft5;
        ttargets = ttargetsft5;
        break;
      case 6:
        targets = targetsft6;
        ttargets = ttargetsft6;
        break;
      default:
        break;
    }
  }
  for (let target of targets) {
    for (let strategy of strategiesWithBuySellOnly) {
      if (useTrailingTarget) {
        for (let ttarget of ttargets) {
          let newStrategy = createStrategyWithTarget(target, ttarget, strategy, ft);
          if (newStrategy != null) {
            finalStrategiesList.push(newStrategy);
          }
        }
      } else {
        let newStrategy = createStrategyWithTarget(target, null, strategy, ft);
        finalStrategiesList.push(newStrategy);
      }
    }
  }
  return finalStrategiesList;
}

function createStrategyWithTarget(target, ttarget, strategy, ft) {
  let newStrategy = {};
  newStrategy.name = strategy.name;
  newStrategy.timeClose = strategy.timeClose;
  newStrategy.buyRules = [];
  newStrategy.sellRules = [];
  for (let buyRule of strategy.buyRules) {
    newStrategy.buyRules.push(buyRule);
  }
  for (let sellRule of strategy.sellRules) {
    newStrategy.sellRules.push(sellRule);
  }
  if (useTrailingStop) {
    newStrategy.trailingSl = strategy.trailingSl;
  } else {
    newStrategy.stoploss = strategy.stoploss;
  }
  if (ft > 0 || changeTargetFine) {
    newStrategy.target = fixNumber(strategy.target + target, 2);
    if (ttarget != null) {
      newStrategy.ttarget = fixNumber(strategy.ttarget + ttarget, 2);
    }
  } else {
    newStrategy.target = target;
    if (ttarget != null) {
      newStrategy.ttarget = ttarget;
    }
  }
  if (ttarget != null && (newStrategy.ttarget > newStrategy.target || newStrategy.ttarget <= 0)) {
    newStrategy = null;
  }
  return newStrategy;
}

async function incrementCounterWithSleep(counter) {
  if (counter > 500 && counter % 500 == 0) {
    await sleep(0);
  }
  return counter + 1;
}

async function getStrategyVariations(strategy, ft) {
  try {
    let buyRulesVariations = getRulesVariations(strategy.buyRules, ft);
    let sellRulesVariations = getRulesVariations(strategy.sellRules, ft);
    let strategiesWithBuyRuleVariations = [];
    let strategiesWithBuySellRuleVariations = [];
    let counter = 0;
    for (let ruleVariations of buyRulesVariations[0]) {
      if (buyRulesVariations.length > 1) {
        for (let rule2Variations of buyRulesVariations[1]) {
          if (buyRulesVariations.length > 2) {
            for (let rule3Variations of buyRulesVariations[2]) {
              if (buyRulesVariations.length > 3) {
                for (let rule4Variations of buyRulesVariations[3]) {
                  if (buyRulesVariations.length > 4) {
                    for (let rule5Variations of buyRulesVariations[4]) {
                      counter = await incrementCounterWithSleep(counter);
                      strategiesWithBuyRuleVariations.push(
                        createStrategyVariationWithBuyRules(strategy, [
                          ruleVariations,
                          rule2Variations,
                          rule3Variations,
                          rule4Variations,
                          rule5Variations
                        ])
                      );
                    }
                  } else {
                    counter = await incrementCounterWithSleep(counter);
                    strategiesWithBuyRuleVariations.push(
                      createStrategyVariationWithBuyRules(strategy, [
                        ruleVariations,
                        rule2Variations,
                        rule3Variations,
                        rule4Variations
                      ])
                    );
                  }
                }
              } else {
                counter = await incrementCounterWithSleep(counter);
                strategiesWithBuyRuleVariations.push(
                  createStrategyVariationWithBuyRules(strategy, [ruleVariations, rule2Variations, rule3Variations])
                );
              }
            }
          } else {
            counter = await incrementCounterWithSleep(counter);
            strategiesWithBuyRuleVariations.push(
              createStrategyVariationWithBuyRules(strategy, [ruleVariations, rule2Variations])
            );
          }
        }
      } else {
        counter = await incrementCounterWithSleep(counter);
        strategiesWithBuyRuleVariations.push(createStrategyVariationWithBuyRules(strategy, [ruleVariations]));
      }
    }
    if (sellRulesVariations.length !== 0) {
      for (let ruleVariations of sellRulesVariations[0]) {
        if (sellRulesVariations.length > 1) {
          for (let rule2Variations of sellRulesVariations[1]) {
            if (sellRulesVariations.length > 2) {
              for (let rule3Variations of sellRulesVariations[2]) {
                if (sellRulesVariations.length > 3) {
                  for (let rule4Variations of sellRulesVariations[3]) {
                    counter = await incrementCounterWithSleep(counter);
                    createStrategyVariationWithSellRules(
                      strategiesWithBuySellRuleVariations,
                      strategiesWithBuyRuleVariations,
                      [ruleVariations, rule2Variations, rule3Variations, rule4Variations]
                    );
                  }
                } else {
                  counter = await incrementCounterWithSleep(counter);
                  createStrategyVariationWithSellRules(
                    strategiesWithBuySellRuleVariations,
                    strategiesWithBuyRuleVariations,
                    [ruleVariations, rule2Variations, rule3Variations]
                  );
                  break;
                }
              }
            } else {
              counter = await incrementCounterWithSleep(counter);
              createStrategyVariationWithSellRules(
                strategiesWithBuySellRuleVariations,
                strategiesWithBuyRuleVariations,
                [ruleVariations, rule2Variations]
              );
              break;
            }
          }
        } else {
          counter = await incrementCounterWithSleep(counter);
          createStrategyVariationWithSellRules(strategiesWithBuySellRuleVariations, strategiesWithBuyRuleVariations, [
            ruleVariations
          ]);
          break;
        }
      }
    } else {
      strategiesWithBuySellRuleVariations = strategiesWithBuyRuleVariations;
    }

    if (changeStoploss) {
      let strategiesWithBuySellAndStoplossRuleVariations = [];
      createStrategyVariationWithStoplossRules(
        strategiesWithBuySellAndStoplossRuleVariations,
        strategiesWithBuySellRuleVariations,
        ft
      );
      strategiesWithBuySellRuleVariations = strategiesWithBuySellAndStoplossRuleVariations;
    }

    if (changeTarget) {
      let strategiesWithBuySellAndTargetsRuleVariations = [];
      createStrategyVariationWithTargetRules(
        strategiesWithBuySellAndTargetsRuleVariations,
        strategiesWithBuySellRuleVariations,
        ft
      );
      strategiesWithBuySellRuleVariations = strategiesWithBuySellAndTargetsRuleVariations;
    }

    return strategiesWithBuySellRuleVariations;
  } catch (err) {
    log("error", "getStrategyVariations", err.stack);
  }
}

function opResultShowRows(from, to) {
  $("#opStrategiesTable").html(
    "<thead><tr><td>Strategy</td><td>Total Return</td><td>Max Drawdown</td><td>Winning %</td><td>Avg. Trade</td><td>Best Trade</td><td>Worst Trade</td><td>Trades N.</td><td>Save</td></tr></thead><tbody>"
  );
  for (let i = from; i < Math.min(strategyVariationsResults.length, to); i++) {
    let res = strategyVariationsResults[i];
    let classes = "";
    let resultClass = "";
    if (res.totalReturn > 0) {
      classes = "text-green fas fa-thumbs-up";
      resultClass = "text-green";
    } else if (res.totalReturn < 0) {
      classes = "text-red fas fa-thumbs-down";
      resultClass = "text-red";
    }

    let maxDdClass = res.maxDrawdown < 0 ? "text-red" : "";
    let winningClass = res.winningPercent >= 50 ? "text-green" : "text-red";
    let avgGainLossPerTradeClass =
      res.avgGainLossPerTrade > 0 ? "text-green" : res.avgGainLossPerTrade < 0 ? "text-red" : "";
    $("#opStrategiesTable").append(
      "<tr><td>" +
        (i + 1) +
        '&nbsp;<i class="' +
        classes +
        '"></td><td class="' +
        resultClass +
        '">' +
        res.totalReturn.toFixed(2) +
        '%</td><td class="' +
        maxDdClass +
        '">' +
        res.maxDrawdown.toFixed(2) +
        '%</td><td class="' +
        winningClass +
        '">' +
        res.winningPercent.toFixed(2) +
        '%</td><td class="' +
        avgGainLossPerTradeClass +
        '">' +
        res.avgGainLossPerTrade.toFixed(2) +
        '%</td><td class="text-green">' +
        res.biggestGain.toFixed(2) +
        '%</td><td class="text-red">' +
        res.biggestLost.toFixed(2) +
        "%</td><td>" +
        res.executedTrades +
        '</td><td><a  href="#/" onclick="openOpStrategy(' +
        i +
        ')"><i class="fas fa-save"></i></a></td></tr>'
    );
  }
  $("#opStrategiesTable").append("</tbody>");
}

async function terminateOpWorkers() {
  try {
    await opWorkerTerminateMutex.lock();
    opExecutionCanceled = true;
    for (let i = 0; i < maxOpWorkers; i++) {
      if (opExecutionWorkers[i] !== undefined) {
        opExecutionWorkers[i].postMessage(["STOP"]);
      }
    }
    while (runningWorkiers > 0) {
      await sleep(500);
    }
    if (ft >= ftmc) {
      or = false;
      $("#runOptBtn").removeClass("disabled");
      $("#opCancelBtn").removeClass("disabled");
    }
  } catch (err) {
    log("error", "terminateOpWorkers", err.stack);
  } finally {
    opWorkerTerminateMutex.release();
  }
}

function setrvp(strategy) {
  rp = [7, 14];
  rpft1 = [-4, 4];
  rpft2 = [-4, 4];
  rpft3 = [3];
  rpft4 = [3];
  rpft5 = [3];
  rpft6 = [3];
  rv = [50];
  rvft1 = [-10, 10];
  rvft2 = [5];
  rvft3 = [5];
  rvft4 = [5];
  rvft5 = [5];
  rvft6 = [5];
  mdp = [15, 24];
  mdpft1 = [-3, 3];
  mdpft2 = [4];
  mdpft3 = [4];
  mdpft4 = [4];
  mdpft5 = [4];
  bvft1 = [0.5];
  bvft2 = [0.5];
  bvft3 = [0.25];
  bvft4 = [0.25];
  bvft5 = [0.25];
  bvft6 = [0.25];
  sp = [14];
  spft1 = [4];
  spft2 = [3];
  spft3 = [3];
  spft4 = [3];
  spft5 = [2];
  spft6 = [1];
  sp2 = [8];
  sp2ft1 = [1];
  sp2ft2 = [1];
  sp2ft3 = [1];
  sp2ft4 = [1];
  mdpft6 = [4];
  mdp2 = [19, 28];
  mdp2ft1 = [4];
  mdp2ft2 = [4];
  mdp2ft3 = [4];
  mdp2ft4 = [4];
  mdp2ft5 = [4];
  mdp2ft6 = [4];
  mdp3 = [14];
  mdp3ft1 = [2];
  mdp3ft2 = [2];
  mdp3ft3 = [2];
  mdp3ft4 = [2];
  mdp3ft5 = [2];
  mdp3ft6 = [2];
  mdpv = [3];
  mdpvft1 = [0.5];
  mdpvft2 = [0.5];
  mdpvft3 = [0.5];
  mdpvft4 = [0.25];
  mdpvft5 = [0];
  mdpvft6 = [0];
  bp = [29, 48];
  bpft1 = [-4, 4];
  bpft2 = [3];

  mp = [10, 29, 48];
  mpft1 = [-5, 5];
  mpft2 = [-5, 5];
  mpft3 = [-5, 5];
  mpft4 = [-5, 5];
  mpft5 = [-5, 5];
  mpft6 = [-5, 5];
  vm = [1];
  vmft1 = [0.5];
  vmft2 = [0.5];
  vmft3 = [0.5];
  vmft4 = [0.25];
  vmft5 = [0.25];
  vmft6 = [0.25];
  bpft3 = [2];
  bpft4 = [1];
  bpft5 = [2];
  bpft6 = [1];
  bp2 = [1, 3];
  ftmc = 3;
  bp2ft1 = [0.5];
  bp2ft2 = [0.25];
  bp2ft3 = [0.25];
  bp2ft4 = [0.25];
  bp2ft5 = [0.25];
  bp2ft6 = [0.25];
  bv = [3];
  bvft1 = [0.5];
  bvft2 = [0.5];
  bvft3 = [0.25];
  bvft4 = [0.25];
  bvft5 = [0.25];
  bvft6 = [0.25];
  sp = [14];
  spft1 = [4];
  spft2 = [3];
  spft3 = [3];
  spft4 = [3];
  spft5 = [2];
  spft6 = [1];
  sp2 = [8];
  sp2ft1 = [1];
  sp2ft2 = [1];
  sp2ft3 = [1];
  sp2ft4 = [1];
  sp2ft5 = [1];
  sp2ft6 = [1];
  sp3 = [8];
  sp3ft1 = [1];
  sp3ft2 = [1];
  sp3ft3 = [1];
  sp3ft4 = [1];
  sp3ft5 = [-1];
  sp3ft6 = [1];
  sp4 = [7, 14];
  sp4ft1 = [-4, 4];
  sp4ft2 = [-3, 3];
  sp4ft3 = [-3, 3];
  sp4ft4 = [-3, 3];
  sp4ft5 = [-2, 2];
  sp4ft6 = [-1, 1];
  sv = [30, 70];
  svft1 = [-10, 10];
  svft2 = [-5, 5];
  svft3 = [-4, 4];
  svft4 = [-3, 3];
  svft5 = [-2, 2];
  svft6 = [-1, 1];
}

async function editOpStrategy() {
  try {
    let strategyName = $("#opStrategyCombobox").text();
    let strategy = await getStrategyByName(strategyName);
    if (strategy === null) {
      openModalInfo("Please Choose a Strategy to Edit!");
      $("#opStrategyCombobox").html("Choose Strategy");
      return;
    }
    editStrategy(strategyName);
  } catch (err) {
    log("error", "editOpStrategy", err.stack);
  }
}

async function opCancel() {
  $("#opCancelBtn").addClass("disabled");
  $("#opRunPercent").html("Stopping Optimization..");
  $("#opRunRemaining").html("&nbsp;");
  await sleep(1000);
  cancelGetBinanceData();
  ft = ftmc;
  await terminateOpWorkers();
  strategyVariations = [];
  strategyVariationsResults = [];
  strategyVariationsIntermitBestResults = [];
  $("#opResultDiv").hide();
  $("#opExecInfo").show();
}

function openOpStrategy(index) {
  openStrategyVariationStrategy(strategyVariationsResults[index].strategy);
}

function opOptInfo() {
  openModalInfoBig(
    '<h2 class="text-center">Optimization Type:</h2><strong>Max Return</strong> - optimize the parameters to find the strategies that generate the highest return.<br><strong>Smooth</strong> - optimize the parameters to find the strategies that generate relatively consistent trades. Usually, those strategies generate less return but they have more predictable and smooth results.<br><strong>Risk/Reward</strong> - optimize the parameters to find the strategies that generate the highest return for the lowest drawdown.'
  );
}
function opOptTypeInfo(field) {
  openModalInfoBig(
    '<h2 class="text-center">' +
      field +
      " Type:</h2><strong>Don't change</strong> - the provided " +
      field.toLowerCase() +
      " will not be changed.<br><strong>Change</strong> - uses wide range of values to create strategy variations.<br>" +
      "<strong>Fine Tune</strong> - uses values close to the provided " +
      field.toLowerCase() +
      " in the original strategy."
  );
}

function opCpuInfo() {
  openModalInfoBig(
    '<div class="text-center"><h2>CPU Usage</h2></div><strong>One Core</strong> - uses only one CPU core. Will run slowly but will not consume much CPU power.<br><strong>1/2 Cores</strong> - uses 1/2 of your total CPU cores. Runs faster but consumes more resources.<br><strong>All Cores</strong> - uses all of your CPU cores - 1. The fastest option but it is recommended to avoid using additional applications when using this feature.'
  );
}

function fillOpTestPeriod() {
  if ($("#opFromDate").val().length > 0) {
    return;
  }
  try {
    let startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    let day = ("0" + startDate.getDate()).slice(-2);
    let month = ("0" + (startDate.getMonth() + 1)).slice(-2);
    let startDateStr = startDate.getFullYear() + "-" + month + "-" + day;
    $("#opFromDate").val(startDateStr);

    let toDate = new Date();
    day = ("0" + toDate.getDate()).slice(-2);
    month = ("0" + (toDate.getMonth() + 1)).slice(-2);
    let toDateStr = toDate.getFullYear() + "-" + month + "-" + day;
    $("#opToDate").val(toDateStr);
  } catch (err) {
    log("error", "fillOpTestPeriod", err.stack);
  }
}

async function fillOptimizationResult(marketReturn) {
  try {
    or = false;
    $("#opCancelBtn").addClass("disabled");
    for (let res of strategyVariationsIntermitBestResults) {
      strategyVariationsResults.push(res);
    }
    strategyVariationsIntermitBestResults = [];
    let strategiesTmpList = [];
    let resultTmp = [];
    let rowsShown = 100;

    for (let res of strategyVariationsResults) {
      let pushedRes = pushNewStrategyVariation(strategiesTmpList, res.strategy);
      if (pushedRes) {
        resultTmp.push(res);
      }
      if (resultTmp.length == rowsShown) {
        break;
      }
    }
    strategyVariationsResults = resultTmp;
    resultTmp = [];
    strategiesTmpList = [];

    optType = "return";
    strategyVariationsResults.sort(function(a, b) {
      return compareStrategyResults(a, b);
    });
    opResultShowRows(0, rowsShown);
    $("#opStrategiesTableNav").html("");
    let rowsTotal = strategyVariationsResults.length;

    let marketReturnClass = marketReturn > 0 ? "text-green" : marketReturn < 0 ? "text-red" : "";
    if (strategyVariationsResults.length > 0) {
      $("#opResultH").html(
        'Showing top 100 of the optimized strategies. Market Return for the same period: <span class="' +
          marketReturnClass +
          '">' +
          marketReturn.toFixed(2) +
          "%</span>"
      );
      $("#opStrategiesTable").show();
    } else {
      $("#opResultH").html("The optimiaztion didn't generate any strategies with positive return.");
      $("#opStrategiesTable").hide();
    }

    await terminateOpWorkers();
    $("#opRunning").hide();
    $("#opResult").show();
  } catch (err) {
    log("error", "fillOptimizationResult", err.stack);
    openModalInfo("Internal Error Occurred!<br>" + err.stack);
  }
}

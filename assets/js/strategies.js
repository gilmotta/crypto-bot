//EasyCryptoBot Copyright (C) 2018 Stefan Hristov
var strategy = null;

function getStratetyDb() {
  if (strategy === null) {
    strategy = new Datastore({
      filename: getAppDataFolder() + "/db/strategy.db",
      autoload: true
    });
  }
  return strategy;
}

function getStrategies() {
  return new Promise((resolve, reject) => {
    getStratetyDb().find({}).sort({name: 1}).exec((error, strategies) => {
      if (error) {
        reject(error);
      } else {
        resolve(strategies);
      }
    });
  });
}

function getStrategyByName(name) {
  return new Promise((resolve, reject) => {
    getStratetyDb().findOne({
      name: name
    }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function removeStrategy(name) {
  return new Promise((resolve, reject) => {
    getStratetyDb().remove({
      name: name
    }, function(error, numDeleted) {
      if (error) {
        reject(error);
      } else {
        resolve(numDeleted);
      }
    });
  });
}

function addStrategy(strategyToAdd) {
  return new Promise((resolve, reject) => {
    getStratetyDb().insert(strategyToAdd, (error, srt) => {
      if (error) {
        reject(error);
      } else {
        resolve(srt);
      }
    });
  });
}

let orgStrategyName = null;
let strategyDuplicated = false;
function parseRules(rules) {
  try {
    let rulesTmp = [];
    rules.each((index, rule) => {
      rulesTmp.push(rule);
    });
    let parsedRules = [];
    for (let rule of rulesTmp) {
      let indicator = rule.className.split("-")[1];
      let direction = $(rule).find(".direction").text();
      let period = Number.parseInt($(rule).find(".period").val());
      let period2 = Number.parseInt($(rule).find(".period2").val());
      let value = Number.parseInt($(rule).find(".value").val());
      let crossDirection = $(rule).find(".cross-direction").text();
      let timeframe = $(rule).find(".timeframe").text();

      let ruleItem = {};
      ruleItem.indicator = indicator;
      if (timeframe === "Choose Timeframe") {
        openModalInfo("Please choose a timeframe for each of your rules!");
        return null;
      }
      ruleItem.timeframe = timeframe;

      if (indicator === "sma" || indicator === "ema") {
        ruleItem.period = period;
        ruleItem.direction = direction;
        if (isNaN(period) || period <= 1) {
          openModalInfo("Please fill all moving average fields with correct values!");
          return null;
        }

        if (direction === "crossing") {
          ruleItem.crossDirection = crossDirection;
        } else {
          ruleItem.value = value;
          if (isNaN(value)) {
            openModalInfo("Please fill all moving average fields!");
            return null;
          }
        }
      } else if (indicator === "cma") {
        ruleItem.period = period;
        ruleItem.period2 = period2;
        if (isNaN(period) || isNaN(period2) || period <= 1 || period2 <= 1) {
          openModalInfo("Please fill all moving average fields with correct values!");
          return null;
        }
        ruleItem.type = $(rule).find(".ma-type").text();
        ruleItem.type2 = $(rule).find(".ma-type2").text();
        ruleItem.crossDirection = crossDirection;
      } else if (indicator === "rsi") {
        ruleItem.period = period;
        ruleItem.direction = direction;
        ruleItem.value = value;
        if (isNaN(period) || isNaN(value) || period <= 1 || value <= 0) {
          openModalInfo("Please fill all RSI fields with correct values!");
          return null;
        }
        if (direction === "crossing") {
          ruleItem.crossDirection = crossDirection;
        }
      } else if (indicator === "macd") {
        if (isNaN(period) || isNaN(period2) || period <= 1 || period2 <= 1) {
          openModalInfo("Please fill all MACD fields with correct values!");
          return null;
        }
        ruleItem.period = period;
        ruleItem.period2 = period2;
        if (period >= period2) {
          openModalInfo("The fast period of MADC rules should be lower than the slow period!");
          return null;
        }
        ruleItem.direction = direction;
        if (direction === "crossing") {
          ruleItem.crossDirection = crossDirection;
        }
        ruleItem.type = $(rule).find(".macd-line").text();
        if (ruleItem.type === "signal line") {
          let period3 = Number.parseInt($(rule).find(".period3").val());
          if (isNaN(period3) || period3 <= 1) {
            openModalInfo("Please fill all MACD fields with correct values!");
            return null;
          }
          ruleItem.period3 = period3;
          if (direction !== "crossing") {
            ruleItem.value = value;
            if (isNaN(value)) {
              openModalInfo("Please fill all MACD fields with correct values!");
              return null;
            }
          }
        } else {
          if (direction !== "crossing") {
            ruleItem.value = 0;
          }
        }
      } else if (indicator === "bb") {
        period2 = Number.parseFloat($(rule).find(".period2").val());
        if (isNaN(period) || isNaN(period2) || period <= 1 || period2 <= 0) {
          openModalInfo("Please fill all Bollinger Bands fields with correct values!");
          return null;
        }
        ruleItem.period = period;
        ruleItem.period2 = period2;
        ruleItem.type = $(rule).find(".bb-line").text();
        ruleItem.direction = direction;
        if (direction === "crossing") {
          ruleItem.crossDirection = crossDirection;
        } else {
          ruleItem.value = value;
          if (isNaN(value)) {
            openModalInfo("Please fill all Bollinger Bands fields with correct values!");
            return null;
          }
        }
      } else if (indicator === "sto" || indicator === "stoRsi") {
        let period3 = Number.parseInt($(rule).find(".period3").val());
        let indicatorName = indicator === "stoRsi"
          ? "Stochastic RSI"
          : "Stochastic";
        if (isNaN(period) || isNaN(period2) || isNaN(period3) || period <= 1 || period2 <= 0 || period3 <= 0) {
          openModalInfo("Please fill all " + indicatorName + " fields with correct values!");
          return null;
        }
        ruleItem.period = period;
        ruleItem.period2 = period2;
        ruleItem.period3 = period3;
        ruleItem.direction = direction;
        if (isNaN(value) || value < 0 || value > 100) {
          openModalInfo("Please fill all " + indicatorName + " fields with correct values!");
          return null;
        }
        ruleItem.value = value;
        if (direction === "crossing") {
          ruleItem.crossDirection = crossDirection;
          ruleItem.type = $(rule).find(".direction2").text();
        }

        if (indicator === "stoRsi") {
          let period4 = Number.parseInt($(rule).find(".period4").val());
          if (isNaN(period4) || period4 <= 1) {
            openModalInfo("Please fill all " + indicatorName + " fields with correct values!");
            return null;
          }
          ruleItem.period4 = period4;
        }
      }

      parsedRules.push(ruleItem);
    }
    return parsedRules;
  } catch (err) {
    openModalInfo("Please fill all fields!");
    return null;
  }
}

async function saveStrategy() {
  let strategyName = $("#strategyName").val().trim();
  if (strategyName.length === 0) {
    openModalInfo("Please type a name for the strategy!");
    return;
  }
  if (strategyName.indexOf('"') != -1 || strategyName.indexOf("'") != -1 || strategyName.indexOf("\\") != -1) {
    openModalInfo("The strategy name cannot contain any of the following symbols: ', \", \\");
    return;
  }

  let buyRules = $("#buyRules>ul>li");
  if (buyRules.length === 0) {
    openModalInfo("Please add at least one BUY rule!");
    return;
  }
  let buyRulesList = parseRules(buyRules);
  if (buyRulesList === null) {
    return;
  }

  let sellRules = $("#sellRules>ul>li");
  if (sellRules.length === 0 && $("#target").val().trim().length <= 0 && $("#trailingSl").val().trim().length <= 0) {
    openModalInfo("Please add at least one SELL rule or a Target!");
    return;
  }
  let sellRulesList = parseRules(sellRules);
  if (sellRulesList === null) {
    return;
  }

  let rulesTimeframes = [];
  for (let rule of buyRulesList) {
    if (rulesTimeframes.indexOf(rule.timeframe) === -1) {
      rulesTimeframes.push(rule.timeframe);
    }
  }
  for (let rule of sellRulesList) {
    if (rulesTimeframes.indexOf(rule.timeframe) === -1) {
      rulesTimeframes.push(rule.timeframe);
    }
  }
  if (rulesTimeframes.length > 2) {
    openModalInfo("Please use no more than 2 different timeframes in your rules!");
    return;
  }

  let stoploss = Number.parseFloat($("#stoploss").val());
  if (!isNaN(stoploss) && stoploss < 0.25) {
    openModalInfo("The stoploss cannot be less than 0.25");
    return;
  }
  let trailingSl = Number.parseFloat($("#trailingSl").val());
  if (!isNaN(trailingSl) && trailingSl < 0.25) {
    openModalInfo("The trailing stoploss cannot be less than 0.25");
    return;
  }
  if (!isNaN(trailingSl)) {
    stoploss = null;
  }
  let target = Number.parseFloat($("#target").val());
  if (!isNaN(target) && target < 0.25) {
    openModalInfo("The target cannot be less than 0.25");
    return;
  }
  let ttarget = Number.parseFloat($("#ttarget").val());
  if (!isNaN(ttarget) && ttarget <= 0) {
    openModalInfo("The trailing target cannot be less than 0");
    return;
  }
  if (isNaN(target) && !isNaN(ttarget)) {
    openModalInfo("Please povide a target, when using a trailing target.");
    return;
  }

  let timeClose = Number.parseFloat($("#timeClose").val());
  if (!isNaN(timeClose) && timeClose < 1) {
    openModalInfo("The Rime Close cannot be less than 1");
    return;
  } else {
    timeClose = 1;
  }
  if (!isNaN(timeClose)) {
    timeClose = Number.parseInt(timeClose.toFixed(0));
  }

  try {
    let strategy = {
      name: strategyName,
      buyRules: buyRulesList,
      sellRules: sellRulesList,
      stoploss: stoploss,
      target: target,
      ttarget: ttarget,
      trailingSl: trailingSl,
      timeClose: timeClose
    };

    let srtTmp = await getStrategyByName(strategy.name);

    let isRunnig = await isStrategyRunning(strategy.name);
    if (isRunnig) {
      openModalInfo('Strategy with name "' + strategy.name + '" already exists and is currently running.<br>Please stop the execution and then try to edit/remove it.');
      return;
    }

    let hasOpenTrades = await hasStrategyOpenTrades(strategy.name);
    let hasOpenTrades2 = await hasStrategyOpenTrades(orgStrategyName);

    if (hasOpenTrades) {
      openModalInfo("Edit is not allowed for executing strategies with open trades.<br>If you want to edit, please close the trade.");
      return;
    }
    if (hasOpenTrades2) {
      openModalInfo("Edit is not allowed for executing strategies with open trades.<br>If you want to edit, please close the trade.");
      return;
    }
    let isUsedInExecutions = await isStrategyUsedInExecutions(strategy.name);

    if (srtTmp !== null && orgStrategyName !== srtTmp.name) {
      let label = isUsedInExecutions
        ? "Strategy with name " + strategy.name + ' already exists and is also in the "Executions" list. Your changes will apply to the execution as well. <br>Do you want to overwrite it?'
        : "Strategy with name " + strategy.name + " already exists.<br>Do you want to overwrite it?";
      openModalConfirm(label, async function() {
        await overwriteStrategy(strategy, orgStrategyName);
        if (orgStrategyName !== null) {
          if ($("#btStrategyCombobox").text() === orgStrategyName) {
            $("#btStrategyCombobox").text(strategy.name);
          }
          if ($("#tsStrategyCombobox").text() === orgStrategyName) {
            $("#tsStrategyCombobox").text(strategy.name);
          }
          if ($("#opStrategyCombobox").text() === orgStrategyName) {
            $("#opStrategyCombobox").text(strategy.name);
          }
          if ($("#tsStrategyCombobox").text() === orgStrategyName) {
            $("#tsStrategyCombobox").text(strategy.name);
          }
        }
        if (isUsedInExecutions) {
          updateExecutionStrategy(strategy.name, strategy.name);
        }
      });
      return;
    }

    if (orgStrategyName !== null) {
      await removeStrategy(orgStrategyName);
      if ($("#btStrategyCombobox").text() === orgStrategyName) {
        $("#btStrategyCombobox").text(strategy.name);
      }
      if ($("#tsStrategyCombobox").text() === orgStrategyName) {
        $("#tsStrategyCombobox").text(strategy.name);
      }
      if ($("#opStrategyCombobox").text() === orgStrategyName) {
        $("#opStrategyCombobox").text(strategy.name);
      }
      if ($("#tsStrategyCombobox").text() === orgStrategyName) {
        $("#tsStrategyCombobox").text(strategy.name);
      }
    }
    await addStrategy(strategy);
    const strategies = await getStrategies();
    loadStrategies();
    closeNewStrategy();
    if (orgStrategyName !== null) {
      isUsedInExecutions = await isStrategyUsedInExecutions(orgStrategyName);
      if (isUsedInExecutions) {
        updateExecutionStrategy(strategy.name, orgStrategyName);
      }
    }
  } catch (err) {
    //alert(err)
  }
}

function stoplossTypeChange(type) {
  if (type === "sl") {
    $("#trailingSl").val("");
  } else if (type === "tsl") {
    $("#stoploss").val("");
    $("#ttarget").val("");
  } else if (type === "tt") {
    $("#trailingSl").val("");
  }
}

async function overwriteStrategy(strategy, name) {
  await removeStrategy(strategy.name);
  if (name !== undefined) {
    await removeStrategy(name);
  }
  await addStrategy(strategy);
  loadStrategies();
  closeNewStrategy();
}

function addNewSmaRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-sma" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + " timeframe the price is " + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">above</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show();$('#" + id + "P').hide()})\">crossing</a></li>" + "</ul>" + "</div>" + '&nbsp;SMA with period <input class="period" type="number" value="20" /> ' + '<div id="' + id + 'P" class="inline"> by <input class="value" type="number" value="10" /> %</div>' + '<div id="' + id + 'C" class="inline" style="display:none;"> from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + "</div>" + '&nbsp;<a title="Info" onclick="smaInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewEmaRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-ema" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + " timeframe the price is " + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">above</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show();$('#" + id + "P').hide()})\">crossing</a></li>" + "</ul>" + "</div>" + '&nbsp;EMA with period <input class="period" type="number" value="20" /> ' + '<div id="' + id + 'P" class="inline"> by <input class="value" type="number" value="10" /> %</div>' + '<div id="' + id + 'C" class="inline" style="display:none;"> from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + "</div>" + '&nbsp;<a title="Info" onclick="emaInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewCmaRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-cma" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + ' timeframe <div id="' + id + 'T1" class="inline"><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'T1\')"><span class="name ma-type">SMA</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'SMA\', \'#' + id + "T1')\">SMA</a></li><li><a href=\"#/\" onclick=\"dropDownItem('EMA', '#" + id + 'T1\')">EMA</a></li></ul></div></div> with period <input class="period" type="number" value="20"> is crossing <div id="' + id + 'T2" class="inline"><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'T2\')"><span class="name ma-type2">SMA</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'SMA\', \'#' + id + "T2')\">SMA</a></li><li><a href=\"#/\" onclick=\"dropDownItem('EMA', '#" + id + 'T2\')">EMA</a></li></ul></div></div> with period <input class="period2" type="number" value="50" />' + '<div id="' + id + 'C" class="inline"> from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + "</div>" + '&nbsp;<a title="Info" onclick="cmaInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewRsiRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-rsi" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + ' timeframe RSI with period <input class="period" type="number" value="14" /> is&nbsp;' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">above</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show()})\">crossing</a></li>" + "</ul>" + "</div>" + '<div class="inline">&nbsp;<input class="value" type="number" value="50"/></div>' + '<div id="' + id + 'C" class="inline" style="display:none;"> from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + "</div>" + '&nbsp;<a title="Info" onclick="rsiInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewMacdRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-macd" id="' + id + '"><span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + ' timeframe MACD, using "fast" period <input class="period" type="number" value="12" /> and "slow" period <input class="period2" type="number" value="26"/>,&nbsp;is&nbsp;<div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">above</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'above\', \'#' + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">above</a></li><li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">below</a></li><li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "P').hide();$('#" + id + 'C\').show()})">crossing</a></li></ul></div>&nbsp;<div id="' + id + 'Line" class="inline"><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'Line\')"><span class="name macd-line">signal line</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'signal line\', \'#' + id + "Line', function(){$('#" + id + "SL').show()})\">signal line</a></li><li><a href=\"#/\" onclick=\"dropDownItem('zero', '#" + id + "Line',function(){$('#" + id + 'SL\').hide()})">zero</a></li></ul></div></div><div id="' + id + 'SL" class="inline">&nbsp;with period <input class="period3" type="number" value="9"/> <div id="' + id + 'P" class="inline"> by <input class="value" type="number" value="1" /> %</div></div><div id="' + id + 'C" class="inline" style="display:none;"> from <div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'bottom to top\', \'#' + id + "C')\">bottom to top</a></li><li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + 'C\')">top to bottom</a></li></ul></div></div>&nbsp;<a title="Info" onclick="macdInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a></li>');
}

function addNewBBRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-bb" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + " timeframe the price is " + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">above</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "P').show();$('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show();$('#" + id + "P').hide()})\">crossing</a></li>" + "</ul>" + "</div>" + '&nbsp;the&nbsp;<div id="' + id + 'Line" class="inline"><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'Line\')"><span class="name bb-line">upper band</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="dropDownItem(\'upper band\', \'#' + id + "Line', function(){})\">upper band</a></li><li><a href=\"#/\" onclick=\"dropDownItem('lower band', '#" + id + 'Line\',function(){})">lower band</a></li></ul></div></div>&nbsp;of Bollinger Bands with period <input class="period" type="number" value="20" /> ' + '&nbsp;and Std. Dev. <input class="period2" type="number" value="2"/>&nbsp;' + '<div id="' + id + 'P" class="inline"> by <input class="value" type="number" value="1" /> %</div>' + '<div id="' + id + 'C" class="inline" style="display:none;"> from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + "</div>" + '&nbsp;<a title="Info" onclick="bbInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewStoRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-sto" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + " timeframe Stochastic %K line is " + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">crossing</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show();})\">crossing</a></li>" + "</ul>" + "</div>" + '<div id="' + id + 'C" class="inline"> %D line from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + '&nbsp;<div id="' + id + 'D2" class="inline"> <div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'D2\')"><span class="name direction2">below</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "D2')\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "D2')\">below</a></li> </ul></div></div>" + '</div> <input class="value" type="number" value="50" />. Setup: %K period is <input class="period" type="number" value="14" />, %D period is <input class="period2" type="number" value="3" />, Smoothing is <input class="period3" type="number" value="3" />' + '&nbsp;<a title="Info" onclick="stoInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function addNewStoRsiRule(id, type) {
  $("#" + type + "Rules>ul").append('<li class="' + type + '-stoRsi" id="' + id + '">' + '<span class="bold">Rule: </span>On ' + '<div id="' + id + 'TF" class="inline" style=""><div class="drop-down"><a href="#/" onclick="dropDown(\'#' + id + 'TF\')"><span class="name timeframe">' + lastTFUsed + '</span> <span class="caret"></span></a><ul><li><a href="#/" onclick="tfDropDownItem(\'1 minute\', \'#' + id + "TF')\">1 minute</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('5 minutes', '#" + id + "TF')\">5 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('15 minutes','#" + id + "TF')\">15 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('30 minutes', '#" + id + "TF')\">30 minutes</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 hour', '#" + id + "TF')\">1 hour</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('2 hours', '#" + id + "TF')\">2 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('4 hours', '#" + id + "TF')\">4 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('12 hours', '#" + id + "TF')\">12 hours</a></li><li><a href=\"#/\" onclick=\"tfDropDownItem('1 day', '#" + id + "TF')\">1 day</a></li></ul></div></div>" + " timeframe Stochastic RSI %K line is " + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + '\')"><span class="name direction">crossing</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "', function(){ $('#" + id + "C').hide()})\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "', function(){ $('#" + id + "C').hide()})\">below</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('crossing', '#" + id + "', function(){ $('#" + id + "C').show();})\">crossing</a></li>" + "</ul>" + "</div>" + '<div id="' + id + 'C" class="inline"> %D line from ' + '<div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'C\')"><span class="name cross-direction">bottom to top</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('bottom to top', '#" + id + "C')\">bottom to top</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('top to bottom', '#" + id + "C')\">top to bottom</a></li>" + "</ul>" + "</div>" + '&nbsp;<div id="' + id + 'D2" class="inline"> <div class="drop-down">' + '<a href="#/" onclick="dropDown(\'#' + id + 'D2\')"><span class="name direction2">below</span> <span ' + 'class="caret"></span></a>' + "<ul>" + "<li><a href=\"#/\" onclick=\"dropDownItem('above', '#" + id + "D2')\">above</a></li>" + "<li><a href=\"#/\" onclick=\"dropDownItem('below', '#" + id + "D2')\">below</a></li> </ul></div></div>" + '</div> <input class="value" type="number" value="50" />. Setup: RSI period is <input class="period4" type="number" value="14" />, %K period is <input class="period" type="number" value="14" />, %D period is <input class="period2" type="number" value="3" />, Smoothing is <input class="period3" type="number" value="3" />' + '&nbsp;<a title="Info" onclick="stoRsiInfo()" href="#/"><i class="text-blue fa fa-info-circle"></i></a>' + '&nbsp;<a title="Remove Rule" onclick="removeRule(\'#' + id + '\')" href="#/"><i class="text-red fas fa-times"></i></a>' + "</li>");
}

function ordersInfo() {
  openModalInfoBig('<h3 class="text-center">EasyCryptoBot Trading</h3><br><strong>BUY </strong> - when all of the buying rules are met the bot will execute MARKET BUY Order on the open of the candle, following the one in which the rules were met. This means that the bot will wait for a confirmation that the rules are met before buying.<br><br><strong>SELL </strong> - when all of the selling rules are met the bot will execute MARKET SELL Order on the open of the candle, following the one in which the rules were met. This means that the bot will wait for a confirmation that the rules are met before selling.<br><br><strong>STOPLOSS </strong> - if the current price reaches the stoploss a MARKET SELL order is executed.<br><br><strong>TARGET </strong> - if you privide a target percent when the bot buys a LIMIT SELL Order will be placed on the exchange. That way the target profit pecent will be guaranted for the full amount of your trading size.<br><br><strong>Time Close </strong> - when the provided time has passed if the position is still open the bot will execute a MARKET SELL order.');
}

function stoInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">Stochastic oscillator is a momentum indicator comparing a particular closing price of a security to a range of its prices over a certain period of time.<br><br>Stochastic values are plotted in a range bound between 0 and 100. Overbought conditions exist when the oscillator is above 80, and the asset is considered oversold when values are below 20.<br><br>Stochastic oscillator charting generally consists of two lines: one reflecting the actual value of the oscillator for each session, and one reflecting its three-day simple moving average. Because price is thought to follow momentum, intersection of these two lines is considered to be a signal that a reversal may be in the works, as it indicates a large shift in momentum from day to day.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/sto-info.png" alt="">');
}

function stoRsiInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">Stochastic RSI indicator is essentially an indicator of an indicator.<br><br>It is used in technical analysis to provide a stochastic calculation to the RSI indicator. This means that it is a measure of RSI relative to its own high/low range over a user defined period of time.<br><br>This indicator is primarily used for identifying overbought and oversold conditions. Overbought conditions exist when the oscillator is above 80, and the asset is considered oversold when values are below 20.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/sto-rsi-info.png" alt="">');
}

function bbInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">Bollinger Bands is a tool that plots two standard deviations (positively and negatively) away from a simple moving average (SMA) of the price.<br><br>The purpose of Bollinger Bands is to provide a relative definition of high and low prices of a market. Many traders believe the closer the prices move to the upper band, the more overbought the market, and the closer the prices move to the lower band, the more oversold the market.<br><br>The author of the indicator John Bollinger has a set of 22 rules to follow when using the bands as a trading system.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/bb-info.png" alt="">');
}

function macdInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">MACD, short for Moving Average Convergence/Divergence, is a trend-following momentum indicator.The MACD is the difference between a "fast" (short period) exponential moving average (EMA), and a "slow" (longer period) EMA. An EMA of the MACD that is called "signal line" is plotted on top of the MACD.<br><br>Signal Line Crossovers<br>Signal line crossovers are the most common MACD signals. A BUY signal is when MACD turns up and crosses above the signal line.<br><br>Center Line Crossovers<br>Center line crossovers are the next most common MACD signals. A bullish signal is generated when when the MACD Line moves above the zero line to turn positive.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/macd-info.png" alt="">');
}

function smaInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">The moving averages provide an easy way to determine the trend. It is easy to gauge the general direction and see whether a pair is trending up, trending down, or just ranging. When price action tends to stay above the moving average, it signals that price is in a general UPTREN and vise versa.<br><br>' + "A Simple Moving Average is calculated by adding up the last X period's closing prices and then dividing that number by X." + "<br><br>If you have a SMA with period 10 using daily chart, you would add up the closing prices for the last 10 days, and then divide that number by 10." + '<br><br>You can read on various strategies that use SMA in internet.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/sma-info.png" alt="">');
}

function emaInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">Exponential moving averages work like Simple Moving Averages, but reduce the lag by applying more weight to recent prices. ' + "<br><br>The weighting applied to the most recent price depends on the number of periods in the moving average. EMAs differ from simple moving averages in that a given day's EMA calculation depends on the EMA calculations for all the days prior to that day." + '<br><br>You can read on various strategies that use EMA in internet.</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/ema-info.png" alt="">');
}

function cmaInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">A Crossover occurs when a short-term average crosses through a long-term average.' + "<br><br>This signal is used by traders to identify that momentum is shifting in one direction and that a strong move is likely approaching." + "<br><br>A buy signal is generated when the short-term average crosses above the long-term average, while a sell signal is triggered by a short-term average crossing below a long-term average." + '</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/cma-info.png" alt="">');
}

function rsiInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%">Relative Strength Index - RSI is a momentum indicator which provides a relative evaluation of the strength of the recent price performance.' + " RSI values range from 0 to 100. " + "<br><br>A RSI reading of 70 or above is commonly interpreted as indicating an overbought or overvalued condition that may signal a trend change or corrective price reversal to the downside." + "<br><br>A RSI reading of 30 or below is commonly interpreted as indicating an oversold or undervalued condition that may signal a trend change or corrective price reversal to the upside." + '</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/rsi-info.png" alt="">');
}

function timeCloseInfo() {
  openModalInfoBig("The Time Close field will close each position if your selling rules were not met or if the stoploss and the target were not reached within the provided timeframe. For example if you put '24' in this field all your positions will be closed 24 hours after they were opened automatically even the selling rules were not met. Should be whole hour - cannot have decimals and will be rounded.");
}

function targetInfo() {
  openModalInfoBig("If you provide a target the bot will place a LIMIT SELL order on the exchange to ensure the desired percent.");
}

function ttargetInfo() {
  openModalInfoBig('<div style="display:inline-block;width:40%;margin:0 5%"><h3 class="text-center">Trailing Target</h3><br>This option will place a trailing stoploss bellow the current price after given target is reached first.<br> ' + "<br>For example: <br>1. Buy at $100 with target 10% and trailing target 1%.<br>2. When the price reaches the 10% target at $110 a trailing stoploss will be placed at 108.9 (1% bellow the curent price)." + "<br>3. The price continue going up along with the trailing stop.<br>4. Finally after reaching $117.5 the price drops more than 1% and the stop closes the trade at $116." + "<br>5. So you made $16 per coin instead of $10 (the initial target)" + '</div><img style="display:inline-block;width:40%;margin:0 5%;vertical-align:top;" src="./assets/images/ttarget-info.png" alt="">');
}

function stoplossInfo() {
  openModalInfoBig("If the stoploss is reached the bot will execute a MARKET SELL order. Please note that if the bot is not running the stoploss order will not be placed! ");
}

function indicatorCommingSoon(name) {
  openModalInfo(name + " is comming soon!");
}

function tfDropDownItem(name, id, func) {
  lastTFUsed = name;
  dropDownItem(name, id, func);
}

let ruleCount = 1;
let buyRuleType = "sma";
let sellRuleType = "sma";
let lastTFUsed = "Choose Timeframe";

function newBuyRule() {
  let id = "rule" + ruleCount;
  newRule(id, buyRuleType, "buy");
  ruleCount++;
  return id;
}

function newSellRule() {
  let id = "rule" + ruleCount;
  newRule(id, sellRuleType, "sell");
  ruleCount++;
  return id;
}

function newRule(id, type, direction) {
  if (type === "sma") {
    addNewSmaRule(id, direction);
  } else if (type === "ema") {
    addNewEmaRule(id, direction);
  } else if (type === "cma") {
    addNewCmaRule(id, direction);
  } else if (type === "rsi") {
    addNewRsiRule(id, direction);
  } else if (type === "macd") {
    addNewMacdRule(id, direction);
  } else if (type === "bb") {
    addNewBBRule(id, direction);
  } else if (type === "sto") {
    addNewStoRule(id, direction);
  } else if (type === "stoRsi") {
    addNewStoRsiRule(id, direction);
  } else {
    indicatorCommingSoon(type);
  }
}

function removeRule(id) {
  openModalConfirm("Are you sure you want to remove this rule?", function() {
    $(id).remove();
  });
}

function closeNewStrategy() {
  $("#newStrategyWindow").hide();
  $("#strategiesBody").css("opacity", "1");
  $("#strategiesBody").css("pointer-events", "auto");
  $("#sidebar").css("opacity", "1");
  $("#sidebar").css("pointer-events", "auto");
  $("#wrapper").css("opacity", "1");
  $("#wrapper").css("pointer-events", "auto");
  $("#footer").css("opacity", "1");
  $("#footer").css("pointer-events", "auto");
  $("#btBody").css("opacity", "1");
  $("#btBody").css("pointer-events", "auto");
  $("body").css("overflow-y", "auto");
}

function newStrategy() {
  orgStrategyName = null;
  strategyDuplicated = false;
  lastTFUsed = "Choose Timeframe";
  clearStrategyFields();
  $("#duplicateStrategyBtn").hide();
  $("#newStrategyLabel").html("Create New Strategy");
  $("#newStrategyWindow").fadeIn();
  $("#strategiesBody").css("opacity", "0.5");
  $("#strategiesBody").css("pointer-events", "none");
  $("#sidebar").css("opacity", "0.5");
  $("#sidebar").css("pointer-events", "none");
  $("#wrapper").css("opacity", "0.5");
  $("#wrapper").css("pointer-events", "none");
  $("#footer").css("opacity", "0.5");
  $("#footer").css("pointer-events", "none");
  $("body").css("overflow", "hidden");
}

function duplicateStrategy() {
  $("#newStrategyLabel").html("Duplicate Strategy");
  $("#strategyName").val($("#strategyName").val() + " (1)");
  strategyDuplicated = true;
  lastTFUsed = "Choose Timeframe";
  orgStrategyName = null;
  $("#saveStrategyBtn").removeClass("disabled");
  $("#saveStrategyDisabled").hide();
}

function openStrategyVariationStrategy(strategy) {
  orgStrategyName = null;
  strategyDuplicated = false;
  $("#newStrategyLabel").html("Save Strategy Variation");
  $("#duplicateStrategyBtn").hide();
  openStrategy(strategy);
}

function fillRule(rule, id) {
  let tf = rule.timeframe === null || rule.timeframe === undefined
    ? "Choose Timeframe"
    : rule.timeframe;
  $(id).find(".timeframe").text(tf);
  if (rule.indicator === "sma" || rule.indicator === "ema") {
    $(id).find(".period").val(rule.period);
    $(id).find(".direction").text(
      rule.direction === "bellow"
      ? "below"
      : rule.direction);
    if (rule.direction === "crossing") {
      $(id + "C").show();
      $(id + "P").hide();
      $(id).find(".cross-direction").text(rule.crossDirection);
    } else {
      $(id).find(".value").val(rule.value);
    }
  } else if (rule.indicator === "cma") {
    $(id).find(".period").val(rule.period);
    $(id).find(".period2").val(rule.period2);
    $(id).find(".ma-type").text(rule.type);
    $(id).find(".ma-type2").text(rule.type2);
    $(id).find(".cross-direction").text(rule.crossDirection);
  } else if (rule.indicator === "rsi") {
    $(id).find(".period").val(rule.period);
    $(id).find(".direction").text(
      rule.direction === "bellow"
      ? "below"
      : rule.direction);
    $(id).find(".value").val(rule.value);
    if (rule.direction === "crossing") {
      $(id + "C").show();
      $(id + "P").hide();
      $(id).find(".cross-direction").text(rule.crossDirection);
    }
  } else if (rule.indicator === "macd") {
    $(id).find(".period").val(rule.period);
    $(id).find(".period2").val(rule.period2);
    $(id).find(".direction").text(
      rule.direction === "bellow"
      ? "below"
      : rule.direction);
    $(id).find(".macd-line").text(rule.type);

    if (rule.type === "signal line") {
      $(id).find(".period3").val(rule.period3);
    } else {
      $(id + "SL").hide();
    }

    if (rule.direction === "crossing") {
      $(id + "C").show();
      $(id + "P").hide();
      $(id).find(".cross-direction").text(rule.crossDirection);
    } else {
      $(id).find(".value").val(rule.value);
    }
  } else if (rule.indicator === "bb") {
    $(id).find(".period").val(rule.period);
    $(id).find(".period2").val(rule.period2);
    $(id).find(".direction").text(
      rule.direction === "bellow"
      ? "below"
      : rule.direction);
    $(id).find(".bb-line").text(rule.type);

    if (rule.direction === "crossing") {
      $(id + "C").show();
      $(id + "P").hide();
      $(id).find(".cross-direction").text(rule.crossDirection);
    } else {
      $(id).find(".value").val(rule.value);
    }
  } else if (rule.indicator === "sto" || rule.indicator === "stoRsi") {
    $(id).find(".period").val(rule.period);
    $(id).find(".period2").val(rule.period2);
    $(id).find(".period3").val(rule.period3);
    $(id).find(".direction").text(
      rule.direction === "bellow"
      ? "below"
      : rule.direction);
    $(id).find(".value").val(rule.value);
    if (rule.direction === "crossing") {
      $(id + "C").show();
      $(id).find(".cross-direction").text(rule.crossDirection);
      $(id).find(".direction2").text(rule.type);
    } else {
      $(id + "C").hide();
    }
    if (rule.indicator === "stoRsi") {
      $(id).find(".period4").val(rule.period4);
    }
  }
}

function openStrategy(strategy, hideSaveBtn) {
  try {
    clearStrategyFields();
    $("#newStrategyWindowDiv").animate({
      scrollTop: 0
    }, "fast");
    $("#newStrategyWindow").fadeIn();
    $("#btBody").css("opacity", "0.5");
    $("#btBody").css("pointer-events", "none");
    $("#strategiesBody").css("opacity", "0.5");
    $("#strategiesBody").css("pointer-events", "none");
    $("#sidebar").css("opacity", "0.5");
    $("#sidebar").css("pointer-events", "none");
    $("#wrapper").css("opacity", "0.5");
    $("#wrapper").css("pointer-events", "none");
    $("#footer").css("opacity", "0.5");
    $("#footer").css("pointer-events", "none");
    $("body").css("overflow", "hidden");

    $("#strategyName").val(strategy.name);
    $("#stoploss").val(strategy.stoploss);
    $("#trailingSl").val(strategy.trailingSl);
    $("#target").val(strategy.target);
    $("#ttarget").val(strategy.ttarget);
    $("#timeClose").val(strategy.timeClose);

    let buyRuleTypeTmp = buyRuleType;
    strategy.buyRules.forEach(rule => {
      buyRuleType = rule.indicator;
      let id = "#" + newBuyRule();
      fillRule(rule, id);
    });
    buyRuleType = buyRuleTypeTmp;

    let sellRuleTypeTmp = sellRuleType;
    strategy.sellRules.forEach(rule => {
      sellRuleType = rule.indicator;
      let id = "#" + newSellRule();
      fillRule(rule, id);
    });
    sellRuleType = sellRuleTypeTmp;

    if (hideSaveBtn) {
      $("#saveStrategyBtn").addClass("disabled");
      $("#saveStrategyDisabled").show();
      openModalInfo('The strategy "' + name + '" is currently running.<br>Please stop the execution and then try to edit.');
    } else {
      $("#saveStrategyBtn").removeClass("disabled");
      $("#saveStrategyDisabled").hide();
    }
  } catch (err) {
    log("error", "openStrategy", err.stack);
  }
}

async function editStrategy(name) {
  let isRunnig = await isStrategyRunning(name);

  let isUsedInExecutions = await isStrategyUsedInExecutions(name);

  orgStrategyName = name;
  strategyDuplicated = false;
  $("#newStrategyLabel").html("Edit Strategy");
  $("#duplicateStrategyBtn").css("display", "inline-block");
  const strategy = await getStrategyByName(name);
  lastTFUsed = "Choose Timeframe";
  openStrategy(strategy, isRunnig);
  if (isUsedInExecutions && !isRunnig) {
    openModalInfo('Please note that the strategy "' + name + '" is currently in the "Executions" list under the Traging tab. Your changes will apply to the execution as well.');
  }
}

function clearStrategyFields() {
  $("#strategyName").val("");
  ruleCount = 1;
  buyRuleType = "sma";
  sellRuleType = "sma";
  $("#buyRules>ul").html("");
  $("#sellRules>ul").html("");
  $("#buyRulesCombobox").html("Simple Moving Average SMA");
  $("#sellRulesCombobox").html("Simple Moving Average SMA");
  $("#stoploss").val("");
  $("#trailingSl").val("");
  $("#target").val("");
  $("#ttarget").val("");
  $("#timeClose").val("");
  $("#saveStrategyBtn").removeClass("disabled");
  $("#saveStrategyDisabled").hide();
}

async function rmStrategy(name) {
  let isUsedInExecutions = await isStrategyUsedInExecutions(name);
  if (isUsedInExecutions) {
    openModalInfo('The strategy "' + name + '" is in the "Executions" list under the Trades tab.<br>Please stop and remove the execution and then try to remove the strategy.');
    return;
  }

  openModalConfirm("Are you sure you want to remove " + name + " strategy?", function() {
    rmStrategy2(name);
    if ($("#btStrategyCombobox").text() === name) {
      $("#btStrategyCombobox").text("Choose Strategy");
    }
    if ($("#tsStrategyCombobox").text() === name) {
      $("#tsStrategyCombobox").text("Choose Strategy");
    }
    if ($("#opStrategyCombobox").text() === name) {
      $("#opStrategyCombobox").text("Choose Strategy");
    }
    if ($("#tsStrategyCombobox").text() === name) {
      $("#tsStrategyCombobox").text("Choose Strategy");
    }
  });
}

async function rmStrategy2(name) {
  try {
    const numDeleted = await removeStrategy(name);
    loadStrategies();
  } catch (err) {
    log("error", "rmStrategy2", err.stack);
  }
}

function openBacktestStrategy(name) {
  $("#btStrategyCombobox").html(name);
  sectionClick("#backtest");
  $(window).scrollTop(0);
}

function openOptimizeStrategy(name) {
  $("#opStrategyCombobox").html(name);
  sectionClick("#optimize");
  $(window).scrollTop(0);
}

const loadStrategiesMutex = new Mutex();
async function loadStrategies() {
  try {
    await loadStrategiesMutex.lock();
    const strategies = await getStrategies();
    $("#strategiesTable tbody").html("");
    for (let strategy of strategies) {
      let usedInExecution = await getStrategyExecutionStatus(strategy.name);
      let running = "";
      if (usedInExecution.length > 0) {
        let isRunning = await isStrategyRunning(strategy.name);
        if (isRunning) {
          running = '<i title="Currently running" class="fas fa-bolt curso-help"></i>';
        }
      }

      $("#strategiesTable tbody").append("<tr><td>" + strategy.name + '</td><td class="text-center">' + running + '</td><td class="text-right">' + usedInExecution + '</td><td class="text-center"><a title="Edit Strategy" href="#newStrategyLabel" onclick="editStrategy(\'' + strategy.name.replace(/'/g, "\\'") + '\')" ><i class="far fa-edit"></i></a>' + '&nbsp;&nbsp;&nbsp;<a title="Backtest Strategy" href="#/" onclick="openBacktestStrategy(\'' + strategy.name.replace(/'/g, "\\'") + '\')" ><i class="fas fa-chart-line"></i></a>' + '&nbsp;&nbsp;&nbsp;<a title="Optimize Strategy" href="#/" onclick="openOptimizeStrategy(\'' + strategy.name.replace(/'/g, "\\'") + '\')" ><i class="fas fa-cogs"></i></a>' + '&nbsp;&nbsp;&nbsp;<a title="Remove Strategy" href="#/" onclick="rmStrategy(\'' + strategy.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-trash"></i></a></td></tr>');
    }
  } catch (err) {
    log("error", "loadStrategies", err.stack);
  } finally {
    await loadStrategiesMutex.release();
  }
}

async function fillDefaultStrategies() {
  try {
    const target = getAppDataFolder() + "/db/strategy.db";
    fs.exists(target, async function(targetExists) {
      if (!targetExists) {
        let strategies = [];

        strategies.push({
          name: "Example: Crossing Moving Averages",
          buyRules: [
            {
              indicator: "cma",
              timeframe: "5 minutes",
              period: 7,
              period2: 20,
              type: "EMA",
              type2: "SMA",
              crossDirection: "bottom to top"
            }
          ],
          sellRules: [
            {
              indicator: "cma",
              timeframe: "5 minutes",
              period: 7,
              period2: 20,
              type: "EMA",
              type2: "SMA",
              crossDirection: "top to bottom"
            }
          ],
          stoploss: 2,
          target: 6
        });
        strategies.push({
          name: "Example: EMA below/Above",
          buyRules: [
            {
              indicator: "ema",
              timeframe: "5 minutes",
              period: 5,
              direction: "below",
              value: 0.5
            }
          ],
          sellRules: [
            {
              indicator: "ema",
              timeframe: "5 minutes",
              period: 5,
              direction: "above",
              value: 0.5
            }
          ],
          stoploss: 2,
          target: 6
        });

        strategies.push({
          name: "Example: RSI + Crossing MAs",
          buyRules: [
            {
              indicator: "rsi",
              timeframe: "5 minutes",
              period: 20,
              direction: "below",
              value: 40
            }, {
              indicator: "cma",
              timeframe: "5 minutes",
              period: 3,
              period2: 10,
              type: "EMA",
              type2: "SMA",
              crossDirection: "bottom to top"
            }
          ],
          sellRules: [
            {
              indicator: "rsi",
              timeframe: "5 minutes",
              period: 20,
              direction: "above",
              value: 60
            }, {
              indicator: "cma",
              timeframe: "5 minutes",
              period: 3,
              period2: 10,
              type: "EMA",
              type2: "SMA",
              crossDirection: "top to bottom"
            }
          ],
          stoploss: 2,
          target: 3
        });

        strategies.push({
          name: "Example: 15m EOSETH",
          buyRules: [
            {
              indicator: "sma",
              timeframe: "15 minutes",
              period: 30,
              direction: "below",
              value: 3
            }, {
              indicator: "rsi",
              timeframe: "15 minutes",
              period: 10,
              direction: "above",
              value: 10
            }
          ],
          sellRules: [
            {
              indicator: "sma",
              timeframe: "15 minutes",
              period: 30,
              direction: "above",
              value: 2
            }
          ],
          stoploss: 3,
          target: 10
        });
        for (let strategyTmp of strategies) {
          await addStrategy(strategyTmp);
        }
      }
      loadStrategies();
    });
  } catch (err) {
    log("error", "fillDefaultStrategies", err.stack);
  }
}

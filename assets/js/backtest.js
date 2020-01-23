//EasyCryptoBot Copyright (C) 2018 Stefan Hristov

async function btFillBinanceInstruments() {
  await getBinanceInstruments();
}

let btInstrumentMutex = new Mutex();
async function btInstrumentKeyup() {
  try {
    btInstrumentMutex.lock();
    $("#btInstrumentList>ul").html("");
    let instruments = null;
    if ($("#btExchangeCombobox").text() === "Binance") {
      instruments = await getBinanceInstruments();
    } else {
      $("#btInstrumentSearch").val("");
      openModalInfo("Please Choose Exchange First!");
      return;
    }

    let lastKey = null;

    if (instruments !== null) {
      let instrumentsToAdd = "";
      let search = $("#btInstrumentSearch")
        .val()
        .toLowerCase();
      Object.keys(instruments).forEach(function(key) {
        if (key.toLowerCase().indexOf(search) != -1) {
          lastKey = key.toLowerCase();
          instrumentsToAdd += '<li><a href="#/"  onclick="btFillInstrument(\'' + key + "')\">" + key + "</a></li>";
        }
      });
      if (lastKey !== null && lastKey !== search) {
        $("#btInstrumentList>ul").html(instrumentsToAdd);
        $("#btInstrument>div>ul").show();
      }
    }
  } catch (err) {
    log("error", "btInstrumentKeyup", err.stack);
  } finally {
    btInstrumentMutex.release();
  }
}

function btFillInstrument(name) {
  $("#btInstrument>div>ul").hide();
  $("#btInstrumentSearch").val(name);
}

function fillBtTestPeriod() {
  if ($("#btFromDate").val().length > 0) {
    return;
  }
  try {
    let startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    let day = ("0" + startDate.getDate()).slice(-2);
    let month = ("0" + (startDate.getMonth() + 1)).slice(-2);
    let startDateStr = startDate.getFullYear() + "-" + month + "-" + day;
    $("#btFromDate").val(startDateStr);

    let toDate = new Date();
    day = ("0" + toDate.getDate()).slice(-2);
    month = ("0" + (toDate.getMonth() + 1)).slice(-2);
    let toDateStr = toDate.getFullYear() + "-" + month + "-" + day;
    $("#btToDate").val(toDateStr);
  } catch (err) {
    log("error", "fillBtTestPeriod", err.stack);
  }
}

async function editBtStrategy() {
  try {
    let strategyName = $("#btStrategyCombobox").text();
    let strategy = await getStrategyByName(strategyName);
    if (strategy === null) {
      openModalInfo("Please Choose a Strategy to Edit!");
      $("#btStrategyCombobox").html("Choose Strategy");
      return;
    }
    editStrategy(strategyName);
  } catch (err) {
    log("error", "editBtStrategy", err.stack);
  }
}

let btTradesRows = [];
let backtestRunning = false;
function isBacktestRunning() {
  return backtestRunning;
}

async function runBacktest() {
  if (isOptimizationRunning()) {
    openModalInfo("Cannot run backtest while executing strategy optimization!");
    return;
  }
  $("#runBacktestBtn").addClass("disabled");
  cancelBt = false;
  btTradesRows = [];
  let strategyName = $("#btStrategyCombobox").text();
  let exchange = $("#btExchangeCombobox").text();
  let instrument = $("#btInstrumentSearch")
    .val()
    .toUpperCase();
  let startDateStr = $("#btFromDate").val();
  let endDateStr = $("#btToDate").val();
  let feeRate = $("#btFeeSearch").val();
  if (strategyName === "Choose Strategy") {
    openModalInfo("Please Choose a Strategy!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }
  if (exchange === "Choose Exchange") {
    openModalInfo("Please Choose an Exchange!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }
  if (exchange === "Binance") {
    let instruments = await getBinanceInstruments();
    if (!(instrument in instruments)) {
      openModalInfo("Invalid Instrument!<br>Please Choose an Instrument!");
      $("#runBacktestBtn").removeClass("disabled");
      return;
    }
  }
  if (feeRate <= 0) {
    openModalInfo("Fee rate should be a positive number!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }

  let startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    openModalInfo("Please Choose a Start Date!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }
  startDate.setHours(0, 0, 0, 0);
  let endDate = new Date(endDateStr);

  if (isNaN(endDate.getTime())) {
    openModalInfo("Please Choose an End Date!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }
  if (startDate >= endDate) {
    openModalInfo("Start Date must be before End Date!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }
  endDate.setHours(23, 59, 59, 59);
  let endDateTmp = new Date(endDate.getTime());
  endDateTmp.setMonth(endDate.getMonth() - 3);
  endDateTmp.setDate(endDateTmp.getDate() - 1);
  if (startDate < endDateTmp) {
    openModalInfo("The maximum backtest period is 3 months. Please change the selected dates.");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }

  if (startDate >= endDate) {
    openModalInfo("Start Date must be before End Date!");
    $("#runBacktestBtn").removeClass("disabled");
    return;
  }

  try {
    bbColorIndexToUse = 0;
    backtestRunning = true;
    let strategy = await getStrategyByName(strategyName);
    if (strategy === null) {
      openModalInfo("Please Choose a Strategy!");
      $("#btStrategyCombobox").html("Choose Strategy");
      backtestRunning = false;
      $("#runBacktestBtn").removeClass("disabled");
      return;
    }

    $("#btRunPercent").html("Starting Backtest..");
    $("#btCancelDiv").show();
    $("#btRunPercent2").hide();
    $("#btRunRocket").hide();
    $("#btRunning").show();
    $("#btResult").hide();
    $("#btResultNoTrades").hide();
    $("#btTrailingStopWarning").hide();
    $("#btResultDiv").show();
    $("#btStrategiesTable").html(
      "<thead><tr><td>Trade</td><td>Open Date</td><td>Close Date</td><td>Duration</td><td>Open Price</td><td>Close Price</td><td>Result</td></tr></thead><tbody>"
    );

    //get all timeframes
    let timeframes = getTimeframes(strategy);
    if (timeframes === null) {
      $("#runBacktestBtn").removeClass("disabled");
      $("#btRunning").hide();
      $("#btResult").hide();
      openModalInfo("Your strategy contains a rule without a timeframe. Please edit your strategy!");
      backtestRunning = false;
      $("#runBacktestBtn").removeClass("disabled");
      return;
    }

    let ticks = {};
    for (let tf of timeframes) {
      let tfTicks = await getBinanceTicks(
        instrument,
        getShortTimeframe(tf),
        getStartDate(tf, startDate),
        endDate,
        true
      );
      if (tfTicks === null) {
        $("#runBacktestBtn").removeClass("disabled");
        $("#btRunning").hide();
        $("#btResult").hide();
        openModalInfo(
          "Could not optain data from " +
            exchange +
            " for the given period. The period may be too long. Please try with smaller period or try again later!"
        );
        backtestRunning = false;
        $("#runBacktestBtn").removeClass("disabled");
        return;
      }
      ticks[tf] = tfTicks;

      if (cancelBt) {
        backtestRunning = false;
        return;
      }
    }

    if (strategy.trailingSl !== null && !isNaN(strategy.trailingSl)) {
      $("#btTrailingStopWarning").show();
    }
    $("#btRunPercent2").hide();
    $("#btRunPercent").html("Backtest Execution: 0%");
    $("#btRunRocket").show();

    let result = await executeBacktest(strategy, ticks, startDate, true, feeRate * 2);
    if (result === null) {
      $("#btRunning").hide();
      $("#runBacktestBtn").removeClass("disabled");
      backtestRunning = false;
      return;
    }
    let marketReturn = 0;
    let ticksTmp = ticks[timeframes[0]];
    for (let tick of ticksTmp) {
      if (tick.d >= startDate) {
        marketReturn = ((ticksTmp[ticksTmp.length - 1].c - tick.o) / tick.o) * 100;
        break;
      }
    }
    $("#btMaxDrawdown").html(result[0].maxDrawdown.toFixed(2) + "%");
    $("#btMarketReturn").html(marketReturn.toFixed(2) + "%");
    $("#btTotalReturn").html(result[0].totalReturn.toFixed(2) + "%");
    //$('#btWinLoss').html(winLossRatio.toFixed(2));
    $("#btAvgWinLossPerTrade").html(result[0].avgGainLossPerTrade.toFixed(2) + "%");
    $("#btResultWithUsd").html(result[0].resultWithUSD.toFixed(2) + "$");
    $("#btExecutedTrades").html(result[0].executedTrades);

    $("#btWinningTradesP").html(result[0].winningPercent.toFixed(2) + "%");
    $("#btWinningCount").html(result[0].winnignCount);
    $("#btAvgGainPerWinning").html(result[0].avgWinPerTrade.toFixed(2) + "%");
    $("#btBiggestGain").html(result[0].biggestGain.toFixed(2) + "%");

    $("#btLoosingTradesP").html(result[0].loosingPercent.toFixed(2) + "%");
    $("#btLoosingCount").html(result[0].loosingCount);
    $("#btAvgLostPerWinning").html(result[0].avgLostPerTrade.toFixed(2) + "%");
    $("#btBiggestLost").html(result[0].biggestLost.toFixed(2) + "%");

    $("#btStrategyRes").html(strategyName);
    $("#btExchangeRes").html(exchange);
    $("#btInstrumentRes").html(instrument);
    $("#btPeriodFromRes").html(startDateStr);
    $("#btPeriodToRes").html(endDateStr);

    let count = 1;
    for (let trade of result[1]) {
      if (count > 500 && count % 500 === 0) {
        await sleep(0);
      }
      let classes = "";
      let resultClass = "";
      if (trade.result > 0) {
        classes = "text-green fas fa-thumbs-up";
        resultClass = "text-green";
      } else if (trade.result < 0) {
        classes = "text-red fas fa-thumbs-down";
        resultClass = "text-red";
      }

      btTradesRows.push(
        "<tr><td>" +
          count +
          '&nbsp;<i class="' +
          classes +
          '"></td><td>' +
          formatDateFull(trade.openDate) +
          "</td><td>" +
          formatDateFull(trade.closeDate) +
          "</td><td>" +
          getDatesDiff(trade.openDate, trade.closeDate) +
          "</td><td>" +
          trade.entry.toFixed(8) +
          "</td><td>" +
          trade.exit.toFixed(8) +
          '</td><td class="' +
          resultClass +
          '">' +
          trade.result.toFixed(2) +
          "%</td></tr>"
      );
      count++;
    }
    $("#btStrategiesTableNav").html("");
    let rowsShown = 100;
    btResultShowRows(0, 100);
    let rowsTotal = btTradesRows.length;
    let numPages = rowsTotal / rowsShown;
    for (let i = 0; i < numPages; i++) {
      var pageNum = i + 1;
      $("#btStrategiesTableNav").append('<a href="#/" rel="' + i + '">' + pageNum + "</a> ");
    }
    $("#btStrategiesTableNav a:first").addClass("active");
    $("#btStrategiesTableNav a").bind("click", function() {
      $("#btStrategiesTableNav a").removeClass("active");
      $(this).addClass("active");
      let currPage = $(this).attr("rel");
      let startItem = currPage * rowsShown;
      let endItem = startItem + rowsShown;
      btResultShowRows(startItem, endItem);
    });

    $("#btRunPercent").html("Backtest Execution: 100%");
    await sleep(500);
    if (result[0].executedTrades > 0) {
      drawBtResultsChart(startDate, ticks, result[1], strategy, instrument, timeframes, "btResultsChart", result[2]);
      $("#btResult").show();
    } else {
      drawBtResultsChart(
        startDate,
        ticks,
        result[1],
        strategy,
        instrument,
        timeframes,
        "btResultsChartNoTrades",
        result[2]
      );
      $("#btResult").hide();
      $("#btResultNoTrades").show();
    }
    $("#btCancelDiv").hide();
    $("#runBacktestBtn").removeClass("disabled");
    $("#btRunning").hide();
    backtestRunning = false;
  } catch (err) {
    $("#btRunning").hide();
    $("#runBacktestBtn").removeClass("disabled");
    openModalInfo("Internal Error Occurred!<br>" + err.stack);
    backtestRunning = false;
    log("error", "runBacktest", err.stack);
  }
}

function containsIndicator(indicators, indicator) {
  for (let intTmp of indicators) {
    if (indicator.type === "macd" || indicator.type === "sto") {
      if (
        intTmp.type === indicator.type &&
        intTmp.period === indicator.period &&
        intTmp.period2 === indicator.period2 &&
        intTmp.period3 === indicator.period3 &&
        intTmp.timeframe === indicator.timeframe
      ) {
        return true;
      }
    } else if (indicator.type === "stoRsi") {
      if (
        intTmp.type === indicator.type &&
        intTmp.period === indicator.period &&
        intTmp.period2 === indicator.period2 &&
        intTmp.period3 === indicator.period3 &&
        intTmp.period4 === indicator.period4 &&
        intTmp.timeframe === indicator.timeframe
      ) {
        return true;
      }
    } else if (
      intTmp.type === indicator.type &&
      intTmp.period === indicator.period &&
      intTmp.timeframe === indicator.timeframe
    ) {
      return true;
    }
  }
  return false;
}

function getIndicatorsFromRules(indicators, rules) {
  for (let rule of rules) {
    let indTmp = null;
    let indTmp2 = null;
    if (rule.indicator === "sma" || rule.indicator === "ema" || rule.indicator === "rsi") {
      indTmp = {
        type: rule.indicator,
        period: rule.period,
        data: [],
        timeframe: rule.timeframe
      };
    } else if (rule.indicator === "cma") {
      if (rule.type === "SMA") {
        indTmp = {
          type: "sma",
          period: rule.period,
          data: [],
          timeframe: rule.timeframe
        };
      } else {
        indTmp = {
          type: "ema",
          period: rule.period,
          data: [],
          timeframe: rule.timeframe
        };
      }
      if (rule.type2 === "SMA") {
        indTmp2 = {
          type: "sma",
          period: rule.period2,
          data: [],
          timeframe: rule.timeframe
        };
      } else {
        indTmp2 = {
          type: "ema",
          period: rule.period2,
          data: [],
          timeframe: rule.timeframe
        };
      }
    } else if (rule.indicator === "macd") {
      indTmp = {
        type: rule.indicator,
        period: rule.period,
        period2: rule.period2,
        period3: rule.period3,
        data: [],
        data2: [],
        timeframe: rule.timeframe
      };
    } else if (rule.indicator === "bb") {
      indTmp = {
        type: rule.indicator,
        period: rule.period,
        period2: rule.period2,
        data: [],
        data2: [],
        timeframe: rule.timeframe
      };
    } else if (rule.indicator === "sto") {
      indTmp = {
        type: rule.indicator,
        period: rule.period,
        period2: rule.period2,
        period3: rule.period3,
        data: [],
        data2: [],
        timeframe: rule.timeframe
      };
    } else if (rule.indicator === "stoRsi") {
      indTmp = {
        type: rule.indicator,
        period: rule.period,
        period2: rule.period2,
        period3: rule.period3,
        period4: rule.period4,
        data: [],
        data2: [],
        timeframe: rule.timeframe
      };
    }
    if (indTmp !== null && !containsIndicator(indicators, indTmp)) {
      indicators.push(indTmp);
    }
    if (indTmp2 !== null && !containsIndicator(indicators, indTmp2)) {
      indicators.push(indTmp2);
    }
  }
}

function getBtChartButtons(timeframe) {
  switch (timeframe) {
    case "1 minute":
      return [
        {
          type: "hour",
          count: 2,
          text: "2H"
        },
        {
          type: "hour",
          count: 4,
          text: "4H"
        },
        {
          type: "hour",
          count: 12,
          text: "12H"
        },
        {
          type: "day",
          count: 1,
          text: "1D"
        }
      ];
    case "3 minutes":
      return [
        {
          type: "hour",
          count: 6,
          text: "6H"
        },
        {
          type: "hour",
          count: 12,
          text: "12H"
        },
        {
          type: "day",
          count: 1,
          text: "1D"
        },
        {
          type: "week",
          count: 1,
          text: "1W"
        }
      ];
    case "5 minutes":
      return [
        {
          type: "hour",
          count: 12,
          text: "12H"
        },
        {
          type: "day",
          count: 1,
          text: "1D"
        },
        {
          type: "week",
          count: 1,
          text: "1W"
        }
      ];
    case "15 minutes":
    case "30 minutes":
      return [
        {
          type: "day",
          count: 1,
          text: "1D"
        },
        {
          type: "week",
          count: 1,
          text: "1W"
        },
        {
          type: "month",
          count: 1,
          text: "1M"
        }
      ];
    case "1 hour":
    case "2 hours":
      return [
        {
          type: "week",
          count: 1,
          text: "1W"
        },
        {
          type: "month",
          count: 1,
          text: "1M"
        },
        {
          type: "month",
          count: 3,
          text: "3M"
        }
      ];
    case "4 hours":
    case "6 hours":
      return [
        {
          type: "month",
          count: 1,
          text: "1M"
        },
        {
          type: "month",
          count: 3,
          text: "3M"
        },
        {
          type: "all",
          text: "All"
        }
      ];
    case "12 hours":
    case "1 day":
      return [
        {
          type: "month",
          count: 3,
          text: "3M"
        },
        {
          type: "all",
          text: "All"
        }
      ];
  }
}
function drawBtResultsChart(startDate, ticks, trades, strategy, instrument, timeframes, container, lastTrade) {
  try {
    let indicators = [];
    getIndicatorsFromRules(indicators, strategy.buyRules);
    getIndicatorsFromRules(indicators, strategy.sellRules);

    let data = [];

    let dateTmp = new Date();
    let currentTimeZoneOffsetInHours = dateTmp.getTimezoneOffset() / 60;
    Highcharts.setOptions({
      time: {
        timezoneOffset: currentTimeZoneOffsetInHours * 60
      }
    });

    let c = {};
    let f = {};
    let k = {};
    let p = {};
    for (let ft of timeframes) {
      c[ft] = [];
      f[ft] = [];
      k[ft] = [];
      p[ft] = [];
    }

    let bigTfIndex = 0;
    while (ticks[timeframes[0]].length > bigTfIndex) {
      if (ticks[timeframes[0]][bigTfIndex].d > startDate) {
        break;
      }
      c[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      f[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      k[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      p[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);

      bigTfIndex++;
    }

    let smallTfIndex = 0;
    if (timeframes.length > 1) {
      while (ticks[timeframes[1]].length > smallTfIndex) {
        if (ticks[timeframes[1]][smallTfIndex].d > startDate) {
          break;
        }
        c[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].l);
        f[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].l);
        k[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].l);
        p[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].l);
        smallTfIndex++;
      }
    }

    while (ticks[timeframes[0]].length > bigTfIndex) {
      c[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      f[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      k[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      p[timeframes[0]].push(ticks[timeframes[0]][bigTfIndex].l);
      if (timeframes.length > 1) {
        let dateTo = getEndPeriod(ticks[timeframes[0]][bigTfIndex].d, timeframes[0]);
        while (ticks[timeframes[1]].length > smallTfIndex && ticks[timeframes[1]][smallTfIndex].d < dateTo) {
          c[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].c);
          f[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].h);
          k[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].l);
          p[timeframes[1]].push(ticks[timeframes[1]][smallTfIndex].o);

          for (let indicator of indicators) {
            let value = null;
            if (indicator.type === "sma") {
              value = calculateSMA(indicator.period, c[indicator.timeframe]);
            } else if (indicator.type === "ema") {
              value = calculateEMA(indicator.period, c[indicator.timeframe]);
            } else if (indicator.type === "rsi") {
              value = calculateRsi(indicator.period, c[indicator.timeframe]);
            } else if (indicator.type === "macd") {
              value = calculateMacd(indicator.period, indicator.period2, indicator.period3, c[indicator.timeframe]);
              if (value !== null && value[2] !== null && value[2].length > 0) {
                indicator.data2.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[2][value[2].length - 1]]);
              }
            }

            if (value !== null && value[0] !== null) {
              indicator.data.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[0]]);
            }

            if (indicator.type === "bb") {
              value = calculateBB(indicator.period, indicator.period2, c[indicator.timeframe]);
              if (value !== null && value[0] !== null && value[0].length > 0) {
                indicator.data.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[0][1]]);
                indicator.data2.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[0][2]]);
              }
            }
            if (indicator.type === "sto" || indicator.type === "stoRsi") {
              value =
                indicator.type === "sto"
                  ? calculateSto(
                      indicator.period,
                      indicator.period2,
                      indicator.period3,
                      c[indicator.timeframe],
                      f[indicator.timeframe],
                      k[indicator.timeframe]
                    )
                  : calculateStoRsi(
                      indicator.period,
                      indicator.period2,
                      indicator.period3,
                      indicator.period4,
                      c[indicator.timeframe],
                      f[indicator.timeframe],
                      k[indicator.timeframe]
                    );
              if (value !== null && value[0] !== null && value[0].length > 0) {
                indicator.data.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[0][0]]);
                indicator.data2.push([ticks[timeframes[1]][smallTfIndex].d.getTime(), value[1][0]]);
              }
            }
          }
          data.push([
            ticks[timeframes[1]][smallTfIndex].d.getTime(),
            ticks[timeframes[1]][smallTfIndex].l,
            ticks[timeframes[1]][smallTfIndex].l,
            ticks[timeframes[1]][smallTfIndex].l,
            ticks[timeframes[1]][smallTfIndex].l
          ]);
          smallTfIndex++;
        }
      } else {
        for (let indicator of indicators) {
          let value = null;
          if (indicator.type === "sma") {
            value = calculateSMA(indicator.period, c[indicator.timeframe]);
          } else if (indicator.type === "ema") {
            value = calculateEMA(indicator.period, c[indicator.timeframe]);
          } else if (indicator.type === "rsi") {
            value = calculateRsi(indicator.period, c[indicator.timeframe]);
          } else if (indicator.type === "macd") {
            value = calculateMacd(indicator.period, indicator.period2, indicator.period3, c[indicator.timeframe]);
            if (value !== null && value[2] !== null && value[2].length > 0) {
              indicator.data2.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[2][value[2].length - 1]]);
            }
          }
          if (value !== null && value[0] !== null) {
            indicator.data.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[0]]);
          }
          if (indicator.type === "bb") {
            value = calculateBB(indicator.period, indicator.period2, c[indicator.timeframe]);
            if (value !== null && value[0] !== null && value[0].length > 0) {
              indicator.data.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[0][1]]);
              indicator.data2.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[0][2]]);
            }
          }

          if (indicator.type === "sto" || indicator.type === "stoRsi") {
            value =
              indicator.type === "sto"
                ? calculateSto(
                    indicator.period,
                    indicator.period2,
                    indicator.period3,
                    c[indicator.timeframe],
                    f[indicator.timeframe],
                    k[indicator.timeframe]
                  )
                : calculateStoRsi(
                    indicator.period,
                    indicator.period2,
                    indicator.period3,
                    indicator.period4,
                    c[indicator.timeframe],
                    f[indicator.timeframe],
                    k[indicator.timeframe]
                  );
            if (value !== null && value[0] !== null && value[0].length > 0) {
              indicator.data.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[0][0]]);
              indicator.data2.push([ticks[timeframes[0]][bigTfIndex].d.getTime(), value[1][0]]);
            }
          }
        }
        data.push([
          ticks[timeframes[0]][bigTfIndex].d.getTime(),
          ticks[timeframes[0]][bigTfIndex].o,
          ticks[timeframes[0]][bigTfIndex].h,
          ticks[timeframes[0]][bigTfIndex].l,
          ticks[timeframes[0]][bigTfIndex].c
        ]);
      }
      bigTfIndex++;
    }

    let openTrades = [];
    let closeTrades = [];
    let tradeCount = 1;
    for (let trade of trades) {
      openTrades.push({
        x: trade.openDate.getTime(),
        y: trade.entry,
        title:
          "Open Trade " +
          tradeCount +
          "<br>Date: " +
          formatDateFull(trade.openDate) +
          "<br>Price: " +
          trade.entry.toFixed(8)
      });
      closeTrades.push({
        x: trade.closeDate.getTime(),
        y: trade.exit,
        title:
          "Close Trade " +
          tradeCount +
          "<br>Date: " +
          formatDateFull(trade.closeDate) +
          "<br>Price: " +
          trade.entry.toFixed(8) +
          "<br>Result: " +
          trade.result.toFixed(2) +
          "%"
      });
      tradeCount++;
    }
    if (lastTrade !== null) {
      openTrades.push({
        x: lastTrade.openDate.getTime(),
        y: lastTrade.entry,
        title:
          "Open Trade " +
          tradeCount +
          "<br>Date: " +
          formatDateFull(lastTrade.openDate) +
          "<br>Price: " +
          lastTrade.entry.toFixed(8)
      });
    }

    let series = [];
    series.push({
      id: "main-series",
      type: "candlestick",
      name: instrument + " " + instrument.timeframe,
      data: data,
      dataGrouping: {
        enabled: false
      }
    });
    series.push({
      type: "scatter",
      name: "Opened Trades",
      data: openTrades,
      yAxis: 0,
      marker: {
        enabled: true,
        symbol: "triangle",
        radius: 7,
        fillColor: "#09c459"
      },
      dataGrouping: {
        enabled: false
      }
    });
    series.push({
      type: "scatter",
      name: "Closed Trades",
      data: closeTrades,
      yAxis: 0,
      marker: {
        enabled: true,
        symbol: "triangle-down",
        radius: 7,
        fillColor: "#C0392B"
      },
      dataGrouping: {
        enabled: false
      }
    });
    let freeYaxis = 1;
    let rsiYasxix = null;
    let macdYasxix = null;
    let stoYasxix = null;
    let containsSecondAxisIndicators = false;
    for (let indicator of indicators) {
      if (indicator.type === "rsi") {
        if (rsiYasxix === null) {
          rsiYasxix = freeYaxis;
          freeYaxis++;
        }
        containsSecondAxisIndicators = true;
        series.push({
          name: indicator.type + "_" + indicator.period + " " + indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: rsiYasxix,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data
        });
      } else if (indicator.type === "macd") {
        containsSecondAxisIndicators = true;
        let hasSignalLine = indicator.data2 !== undefined && indicator.data2.length > 0;
        let period3 = hasSignalLine ? "," + indicator.period3 : "";
        if (macdYasxix === null) {
          macdYasxix = freeYaxis;
          freeYaxis++;
        }
        series.push({
          name:
            indicator.type +
            "_" +
            indicator.period +
            "," +
            indicator.period2 +
            period3 +
            " " +
            indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: macdYasxix,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data
        });
        if (hasSignalLine) {
          series.push({
            name:
              indicator.type +
              "_" +
              indicator.period +
              "," +
              indicator.period2 +
              period3 +
              " Signal Line " +
              indicator.timeframe.replace(" ", "_"),
            type: "spline",
            yAxis: macdYasxix,
            dataGrouping: {
              enabled: false
            },
            data: indicator.data2
          });
        }
      } else if (indicator.type === "bb") {
        let color = getNextBBColor();
        series.push({
          name:
            "Bollinger_Upper_Band_" +
            indicator.period +
            "," +
            indicator.period2 +
            " " +
            indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: 0,
          color: color,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data
        });
        series.push({
          name:
            "Bollinger_Lower_Band_" +
            indicator.period +
            "," +
            indicator.period2 +
            " " +
            indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: 0,
          color: color,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data2
        });
      } else if (indicator.type === "sto" || indicator.type === "stoRsi") {
        containsSecondAxisIndicators = true;

        if (stoYasxix === null) {
          stoYasxix = freeYaxis;
          freeYaxis++;
        }
        series.push({
          name:
            indicator.type +
            "_" +
            indicator.period +
            "," +
            indicator.period2 +
            "," +
            indicator.period3 +
            " %K " +
            indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: stoYasxix,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data
        });
        series.push({
          name:
            indicator.type +
            "_" +
            indicator.period +
            "," +
            indicator.period2 +
            "," +
            indicator.period3 +
            " %D " +
            indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: stoYasxix,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data2
        });
      } else {
        series.push({
          name: indicator.type + "_" + indicator.period + " " + indicator.timeframe.replace(" ", "_"),
          type: "spline",
          yAxis: 0,
          dataGrouping: {
            enabled: false
          },
          data: indicator.data
        });
      }
    }
    let yAxis = containsSecondAxisIndicators
      ? [
          {
            crosshair: false,
            height: "80%",
            startOnTick: false,
            endOnTick: false,
            resize: {
              enabled: true
            }
          },
          {
            crosshair: false,
            height: "19%",
            top: "81%",
            startOnTick: false,
            endOnTick: false,
            resize: {
              enabled: true
            }
          },
          {
            crosshair: false,
            height: "14%",
            top: "86%",
            startOnTick: false,
            endOnTick: false,
            resize: {
              enabled: true
            }
          }
        ]
      : {
          crosshair: false,
          startOnTick: false,
          endOnTick: false,
          resize: {
            enabled: true
          }
        };
    let buttons = getBtChartButtons(timeframes[timeframes.length - 1]);
    let chart = Highcharts.stockChart(container, {
      rangeSelector: {
        buttons: buttons,
        selected: 0,
        inputEnabled: false
      },
      title: {
        text: instrument + " " + timeframes[timeframes.length - 1]
      },
      xAxis: {
        crosshair: false
      },

      yAxis: yAxis,

      plotOptions: {
        scatter: {
          tooltip: {
            pointFormat: "{point.title}"
          }
        },
        series: {
          stickyTracking: false,
          showInLegend: true,
          gapSize: null,
          marker: {
            enabled: false
          }
        }
      },
      tooltip: {
        snap: 0
      },
      legend: {
        enabled: true
      },
      series: series
    });
  } catch (err) {
    log("error", "drawBtResultsChart", err.stack);
  }
}
function btResultShowRows(from, to) {
  $("#btStrategiesTable").html(
    "<thead><tr><td>Trade</td><td>Open Date</td><td>Close Date</td><td>Duration</td><td>Open Price</td><td>Close Price</td><td>Result</td></tr></thead><tbody>"
  );
  for (let i = from; i < Math.min(btTradesRows.length, to); i++) {
    $("#btStrategiesTable").append(btTradesRows[i]);
  }
  $("#btStrategiesTable").append("</tbody>");
}
let bbColors = ["#8cffa1", "#95afdb", "#cea28a", "#ea6ec9", "#96231f", "#66acad"];
let bbColorIndexToUse = 0;

function getNextBBColor() {
  if (bbColorIndexToUse == bbColors.length) {
    bbColorIndexToUse = 0;
  }
  let result = bbColors[bbColorIndexToUse];
  bbColorIndexToUse++;
  return result;
}
let cancelBt = false;
async function btCancel() {
  $("#btCancelBtn").addClass("disabled");
  cancelBt = true;
  cancelBacktest();
  cancelGetBinanceData();
  while (isBacktestRunning()) {
    await sleep(500);
  }
  $("#btResultDiv").hide();
  $("#btExecInfo").show();
  $("#runBacktestBtn").removeClass("disabled");
  $("#btCancelBtn").removeClass("disabled");
}

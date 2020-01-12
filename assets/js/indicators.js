//EasyCryptoBot Copyright (C) 2018 Stefan Hristov
function checkTradeRules(rules, closePricesAll, highPricesAll, lowPricesAll) {
  if (rules === null || rules === undefined || rules.length === 0) {
    return false;
  }
  let rulesMet = 0;
  for (let rule of rules) {
    let closePrices = closePricesAll[rule.timeframe];
    let highPrices = highPricesAll[rule.timeframe];
    let lowPrices = lowPricesAll[rule.timeframe];
    if (closePrices.length < 2) {
      return false;
    }
    if (rule.indicator === "sma" || rule.indicator === "ema") {
      let ma =
        rule.indicator === "sma" ? calculateSMA(rule.period, closePrices) : calculateEMA(rule.period, closePrices);
      if (ma === null) {
        break;
      }
      if (rule.direction === "above") {
        if (closePrices[closePrices.length - 1] > ma[0] * (1 + rule.value / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "below" || rule.direction === "bellow") {
        if (closePrices[closePrices.length - 1] < ma[0] * (1 - rule.value / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "crossing") {
        if (
          rule.crossDirection === "top to bottom" &&
          closePrices[closePrices.length - 2] >= ma[1] &&
          closePrices[closePrices.length - 1] < ma[0]
        ) {
          rulesMet++;
          continue;
        } else if (
          rule.crossDirection === "bottom to top" &&
          closePrices[closePrices.length - 2] <= ma[1] &&
          closePrices[closePrices.length - 1] > ma[0]
        ) {
          rulesMet++;
          continue;
        }
      }
    } else if (rule.indicator === "cma") {
      let ma1 = rule.type === "SMA" ? calculateSMA(rule.period, closePrices) : calculateEMA(rule.period, closePrices);
      let ma2 =
        rule.type2 === "SMA" ? calculateSMA(rule.period2, closePrices) : calculateEMA(rule.period2, closePrices);
      if (ma1 === null || ma2 === null) {
        break;
      }
      if (rule.crossDirection === "top to bottom" && ma1[1] >= ma2[1] && ma1[0] < ma2[0]) {
        rulesMet++;
        continue;
      } else if (rule.crossDirection === "bottom to top" && ma1[1] <= ma2[1] && ma1[0] > ma2[0]) {
        rulesMet++;
        continue;
      }
    } else if (rule.indicator === "rsi") {
      let rsi = calculateRsi(rule.period, closePrices);
      if (rsi === null) {
        break;
      }
      if (rule.direction === "above") {
        if (rsi[0] > rule.value) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "below" || rule.direction === "bellow") {
        if (rsi[0] < rule.value) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "crossing") {
        if (rule.crossDirection === "top to bottom" && rsi[1] >= rule.value && rsi[0] < rule.value) {
          rulesMet++;
          continue;
        } else if (rule.crossDirection === "bottom to top" && rsi[1] <= rule.value && rsi[0] > rule.value) {
          rulesMet++;
          continue;
        }
      }
    } else if (rule.indicator === "macd") {
      let macd = calculateMacd(rule.period, rule.period2, rule.period3, closePrices);
      if (macd === null) {
        break;
      }
      let lineValue = 0;
      let lineValue2 = 0;
      let ruleValue = 0;
      if (rule.type === "signal line") {
        if (macd[2] === null || macd[2].length < 2) {
          break;
        }
        lineValue = macd[2][macd[2].length - 1];
        lineValue2 = macd[2][macd[2].length - 2];
        ruleValue = rule.value;
      }

      if (rule.direction === "above") {
        if (macd[0] > lineValue * (1 + ruleValue / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "below" || rule.direction === "bellow") {
        if (macd[0] < lineValue * (1 - ruleValue / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "crossing") {
        if (rule.crossDirection === "top to bottom" && macd[1] >= lineValue2 && macd[0] < lineValue) {
          rulesMet++;
          continue;
        } else if (rule.crossDirection === "bottom to top" && macd[1] <= lineValue2 && macd[0] > lineValue) {
          rulesMet++;
          continue;
        }
      }
    } else if (rule.indicator === "bb") {
      let bb = calculateBB(rule.period, rule.period2, closePrices);
      let bandValue = 0;
      let bandValue2 = 0;
      if (rule.type === "upper band") {
        bandValue = bb[0][1];
        bandValue2 = bb[1][1];
      } else {
        bandValue = bb[0][2];
        bandValue2 = bb[1][2];
      }

      if (rule.direction === "above") {
        if (closePrices[closePrices.length - 1] > bandValue * (1 + rule.value / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "below" || rule.direction === "bellow") {
        if (closePrices[closePrices.length - 1] < bandValue * (1 - rule.value / 100)) {
          rulesMet++;
          continue;
        }
      } else if (rule.direction === "crossing") {
        if (
          rule.crossDirection === "top to bottom" &&
          closePrices[closePrices.length - 2] >= bandValue2 &&
          closePrices[closePrices.length - 1] < bandValue
        ) {
          rulesMet++;
          continue;
        } else if (
          rule.crossDirection === "bottom to top" &&
          closePrices[closePrices.length - 2] <= bandValue2 &&
          closePrices[closePrices.length - 1] > bandValue
        ) {
          rulesMet++;
          continue;
        }
      }
    } else if (rule.indicator === "sto" || rule.indicator === "stoRsi") {
      let sto =
        rule.indicator === "sto"
          ? calculateSto(rule.period, rule.period2, rule.period3, closePrices, highPrices, lowPrices)
          : calculateStoRsi(rule.period, rule.period2, rule.period3, rule.period4, closePrices);
      if (sto === null) {
        break;
      }
      let kLine = sto[0];
      let dLine = sto[1];

      if (rule.direction === "crossing") {
        if ((rule.type === "above" && kLine[0] > rule.value) || (rule.type === "below" && kLine[0] < rule.value)) {
          if (rule.crossDirection === "top to bottom" && kLine[1] >= dLine[1] && kLine[0] < dLine[0]) {
            rulesMet++;
            continue;
          } else if (rule.crossDirection === "bottom to top" && kLine[1] <= dLine[1] && kLine[0] > dLine[0]) {
            rulesMet++;
            continue;
          }
        }
      } else if (
        (rule.direction === "above" && kLine[0] > rule.value) ||
        (rule.direction === "below" && kLine[0] < rule.value)
      ) {
        rulesMet++;
        continue;
      }
    }
  }
  return rulesMet === rules.length;
}
const rounder = 0.8;

function calculateSMA(smaPeriod, closePrices) {
  if (closePrices.length <= smaPeriod) {
    return null;
  }
  let sum = 0;
  for (let i = closePrices.length - smaPeriod; i < closePrices.length - 1; i++) {
    sum += closePrices[i];
  }
  return [
    parseFloat(((sum + closePrices[closePrices.length - smaPeriod - 1]) / smaPeriod).toFixed(8)),
    parseFloat(((sum + closePrices[closePrices.length - 1]) / smaPeriod).toFixed(8))
  ];
}

function calculateEMA(emaPeriod, closePrices) {
  let periodsToUse = 300;
  if (emaPeriod < 150) {
    periodsToUse = 250;
  } else if (emaPeriod < 100) {
    periodsToUse = 200;
  } else if (emaPeriod < 50) {
    periodsToUse = 100;
  }

  if (closePrices.length <= emaPeriod || closePrices.length < periodsToUse) {
    return null;
  }
  let multiplier = 2 / (emaPeriod + 1);
  let emaPrev = closePrices[closePrices.length - periodsToUse];
  for (let i = closePrices.length - (periodsToUse - 1); i < closePrices.length - 1; i++) {
    emaPrev = (closePrices[i] - emaPrev) * multiplier + emaPrev;
  }
  let ema = (closePrices[closePrices.length - 1] - emaPrev) * multiplier + emaPrev;
  return [parseFloat(emaPrev.toFixed(8)), parseFloat(ema.toFixed(8))];
}

function calculateRs(period, array) {
  let multiplier = 1 / period;
  let ema = array[0];
  for (let i = 1; i < array.length; i++) {
    let closePrice = array[i];
    ema = (closePrice - ema) * multiplier + ema;
  }
  return ema * rounder;
}

function calculateRsi(rsiPeriod, closePrices) {
  if (closePrices.length <= rsiPeriod || closePrices.length < 100) {
    return null;
  }

  let avgGain = [];
  let avgLoss = [];
  let prevClose = closePrices[closePrices.length - 100];
  for (let i = closePrices.length - 99; i < closePrices.length - 1; i++) {
    let change = closePrices[i] - prevClose;
    if (change > 0) {
      avgGain.push(change);
      avgLoss.push(0);
    } else if (change < 0) {
      avgGain.push(0);
      avgLoss.push(Math.abs(change));
    }
    prevClose = closePrices[i];
  }

  let avgGainFinalPrev = calculateRs(rsiPeriod, avgGain);
  let avgLossFinalPrev = calculateRs(rsiPeriod, avgLoss);

  let change = closePrices[closePrices.length - 1] - prevClose;
  if (change > 0) {
    avgGain.push(change);
    avgLoss.push(0);
  } else if (change < 0) {
    avgGain.push(0);
    avgLoss.push(Math.abs(change));
  }

  let avgGainFinal = calculateRs(rsiPeriod, avgGain);
  let avgLossFinal = calculateRs(rsiPeriod, avgLoss);

  let rsi = 100 - 100 / (1 + avgGainFinal / avgLossFinal);
  let rsiPrev = 100 - 100 / (1 + avgGainFinalPrev / avgLossFinalPrev);
  return [parseFloat(rsiPrev.toFixed(8)), parseFloat(rsi.toFixed(8))];
}

function calculateEMAFull(emaPeriod, closePrices, count) {
  if (closePrices.length <= emaPeriod || closePrices.length < count) {
    return null;
  }
  let multiplier = 2 / (emaPeriod + 1);
  let emaPrev = closePrices[closePrices.length - count];
  let emas = [];
  for (let i = closePrices.length - count; i < closePrices.length - 1; i++) {
    emaPrev = (closePrices[i] - emaPrev) * multiplier + emaPrev;
    emas.push(parseFloat(emaPrev.toFixed(8)));
  }

  let ema = (closePrices[closePrices.length - 1] - emaPrev) * multiplier + emaPrev;
  emas.push(parseFloat(ema.toFixed(8)));

  return emas;
}

function calculateMacd(period, period2, period3, closePrices) {
  let emasCount = period3 === undefined ? 100 : period3 + 70;
  let fastEma = calculateEMAFull(period, closePrices, emasCount);
  let slowEma = calculateEMAFull(period2, closePrices, emasCount);
  if (fastEma === null || slowEma === null || fastEma.length < 1 || slowEma.length < 1) {
    return null;
  }
  let macd = [];

  let fastEmaIndex = fastEma.length - 1;
  let slowEmaIndex = slowEma.length - 1;
  for (let i = 0; i < emasCount; i++) {
    if (fastEmaIndex < 0 || slowEmaIndex < 0) {
      break;
    }
    macd.push(fastEma[fastEmaIndex] - slowEma[slowEmaIndex]);
    fastEmaIndex--;
    slowEmaIndex--;
  }
  macd = macd.reverse();
  let signal = null;
  if (period3 !== undefined) {
    signal = calculateEMAFull(period3, macd, 30);
  }

  return [parseFloat(macd[macd.length - 2].toFixed(8)), parseFloat(macd[macd.length - 1].toFixed(8)), signal];
}

function calculateBB(period, stdDev, closePrices) {
  if (closePrices.length <= period + 1) {
    return null;
  }
  let sma = calculateSMA(period, closePrices);

  let dataPrev = [];
  let data = [];
  dataPrev.push(closePrices[closePrices.length - 1 - period]);
  data.push(closePrices[closePrices.length - 1]);
  for (let i = closePrices.length - 2; i > closePrices.length - 1 - period; i--) {
    dataPrev.push(closePrices[i]);
    data.push(closePrices[i]);
  }
  let prevStdDev1 = calculateStdDev(dataPrev);
  let stdDev1 = calculateStdDev(data);

  return [
    [sma[1], parseFloat((sma[1] + stdDev1 * stdDev).toFixed(8)), parseFloat((sma[1] - stdDev1 * stdDev).toFixed(8))],
    [
      sma[0],
      parseFloat((sma[0] + prevStdDev1 * stdDev).toFixed(8)),
      parseFloat((sma[0] - prevStdDev1 * stdDev).toFixed(8))
    ]
  ];
}

function calculateStdDev(data) {
  let avg = calculateAvg(data);

  let squareDiffs = data.map(function(value) {
    let diff = value - avg;
    return diff * diff;
  });

  let avgSquareDiff = calculateAvg(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

function calculateAvg(data) {
  let sum = data.reduce(function(sum, value) {
    return sum + value * rounder;
  }, 0);

  return (sum / data.length) * rounder;
}

function calculateStoKLine(startIndex, endIndex, closePrices, highPrices, lowPrices) {
  let max = highPrices[startIndex];
  let min = lowPrices[startIndex];
  let count = 1;
  for (let i = startIndex + 1; i <= endIndex; i++) {
    count++;
    if (max < highPrices[i]) {
      max = highPrices[i];
    }
    if (min > lowPrices[i]) {
      min = lowPrices[i];
    }
  }
  return parseFloat(((closePrices[endIndex] - min) / (max - min)).toFixed(8)) * 100;
}

function calculateStoSmoothK(offset, kPeriod, smoothPeriod, closePrices, highPrices, lowPrices) {
  let kLineData = [];
  for (let i = closePrices.length - smoothPeriod - offset; i < closePrices.length - offset; i++) {
    kLineData.push(calculateStoKLine(i - kPeriod + 1, i, closePrices, highPrices, lowPrices));
  }

  let sum = 0;
  for (let i = 0; i < kLineData.length; i++) {
    sum += kLineData[i] * rounder;
  }
  return parseFloat((sum / smoothPeriod).toFixed(8));
}

function calculateSto(kPeriod, dPeriod, smoothPeriod, closePrices, highPrices, lowPrices) {
  if (closePrices.length <= kPeriod + smoothPeriod) {
    return null;
  }
  kLineSmoothedData = [];
  for (let i = 0; i < dPeriod + 1; i++) {
    kLineSmoothedData.push(calculateStoSmoothK(i, kPeriod, smoothPeriod, closePrices, highPrices, lowPrices));
  }

  let dLine = kLineSmoothedData[0];
  let dLinePrev = kLineSmoothedData[kLineSmoothedData.length - 1];
  for (let i = 1; i < dPeriod; i++) {
    dLine += kLineSmoothedData[i];
    dLinePrev += kLineSmoothedData[i];
  }

  dLine = Number.parseFloat((dLine / dPeriod).toFixed(8));
  dLinePrev = Number.parseFloat((dLinePrev / dPeriod).toFixed(8));
  return [
    [kLineSmoothedData[0], kLineSmoothedData[1]],
    [dLine, dLinePrev]
  ];
}

function calculateStoRsi(kPeriod, dPeriod, smoothPeriod, rsiPeriod, closePrices) {
  let rsi = [];
  let newclosePrices = [];
  for (let i = closePrices.length - kPeriod - rsiPeriod - 100; i < closePrices.length - kPeriod - rsiPeriod; i++) {
    newclosePrices.push(closePrices[i]);
  }
  for (let i = closePrices.length - kPeriod - rsiPeriod; i < closePrices.length; i++) {
    newclosePrices.push(closePrices[i]);
    rsi.push(calculateRsi(rsiPeriod, newclosePrices)[0]);
  }

  return calculateSto(kPeriod, dPeriod, smoothPeriod, rsi, rsi, rsi);
}

module.exports = {
  checkTradeRules: checkTradeRules
};

const Datastore = require("nedb");
const shell = require("electron").shell;
const { app, BrowserWindow, clipboard, remote } = require("electron");
const os = require("os");

const Highcharts = require("highcharts/highstock");
//require('highcharts/indicators/indicators')(Highcharts);
//require('highcharts/indicators/ema')(Highcharts);
//require('highcharts/indicators/rsi')(Highcharts);
var fs = require("original-fs");
//const fs = require('fs');
const { ipcRenderer } = require("electron");
//remote.getCurrentWindow().toggleDevTools()
var eulaDb = new Datastore({
  filename: getAppDataFolder() + "/db/eula.db",
  autoload: true
});

var supporterDb = new Datastore({
  filename: getAppDataFolder() + "/db/stats.db",
  autoload: true
});

function log(type, func, msg) {
  try {
    let line = formatDateFull(new Date()) + " | " + type + " | " + func + " | " + msg + "\n";
    fs.appendFileSync(getLogFilename(), line);
  } catch (err) {}
}

function getLogFilename() {
  let dateNow = new Date();
  return getAppDataFolder() + "/logs/log_" + dateNow.getFullYear() + addZero(dateNow.getMonth() + 1) + ".txt";
}

let confirmOkFunc = null;
let confirmCalcelFunc = null;
let modalInfoFunc = null;

function openModalAccept(msg, okFunc, calcelFunc) {
  $("#modalConfirm").removeClass("modal-big");
  $("#modalConfirm").addClass("modal-small");
  $("#modalConfirmOk").html("Accept");
  openModalConfirmImpl(msg, okFunc, calcelFunc);
}

function openModalAcceptBig(msg, okFunc, calcelFunc) {
  $("#modalConfirm").removeClass("modal-small");
  $("#modalConfirm").addClass("modal-big");
  $("#modalConfirmOk").html("Accept");
  openModalConfirmImpl(msg, okFunc, calcelFunc);
}

function openModalConfirmBig(msg, okFunc, calcelFunc) {
  $("#modalConfirm").removeClass("modal-small");
  $("#modalConfirm").addClass("modal-big");
  $("#modalConfirmOk").html("OK");
  openModalConfirmImpl(msg, okFunc, calcelFunc);
}

function openModalConfirm(msg, okFunc, calcelFunc) {
  $("#modalConfirm").removeClass("modal-big");
  $("#modalConfirm").addClass("modal-small");
  $("#modalConfirmOk").html("OK");
  openModalConfirmImpl(msg, okFunc, calcelFunc);
}

function openModalConfirmYes(msg, okFunc, calcelFunc) {
  $("#modalConfirm").removeClass("modal-big");
  $("#modalConfirm").addClass("modal-small");
  $("#modalConfirmOk").html("Yes");
  openModalConfirmImpl(msg, okFunc, calcelFunc);
}

function openModalConfirmImpl(msg, okFunc, calcelFunc) {
  openModals();
  $("#modalConfirm").css("display", "flex");
  $("#modalConfirm>div>div").html(msg);
  $("#modalConfirm").focus();
  if (typeof okFunc === "function") {
    confirmOkFunc = okFunc;
  } else {
    confirmOkFunc = null;
  }
  if (typeof calcelFunc === "function") {
    confirmCalcelFunc = calcelFunc;
  } else {
    confirmCalcelFunc = null;
  }
}

function openModalInfo(msg, func) {
  $("#modalInfo").removeClass("modal-big");
  $("#modalInfo").addClass("modal-small");
  openModalInfoImpl(msg, func);
}

function openModalInfoBig(msg, func) {
  $("#modalInfo").removeClass("modal-small");
  $("#modalInfo").addClass("modal-big");
  openModalInfoImpl(msg, func);
}

function openModals() {
  $(".modal-big").hide();
  $(".modal-small").hide();
  $("#modalLoading").hide();

  if (
    $("#newStrategyWindow").is(":visible") ||
    $("#executionResultsWindow").is(":visible") ||
    $("#editExecutionWindow").is(":visible")
  ) {
    $("#wrapper").css("opacity", "0.2");
    $("#footer").css("opacity", "0.2");

    $("#wrapperModals").css("opacity", "0.7");
    $("#wrapperModals").css("pointer-events", "none");
  } else {
    $("#wrapper").css("opacity", "0.5");
    $("#footer").css("opacity", "0.5");
  }
  $("#footer").css("pointer-events", "none");
  $("#wrapper").css("pointer-events", "none");
  $("#sidebar").css("pointer-events", "none");
}

function openModalInfoImpl(msg, func) {
  openModals();
  $("#modalInfo").css("display", "flex");
  $("#modalInfo>div>div").html(msg);
  if (typeof func === "function") {
    modalInfoFunc = func;
  } else {
    modalInfoFunc = null;
  }
}

function showLoading() {
  openModals();
  $("#modalLoading").css("display", "flex");
}

function hideLoading() {
  if ($("#modalLoading").is(":visible")) {
    if (
      !$("#newStrategyWindow").is(":visible") &&
      !$("#executionResultsWindow").is(":visible") &&
      !$("#editExecutionWindow").is(":visible")
    ) {
      $("#wrapper").css("opacity", "1");
      $("#wrapper").css("pointer-events", "auto");
      $("#footer").css("opacity", "1");
      $("#footer").css("pointer-events", "auto");
      $("#wrapper").css("pointer-events", "auto");
      $("#sidebar").css("opacity", "1");
      $("#sidebar").css("pointer-events", "auto");
    } else {
      $("#footer").css("opacity", "0.5");
      $("#wrapper").css("opacity", "0.5");
    }
    $("#wrapperModals").css("opacity", "1");
    $("#wrapperModals").css("pointer-events", "auto");
    $("#modalLoading").hide();
  }
}

function getEula() {
  return new Promise((resolve, reject) => {
    eulaDb.findOne({}).exec((error, eula) => {
      if (error) {
        reject(error);
      } else {
        resolve(eula);
      }
    });
  });
}

function getSupporterStatus() {
  return new Promise((resolve, reject) => {
    supporterDb.findOne({}).exec((error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve(stats);
      }
    });
  });
}

function rmUserSupporterKey() {
  return new Promise((resolve, reject) => {
    supporterDb.remove({}, { multi: true }, function(err, numRemoved) {
      resolve(true);
    });
  });
}

async function storeUserSupporterKey(key) {
  await rmUserSupporterKey();
  return new Promise((resolve, reject) => {
    supporterDb.insert(
      {
        supporter: key
      },
      (error, srt) => {
        if (error) {
          reject(error);
        } else {
          resolve(srt);
        }
      }
    );
  });
}

ipcRenderer.on("download complete", (event, file) => {
  try {
    const newSar = getAppDataFolder() + "/update/app.asar";
    const oldSar = remote.app.getAppPath();
    const source = fs.createReadStream(newSar);
    const dest = fs.createWriteStream(oldSar, {
      flags: "w+",
      mode: 0664
    });
    source.on("end", async function() {
      await removeFile(newSar);
      openModalConfirm(
        "Update was completed!<br>Please restart the app to get the new features!<br>Restart now?",
        async function() {
          suttingDown = true;
          showLoading();
          await stopAllExecutions();
          ipcRenderer.send("relaunch");
        }
      );
    });
    source.on("error", function(err) {
      cannotUpdateInfo();
    });
    source.pipe(dest);
  } catch (err) {
    log("error", "ipcRenderer.on download complete", err.stack);
    openModalInfo("Could not update. Error: " + err.stack);
  }
});

function sendConnectionLost() {
  ipcRenderer.send("connection-error");
}

let suttingDown = false;
ipcRenderer.on("shutdown", async (event, file) => {
  if (suttingDown) {
    openModalInfo("EasyCryptoBot is shutting down.<br>Please wait..", function() {
      showLoading();
    });
  } else {
    openModalConfirmYes("Do you really want to quit?", async function() {
      try {
        suttingDown = true;
        await stopAllExecutions();
      } catch (err) {
        log("error", "ipcRenderer.on shutdown", err.stack);
      } finally {
        ipcRenderer.send("shutdown");
      }
    });
  }
});

function cannotUpdateInfo() {
  const newSar = getAppDataFolder() + "/update/app.asar";
  const oldSar = remote.app.getAppPath();
  openModalInfoBig(
    'Could not update. It seems that the app does not have permition to apply the update. In order to update you need to manually copy file "<span class="one-click-select">' +
      newSar +
      '</span>" and paste it here: "<span class="one-click-select">' +
      oldSar +
      '</span>".'
  );
}

process
  .on("uncaughtException", function(error) {
    ipcRenderer.send("shutdown");
    if (error.message.indexOf("operation not permitted, open") !== -1) {
      //We enter here when updating the app without permitions for the app folder.
      cannotUpdateInfo();
    } else {
      openModalInfoBig(
        "An unexpected error occurred. The app will close itself.<br>Please send the following error to me at stefan@easycryptobot.com so I can fix it.<br><br>" +
          error.message,
        function() {
          ipcRenderer.send("shutdown");
        },
        function() {
          ipcRenderer.send("shutdown");
        }
      );
    }
  })
  .on("unhandledRejection", (reason, p) => {
    openModalInfoBig(
      "An unexpected error occurred. The app will close itself.<br>Please send the following error to me at stefan@easycryptobot.com so I can fix it.<br><br>" +
        reason +
        "<br>" +
        p,
      function() {
        ipcRenderer.send("shutdown");
      },
      function() {
        ipcRenderer.send("shutdown");
      }
    );
  });

async function downloadUpdates() {
  openModalInfo("Downloading an Update..");
  const file = getAppDataFolder() + "/update/app.asar";
  try {
    await removeFile(file);
  } catch (err) {}
  ipcRenderer.send("download", {
    url: "",
    properties: {
      directory: getAppDataFolder() + "/update"
    }
  });
}

async function hourlyCheckForUpdates() {
  while (true) {
    await sleep(1000 * 60 * 60 * 4); // 4 Hours
    checkForUpdates(
      {
        type: "hourly-check"
      },
      false,
      false
    );
  }
}

function showUpdateMsg(curVersion, latestVersion) {
  let curSplited = curVersion.split(".");
  let latestSplited = latestVersion.split(".");
  if (curSplited[0] === latestSplited[0]) {
    let random = Math.floor(Math.random() * 8999999999 + 1000000000);
    openModalConfirm(
      "<h3>An update is available!</h3><br>Check on the button below to see what is new since your current version " +
        curVersion +
        '<br> <a href="' +
        random +
        '" target="_blank" class="button alt white">Update Info</a><br><br><h3>Update now?</h3>',
      function() {
        downloadUpdates();
      }
    );
  } else {
    let random = Math.floor(Math.random() * 8999999999 + 1000000000);
    openModalInfo(
      "<h3>An update is available!</h3><br>Check on the button below to see what is new since your current version " +
        curVersion +
        '<br> <a href="' +
        random +
        '" target="_blank" class="button alt white">Update Info</a><br><br>No automatic update is available for your version. In order to update, you need to download again the app from <span class="one-click-select">https://easycryptobot.com/</span>. After the download you can extract the app at a new location and start it from there.'
    );
  }
}

async function checkForUpdates(data, showUpdate, showNoUpdate) {
  let curVersion = remote.app.getVersion();
  if (curVersion.indexOf("BETA") != -1) {
    return;
  }
  $.ajax({
    type: "get",
    url: "",
    cache: false,
    data: data,
    success: function(data) {
      try {
        if (typeof data === "string" && data.startsWith("version")) {
          let version = data.split(":");
          let latestVersion = version[1].trim();
          if (latestVersion != curVersion) {
            if (showUpdate) {
              showUpdateMsg(curVersion, latestVersion);
            }
            $("#updateBtn").click(function() {
              showUpdateMsg(curVersion, latestVersion);
            });
            $("#checkForUpdateBtn").hide();
            $("#updateBtn").show();
          } else if (showNoUpdate) {
            openModalInfo("No update is available.");
          }
        } else if (showNoUpdate) {
          openModalInfo("No update is available.");
        }
      } catch (err) {
        log("error", "checkForUpdates", err.stack);
      }
    },
    error: function() {}
  });
}

async function getInteractiveContent() {
  $.ajax({
    type: "get",
    url: "",
    cache: false,
    data: {},
    success: function(data) {
      if (typeof data === "string" && data.startsWith("<!--interactive-->")) {
        $("#interactive").html(data);
        $("#interactive").slideDown("slow");
      }
    },
    error: function() {}
  });
}

function enablePowerSaveBlocker() {
  try {
    const id = remote.powerSaveBlocker.start("prevent-app-suspension");
  } catch (err) {
    log("error", "enablePowerSaveBlocker", err.stack);
  }
}

function getAppDataFolder() {
  return (app || remote.app).getPath("userData");
}

function storeEula(eula) {
  return new Promise((resolve, reject) => {
    eulaDb.insert(eula, (error, srt) => {
      if (error) {
        reject(error);
      } else {
        resolve(srt);
      }
    });
  });
}
async function checkEulaAccepted() {
  try {
    let eula = await getEula();
    if (eula === null || eula === undefined || !eula.accepted) {
      let random = Math.floor(Math.random() * 8999999999 + 1000000000);
      openModalAcceptBig(
        '<h2 class="text-center">End User License Agreement</h2><br>By clicking on "Accept" below you are accepting the full Terms and Conditions of the EasyCryptoBot application, available at ' +
          '<a href="' +
          random +
          '" target="_blank" style="font-weight:bold;margin:0 18px 0 0;padding:0;text-decoration:underline">https://easycryptobot.com/terms.html</a>. Cryptocurrency trading involves risk, and is not suitable for all investors. ' +
          "You are responsible for all the risks and financial resources that you are using for trading and you should carefully consider your investment objectives. " +
          "You are agreeing that you are using the EasyCryptoBot application at your own risk. " +
          "EasyCryptoBot and it's developers are not liable for any loss or damage resulting from the use of the application. " +
          "If you do not fully understand these risks and conditions or you are not agreeing with them you must NOT USE the Easy Crypto Bot.",
        function() {
          try {
            storeEula({ accepted: true });
            setTimeout(() => checkForUpdates({}, true, false), 600);
          } catch (err) {
            log("error", "checkEulaAccepted", err.stack);
            openModalInfo("Cannot write in applicatin folder!<br>Please contact stefan@easycryptobot.com", function() {
              ipcRenderer.send("shutdown");
            });
          }
        },
        function() {
          ipcRenderer.send("shutdown");
        }
      );
    } else {
      setTimeout(() => checkForUpdates({}, true, false), 600);
    }
  } catch (err) {
    log("error", "checkEulaAccepted", err.stack);
    openModalInfo("Cannot run the application!<br>Please contact stefan@easycryptobot.com", function() {
      ipcRenderer.send("shutdown");
    });
  }
}

async function removeTmpFiles() {
  const path = require("path");
  const directory = getAppDataFolder() + "/db/tmp";
  fs.readdir(directory, (err, files) => {
    if (err) {
    }
    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) {
        }
      });
    }
  });
}

async function removeDbFile(name) {
  const file = getAppDataFolder() + "/db/tmp/" + name;
  return removeFile(file);
}

async function removeFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file, err => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

function copyDonationAddress(type) {
  if (type === "btc") {
    clipboard.writeText("1QCEAmRtWSAYxxkUoKHrM7gajviQZnVs47");
    openModalInfo("Bitcoin address is copied to clipboard");
  } else if (type === "eth") {
    clipboard.writeText("0x07580a3C92bb176e76719D6C3403DBB719359065");
    openModalInfo("Ethereum address is copied to clipboard");
  } else if (type === "xmr") {
    clipboard.writeText(
      "472puZHEQRcCvt5MNtp7yg9awPWjywVQS9Vp4nSrBixgdBBQLEi4vZxUTGqUULDF7aWg2xaMcUr9yU2drx7PjDWn2fv65Dj"
    );
    openModalInfo("Monero address is copied to clipboard");
  } else if (type === "paypal") {
    clipboard.writeText("stefan@easycryptobot.com");
    openModalInfo("Address is copied to clipboard");
  }
}
function copyMail() {
  clipboard.writeText("stefan@easycryptobot.com");
  openModalInfo("Email address is copied to clipboard");
}
function facebookClick() {
  shell.openExternal("https://www.facebook.com/EasyCryptoBot");
}

function twitterClick() {
  shell.openExternal("https://twitter.com/EasyCryptoBot");
}

function dropDownItem(name, id, func) {
  $(id + ">div>a").toggleClass("expanded");
  $(id + ">div>ul").slideToggle("fast");
  $(id + ">div>a>.name").html(name);
  if (typeof func === "function") {
    func();
  }
}

function dropDown(id) {
  $(id + ">div>a").toggleClass("expanded");
  $(id + ">div>ul").slideToggle("fast");
}

async function loadStrategiesBt() {
  try {
    const strategies = await getStrategies();
    $("#btStrategiesList").html("");
    $("#tsStrategiesList").html("");
    $("#opStrategiesList").html("");
    strategies.forEach(function(d) {
      $("#btStrategiesList").append(
        '<li><a href="#/" class="min-width25" onclick="dropDownItem(\'' +
          d.name +
          "', '#btStrategy')\">" +
          d.name.replace(/'/g, "\\'") +
          "</a></li>"
      );
      $("#tsStrategiesList").append(
        '<li><a href="#/" class="min-width25" onclick="dropDownItem(\'' +
          d.name +
          "', '#tsStrategy')\">" +
          d.name.replace(/'/g, "\\'") +
          "</a></li>"
      );
      $("#opStrategiesList").append(
        '<li><a href="#/" class="min-width25" onclick="dropDownItem(\'' +
          d.name +
          "', '#opStrategy')\">" +
          d.name.replace(/'/g, "\\'") +
          "</a></li>"
      );
    });
  } catch (err) {
    log("error", "loadStrategiesBt", err.stack);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addZero(number) {
  if (number < 10) {
    return "0" + number;
  } else {
    return number;
  }
}

function getDatesDiff(date1, date2) {
  if (!(date1 instanceof Date) || !(date2 instanceof Date)) {
    return "";
  }
  let diff = Math.abs(date2 - date1);
  let daysDiff = Math.floor(diff / 1000 / 60 / 60 / 24);
  diff -= daysDiff * 1000 * 60 * 60 * 24;
  let hoursDiff = Math.floor(diff / 1000 / 60 / 60);
  diff -= hoursDiff * 1000 * 60 * 60;
  let minutesDiff = Math.floor(diff / 1000 / 60);
  return addZero(daysDiff) + "d " + addZero(hoursDiff) + "h " + addZero(minutesDiff) + "m";
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDateNoYear(date) {
  if (!(date instanceof Date)) {
    return "";
  }
  var srt =
    addZero(date.getDate()) +
    "-" +
    months[date.getMonth()] +
    " " +
    addZero(date.getHours()) +
    ":" +
    addZero(date.getMinutes()) +
    ":" +
    addZero(date.getSeconds());
  return srt;
}
function formatDateTimeOnly(date) {
  if (!(date instanceof Date)) {
    return "";
  }
  var srt = addZero(date.getHours()) + ":" + addZero(date.getMinutes()) + ":" + addZero(date.getSeconds());
  return srt;
}

function formatDate(date) {
  if (!(date instanceof Date)) {
    return "";
  }
  var srt =
    date.getFullYear() +
    "-" +
    addZero(date.getMonth() + 1) +
    "-" +
    addZero(date.getDate()) +
    " " +
    addZero(date.getHours()) +
    ":" +
    addZero(date.getMinutes());
  return srt;
}

function formatDateSmall(date) {
  if (!(date instanceof Date)) {
    return "";
  }
  var srt = date.getFullYear() + "-" + addZero(date.getMonth() + 1) + "-" + addZero(date.getDate());
  return srt;
}

function fixNumber(number, decimals) {
  return Number.parseFloat(number.toFixed(decimals));
}

function formatDateFull(date) {
  if (!(date instanceof Date)) {
    return "";
  }
  var srt =
    date.getFullYear() +
    "-" +
    addZero(date.getMonth() + 1) +
    "-" +
    addZero(date.getDate()) +
    " " +
    addZero(date.getHours()) +
    ":" +
    addZero(date.getMinutes()) +
    ":" +
    addZero(date.getSeconds());
  return srt;
}

function getDbFileName2(exchange, instrument, timeframe, startTime, endTime) {
  return (
    exchange +
    "-" +
    instrument +
    "-" +
    timeframe +
    "-" +
    startTime.getFullYear() +
    "" +
    addZero(startTime.getMonth() + 1) +
    "" +
    addZero(startTime.getDate()) +
    "-" +
    endTime.getFullYear() +
    "" +
    addZero(endTime.getMonth() + 1) +
    "" +
    addZero(endTime.getDate()) +
    ".db"
  );
}

function getDbFileName(exchange, instrument, timeframe) {
  return exchange + "-" + instrument + "-" + timeframe + ".db";
}

function chunkArray(myArray, chunkSize) {
  var result = [];
  while (myArray.length) {
    result.push(myArray.splice(0, chunkSize));
  }
  return result;
}

function opKeyDownDoNothing(e) {
  e.preventDefault();
}

function sectionClick(navItem) {
  $("#sidebar a").removeClass("active");
  $(navItem + "Menu").addClass("active");
  $("#wrapper>section").hide();
  $(navItem).fadeIn("fast");

  if (navItem === "#backtest" || navItem === "#trade" || navItem === "#optimize") {
    loadStrategiesBt();
    fillBtTestPeriod();
    fillOpTestPeriod();
  } else if (navItem === "#home") {
    $(".homeDiv").show();
  } else if (navItem === "#bugs") {
    fillBugLogs();
  }
  if (navItem === "#trade") {
    fillOldExecutions();
  }
}

async function fillBugLogs() {
  try {
    let logFile = getLogFilename();
    fs.readFile(logFile, "utf-8", (err, data) => {
      if (err) {
        $("#bugLogs").html("No logs available!");
      } else {
        if (data == null || data == undefined || data.length == 0) {
          $("#bugLogs").html("No logs available!");
        } else {
          $("#bugLogs").html(data);
        }
      }
    });
  } catch (err) {}
}

async function reportBug(e) {
  e.preventDefault();
  let mail = $("#bugEmail").val();
  if (mail == null || mail == undefined || mail.length == 0 || mail.indexOf("@") == -1) {
    mail = "unknown";
  } else {
    await updateEmailDb(mail);
    fillEmailField();
  }

  let desc = $("#bugDesc").val();
  if (desc == null || desc == undefined || desc.length == 0) {
    openModalInfo("Please add a description of your problem.");
    return;
  }

  try {
    fs.writeFileSync(getLogFilename(), "", "utf-8");
  } catch (err) {}

  openModalInfo("Your BUG report was sent!<br>Thank you for improving EasyCryptoBot!");

  let logs = "App Version: " + remote.app.getVersion() + "<br>";
  logs += "OS: " + os.platform() + " " + os.type() + " " + os.release() + "<br>";
  logs +=
    "Logs: " +
    $("#bugLogs")
      .val()
      .replace(/(?:\r\n|\r|\n)/g, "<br>");

  $("#bugLogs").html("No logs available!");
  $("#bugDesc").val("");
  $.post(
    "https://easycryptobot.com/mail-bug.php",
    {
      f: "ecb",
      m: mail,
      d: desc.replace(/(?:\r\n|\r|\n)/g, "<br>"),
      l: logs
    },
    function(data, status) {}
  );
}

function clearLogs(e) {
  e.preventDefault();
  openModalConfirmYes("Are you sure you want to clear the logs?", function() {
    try {
      $("#bugLogs").html("No logs available!");
      fs.writeFileSync(getLogFilename(), "", "utf-8");
    } catch (err) {}
  });
}

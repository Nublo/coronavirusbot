const STATUS_CACHE = "amount_of_cases"
const COUNTRIES_CACHE = "COUNTRIES_CACHE"
const CACHE_TTL = 600

const FAILED_REQUEST_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"
const START_MESSAGE = "Type /help to see what you can do with this bot"
const STATUS_MESSAGE = "Total amount of infected - "
const SUBSCRIBE_HELP_MESSAGE = "You need to write positive number as an argument.\n" +
                               "For example: /subscribe 1000000"
const SUBSCRIBE_NOTIFY_MESSAGE = "Bot will notify you when amount of cases will be more than "
const HELP_MESSAGE = "This bot can provide you current number of people infected by COVID-19.\n" +
                      "To get amount of infected type /status. To get cases by country type /status USA.\n" +
                      "To get top 10 infected countries type /top. You can also type '/top 20' to get more countries.\n" +
                      "Information updates once in 10 min.\n" +
                      "[Source](https://www.worldometers.info/coronavirus/)"

const cheerio = require('cheerio')
const axios = require('axios')
const cron = require('node-cron')
const NodeCache = require('node-cache');
const cache = new NodeCache();

var queue = []

var TelegramBot = require('node-telegram-bot-api'),
    port = process.env.PORT || 443,
    host = process.env.HOST || '0.0.0.0',
    externalUrl = 'https://coronavirusstatusbot.herokuapp.com/',
    token = process.env.BOT_ID,
    bot = new TelegramBot(process.env.BOT_ID, { webHook: { port : port, host : host } });
bot.setWebHook(externalUrl + ':' + port + '/bot' + token);

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, START_MESSAGE)
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, HELP_MESSAGE, {"parse_mode": "Markdown"})
});

bot.onText(/\/status$/, (msg) => {
  var totalCases = cache.get(STATUS_CACHE)
  var chatId = msg.chat.id
  if (totalCases) {
    console.log("/status Cache hit")
    sendTotalCasesMessage(chatId, totalCases)
    return
  }

  requestHtml(
    function (html) {
      updateCache(html)
      sendTotalCasesMessage(chatId, cache.get(STATUS_CACHE))
    },
    sendDefaultErrorMessageCallback(chatId)
  )
})

bot.onText(/\/status (.+)/ (msg, match) => {
  var cacheCountries = cache.get(COUNTRIES_CACHE)
  if (cacheCountries) {
    var filtered = cacheCountries.filter(e => e.country.includes(match[1]))
    if (filtered.length == 0) {
      bot.sendMessage(msg.chat.id, "Unknown country - " + match[1] + ". Try to use /top to check country name.")
      return;
    }

    bot.sendMessage(msg.chat.id, getCountriesMessage(filtered))
  }
})

bot.onText(/\/top$/, (msg) => {
  requestTopCountries(msg.chat.id, 10)
})

bot.onText(/\/top (\d+)/, (msg, match) => {
  requestTopCountries(msg.chat.id, match[1])
})

bot.onText(/\/subscribe$/, (msg) => {
  bot.sendMessage(msg.chat.id, SUBSCRIBE_HELP_MESSAGE)
})

bot.onText(/\/subscribe (\d+)/, (msg, match) => {
  var target = match[1]
  var current = cache.get(STATUS_CACHE)
  if (current && current > target) {
    sendTotalCasesMessage(msg.chat.id, current)
    return;
  }

  queue.push({"chatId": msg.chat.id, "target": target})
  bot.sendMessage(msg.chat.id, SUBSCRIBE_NOTIFY_MESSAGE + `${target}`)
})

function sendTotalCasesMessage(chatId, cases) {
  bot.sendMessage(chatId, STATUS_MESSAGE + cases);
}

function requestTopCountries(chatId, top) {
  var cacheCountries = cache.get(COUNTRIES_CACHE)
  if (cacheCountries) {
    console.log("/top Cache hit")
    sendCountriesResponse(chatId, cacheCountries, top)
    return;
  }

  requestHtml(
    function(html) {
      updateCache(html)
      sendCountriesResponse(chatId, cache.get(COUNTRIES_CACHE), top)
    },
    sendDefaultErrorMessageCallback(chatId)
  )
}

function updateCache(html) {
  updateCasesCache(html)
  updateCountriesCache(html)
}

function updateCasesCache(html) {
  const $ = cheerio.load(html)
  var count = $(".maincounter-number [style='color:#aaa']").text()
  cache.set(STATUS_CACHE, count, CACHE_TTL)
}

function updateCountriesCache(html) {
  const $ = cheerio.load(html)
  let countries = [];
  $("#main_table_countries_today td:nth-child(1)").each(function (i, e) {
      countries[i] = $(this).text();
  });
  let cases = [];
  $("#main_table_countries_today td:nth-child(2)").each(function (i, e) {
      cases[i] = $(this).text();
  });
  let countriesAndCases = [];
  for (i = 0; i < countries.length; i++) {
    countriesAndCases.push({
      country: countries[i],
      cases: cases[i]
    })
  }
  cache.set(COUNTRIES_CACHE, countriesAndCases, CACHE_TTL)
}

function sendCountriesResponse(chatId, countriesAndCases, top) {
  if (top == 0) {
    return;
  }
  let sorted = countriesAndCases.sort((a, b) => 
    parseInt(a.cases.replace(/\D/g,'')) >=  parseInt(b.cases.replace(/\D/g,'')) ? -1 : 1
  )
  sorted.shift() // Removing "Total:" line from response
  let topCountries = sorted.slice(0, Math.min(top, sorted.length))
  bot.sendMessage(chatId, getCountriesMessage(topCountries))
}

function getCountriesMessage(countriesAndCases) {
  var text = ''
  for (i = 0; i < countriesAndCases.length; i++) {
    text += countriesAndCases[i].country + ' - ' + countriesAndCases[i].cases
    if (i != countriesAndCases.length - 1) {
      text += '\n'
    }
  }
  return text
}

function requestHtml(callback, errorCallback = function(error){}) {
  var url = 'https://www.worldometers.info/coronavirus/'
  axios({
     method: 'get',
     url,
     timeout: 5000
  }).then(response => {
    if (response.status === 200) {
        callback(response.data)
    }
  }).catch(err => {
    errorCallback(err)
  })
}

function sendDefaultErrorMessageCallback(chatId) {
  return function(err) {
    console.log("error - " + err)
    bot.sendMessage(chatId, FAILED_REQUEST_MESSAGE, {"parse_mode": "Markdown"})
  }
}

cron.schedule('*/10 * * * *', () => {
  requestHtml(
    function(html) {
      console.log("Success cron update")
      updateCache(html)
      var currentCases = cache.get(STATUS_CACHE)
      var i = queue.length
      while (i--) {
        if (queue[i].target < currentCases) {
          sendTotalCasesMessage(queue[i].chatId, currentCases)
          queue.splice(i, 1);
        }
      }
    })
});
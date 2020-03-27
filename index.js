const STATUS_CACHE = "amount_of_cases"
const COUNTRIES_CACHE = "COUNTRIES_CACHE"
const CACHE_TTL = 600
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"
const HELP_MESSAGE = "This bot can provide you current number of people infected by COVID-19. " +
                      "To get this information just type /status. " +
                      "To get top 10 infected countries type /top and positive number. " +
                      "Bot caches information and updates it once in 10 min. " +
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

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, HELP_MESSAGE, { "parse_mode": "Markdown" })
});

bot.onText(/\/status/, (message) => {
  var totalCases = cache.get(STATUS_CACHE)
  if (totalCases) {
    console.log("/status Cache hit")
    sendTotalCasesMessage(message, totalCases)
    return
  }

  requestHtml(
    function (html) {
      updateCache(html)
      sendTotalCasesMessage(message, cache.get(STATUS_CACHE))
    },
    sendDefaultErrorMessageCallback(message)
  )
})

function sendTotalCasesMessage(message, cases) {
  bot.sendMessage(message.chat.id, "Total amount of infected - " + cases);
}

bot.onText(/\/top$/, (message) => {
  requestTopCountries(message, 10)
})

bot.onText(/\/top (\d+)/, (message, match) => {
  requestTopCountries(message, match[1])
})

function requestTopCountries(message, top) {
  var cacheCountries = cache.get(COUNTRIES_CACHE)
  if (cacheCountries) {
    console.log("/top Cache hit")
    sendCountriesResponse(message, cacheCountries, top)
    return;
  }

  requestHtml(
    function(html) {
      updateCache(html)
      sendCountriesResponse(message, cache.get(COUNTRIES_CACHE), top)
    },
    sendDefaultErrorMessageCallback(message)
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

function sendCountriesResponse(message, countriesAndCases, top) {
  let sorted = countriesAndCases.sort((a, b) => parseInt(a.cases) >= parseInt(b.cases) ? -1 : 1)
  let topCountries = sorted.slice(0, Math.min(top, sorted.length))
  var text = ''
  for (i = 0; i < topCountries.length; i++) {
    text += topCountries[i].country + ' - ' + topCountries[i].cases
    if (i != topCountries.length - 1) {
      text += '\n'
    } 
  }
  bot.sendMessage(message.chat.id, text)
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

function sendDefaultErrorMessageCallback(message) {
  return function(err) {
    console.log("error - " + err)
    bot.sendMessage(
      message.chat.id,
      FAILED_API_MESSAGE,
      {
        "parse_mode": "Markdown"
      }
    )
  }
}

bot.onText(/\/subscribe (\d+)/, (message, match) => {
  var target = match[1]
  var current = cache.get(STATUS_CACHE)
  if (current && current > target) {
    sendTotalCasesMessage(message, current)
    return;
  }

  queue.push({"message": message, "target": target})
  bot.sendMessage(
    message.chat.id,
    "Bot will notify you, when amount of cases will increase " + target,
  )
})

cron.schedule('*/10 * * * *', () => {
  requestHtml(
    function(html) {
      console.log("Success cron update")
      updateCache(html)
      var currentCases = cache.get(STATUS_CACHE)
      var i = queue.length
      while (i--) {
        if (queue[i].target < currentCases) {
          sendTotalCasesMessage(queue[i].message, currentCases)
          queue.splice(i, 1);
        }
      }
    })
});
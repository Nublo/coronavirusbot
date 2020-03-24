const KEY_CACHE = "amount_of_cases"
const COUNTRIES_CACHE = "COUNTRIES_CACHE"
const CACHE_TTL = 600
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"
const HELP_MESSAGE = "This bot can provide you current number of people infected by COVID-19. " +
                      "To get this information just type /status. " +
                      "To get top 10 infected countries type /top and positive number. " +
                      "Bot caches information and updates it once in 10 min. " +
                      "Source is https://www.worldometers.info/coronavirus/."

const cheerio = require('cheerio')
const axios = require('axios')
const NodeCache = require('node-cache');
const cache = new NodeCache();

var TelegramBot = require('node-telegram-bot-api'),
    port = process.env.PORT || 443,
    host = process.env.HOST || '0.0.0.0',
    externalUrl = 'https://secure-hamlet-34963.herokuapp.com/',
    token = process.env.BOT_ID,
    bot = new TelegramBot(process.env.BOT_ID, { webHook: { port : port, host : host } });
bot.setWebHook(externalUrl + ':' + port + '/bot' + token);

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, HELP_MESSAGE)
});

bot.onText(/\/status/, (message) => {
  var totalCases = cache.get(KEY_CACHE)
  if (totalCases == undefined) {
    requestHtml(message, function (html) { 
        const $ = cheerio.load(html)
        var count = $(".maincounter-number [style='color:#aaa']").text()
        cache.set(KEY_CACHE, count, CACHE_TTL)
        sendTotalCasesMessage(message, count)
    })
  } else {
    console.log("Cache hit")
    sendTotalCasesMessage(message, totalCases)
  }
})

bot.onText(/\/top$/, (message) => {
  requestTopCountries(message, 10)
})

bot.onText(/\/top (\d+)/, (message, match) => {
  requestTopCountries(message, match[1])
})

function requestTopCountries(message, top) {
  var cacheCountries = cache.get(COUNTRIES_CACHE)
  if (cacheCountries != undefined) {
    console.log("Cache hit")
    sendCountriesResponse(message, cacheCountries, top)
    return;
  }

  requestHtml(message, function(html) {
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
    sendCountriesResponse(message, countriesAndCases, top)
  })
}

function sendCountriesResponse(message, countriesAndCases, top) {
  let topCountries = countriesAndCases.slice(0, Math.min(top, countriesAndCases.length))
  var text = ''
  for (i = 0; i < topCountries.length; i++) {
    text += topCountries[i].country + ' - ' + topCountries[i].cases
    if (i != topCountries.length - 1) {
      text += '\n'
    } 
  }
  bot.sendMessage(message.chat.id, text)
}

function requestHtml(message, callback) {
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
    console.log("error - " + err)
    bot.sendMessage(message.chat.id, FAILED_API_MESSAGE)
  })
}

function sendTotalCasesMessage(message, cases) {
  bot.sendMessage(
    message.chat.id,
    "Total amount of infected - " + cases
  );
  console.log('Total cases - ' + cases)
}
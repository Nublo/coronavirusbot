const KEY_CACHE = "amount_of_cases"
const CACHE_TTL = 600
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"
const HELP_MESSAGE = "This bot can provide you current number of people infected by COVID-19. \
                      To get this information just type '/status'. \
                      To get top 10 infected countries type '/top 10'. You can replace 10 with another value.
                      Source of data is https://www.worldometers.info/coronavirus/. \
                      Bot also caches information and update it once in 10 min. "

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
        var count = $("body div.container div.row div.col-md-8 div.content-inner div#maincounter-wrap[style='margin-top:15px'] span[style='color:#aaa']").text()
        cache.set(KEY_CACHE, count, CACHE_TTL)
        sendTotalCasesMessage(message, count)
    })
  } else {
    console.log("Cache hit")
    sendTotalCasesMessage(message, totalCases)
  }
})

// TODO add cache
bot.onText(/\/top (\d+)/, (message, match) => {
  requestHtml(message, function(html) {
    const top = match[1];
    const $ = cheerio.load(html)
    let countries = [];
    $("#main_table_countries_today td:nth-child(1)").each(function (i, e) {
        countries[i] = $(this).text();
    });
    let cases = [];
    $("#main_table_countries_today td:nth-child(2)").each(function (i, e) {
        cases[i] = $(this).text();
    });
    let topCountries = countries.slice(0, Math.min(top, countries.length))
    var text = ''
    for (i = 0; i < topCountries.length; i++) {
      text += topCountries[i] + ' - ' + cases[i]
      if (i != topCountries.length - 1) {
        text += '\n'
      } 
    }
    bot.sendMessage(message.chat.id, text)
  })
})

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
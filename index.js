const KEY_CACHE = "amount_of_cases"
const CACHE_TTL = 600
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"

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
  bot.sendMessage(
    msg.chat.id, 
    "This bot can provide you current number of people infected by COVID-19. To get this information just type '/status'. Source of data is https://www.worldometers.info/coronavirus/. Bot also cache information and update it once in 10 min, so don't expect update in less that 10 min"
  )
});

bot.onText(/\/status/, (message) => {
  var totalCases = cache.get(KEY_CACHE)
  if (totalCases == undefined) {
    requestCountInfo(message)
  } else {
    console.log("Cache hit")
    sendMessage(message, totalCases)
  }
})

function requestCountInfo(message, res) {
  var url = 'https://www.worldometers.info/coronavirus/'
  axios({
     method: 'get',
     url,
     timeout: 5000
  }).then(response => {
    if (response.status === 200) {
        const $ = cheerio.load(response.data)
        var count = $("body div.container div.row div.col-md-8 div.content-inner div#maincounter-wrap[style='margin-top:15px'] span[style='color:#aaa']").text()
        cache.set(KEY_CACHE, count, CACHE_TTL)
        sendMessage(message, count)
    }
  }).catch(err => {
    sendMessage(message, FAILED_API_MESSAGE)
  })
}

function sendMessage(message, cases) {
  bot.sendMessage(
    message.chat.id,
    "Total amount of infected - " + cases
  );
  console.log('Total cases - ' + cases)
}
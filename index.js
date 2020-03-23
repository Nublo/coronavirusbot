const KEY_CACHE = "amount_of_cases"
const CACHE_TTL = 10000
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"

const cheerio = require('cheerio')
const axios = require('axios')
const NodeCache = require('node-cache');
const cache = new NodeCache();

const TelegramBot = require('node-telegram-bot-api'); 
const bot = new TelegramBot(process.env.BOT_ID, {polling: true});

bot.on('message', (msg) => { 
  var totalCases = cache.get(KEY_CACHE)
  if (totalCases == undefined) {
    requestCountInfo(message)
  } else {
    console.log("Cache hit")
    sendMessage(message, totalCases)
  }
});

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
  bot.sendMessage(msg.chat.id, "Total amount of infected - " + cases);
  console.log('Total cases - ' + cases)
}
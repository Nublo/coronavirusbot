const KEY_CACHE = "amount_of_cases"
const CACHE_TTL = 10000
const BOT_ID = "1114913919:AAHcUunychWYJbL9JSknBxyAbt7NXxlnGKk"
const FAILED_API_MESSAGE = "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)"

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
const cheerio = require('cheerio')
const axios = require('axios')
const NodeCache = require('node-cache');
const cache = new NodeCache();

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)

app.post('/new-message', function(req, res) {
  const { message } = req.body
  if (!message) {
    return res.sendStatus(200)
  }

  var totalCases = cache.get(KEY_CACHE)
  if (totalCases == undefined) {
    requestCountInfo(message, res)
  } else {
    console.log("Cache hit")
    sendMessage(message, totalCases)
    res.sendStatus(200)
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
        console.log("Cache miss")
        sendMessage(message, count)
        res.sendStatus(200)
    }
  }).catch(err => {
    sendMessage(message, FAILED_API_MESSAGE)
    res.sendStatus(200)
  })
}

function sendMessage(message, cases) {
  axios
    .post(
      'https://api.telegram.org/bot' + BOT_ID +'/sendMessage',
      {
        chat_id: message.chat.id,
        text: "Total amount of infected - " + cases
      }
    )
    .then(response => {
      console.log('Total cases - ' + cases)
    })
    .catch(err => {
      console.log('TG Error :', err)
    })
}

var port = process.env.PORT
app.listen(port, function() {
  console.log('Telegram app listening - ' + port);
})

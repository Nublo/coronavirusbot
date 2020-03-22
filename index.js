const KEY_CACHE = "amount_of_cases"
const CACHE_TTL = 10000

var express = require('express')
var app = express()
var bodyParser = require('body-parser')
const cheerio = require('cheerio')
const axios = require('axios')
const NodeCache = require('node-cache');
const cache = new NodeCache();

app.use(bodyParser.json()) // for parsing application/json
app.use(
  bodyParser.urlencoded({
    extended: true
  })
) // for parsing application/x-www-form-urlencoded

//This is the route the API will call
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
    postTGMessage(message, getAnswer(totalCases))
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
        const html = response.data
        const $ = cheerio.load(html)
        var count = $("body div.container div.row div.col-md-8 div.content-inner div#maincounter-wrap[style='margin-top:15px'] span[style='color:#aaa']").text()
        postTGMessage(message, getAnswer(count))
        cache.set(KEY_CACHE, count, CACHE_TTL)
        res.sendStatus(200)
    }
  }).catch(err => {
    postTGMessage(message, "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)")
    res.sendStatus(200)
  })
}

function postTGMessage(message, textToSend) {
  axios
    .post(
      'https://api.telegram.org/bot1114913919:AAHcUunychWYJbL9JSknBxyAbt7NXxlnGKk/sendMessage',
      {
        chat_id: message.chat.id,
        text: textToSend
      }
    )
    .then(response => {
      console.log('Posted message - ' + textToSend)
    })
    .catch(err => {
      console.log('TG Error :', err)
    })
}

function getAnswer(count) {
  return "Total amount of infected - " + count;
}

var port = process.env.PORT
app.listen(port, function() {
  console.log('Telegram app listening - ' + port);
})

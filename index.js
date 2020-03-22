var express = require('express')
var app = express()
var bodyParser = require('body-parser')
const cheerio = require('cheerio')
const axios = require('axios')
const router = express.Router();

app.use(bodyParser.json()) // for parsing application/json
app.use(
  bodyParser.urlencoded({
    extended: true
  })
) // for parsing application/x-www-form-urlencoded

//This is the route the API will call
app.post('/new-message', function(req, res) {
  const { message } = req.body

  //Each message contains "text" and a "chat" object, which has an "id" which is the chat id

  if (!message) {
    return res.end()
  }

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
        console.log(count)
        postTGMessage(message, "Total amount of infected - " + count)
    }
  }).catch(err => {
    console.log("Request to worldometers failed - " + err)
    postTGMessage(message, "Failed to get info. You can [check manually](https://www.worldometers.info/coronavirus/)")
  })

})

function postTGMessage(message, textToSend) {
  axios
    .post(
      'https://api.telegram.org/bot1114913919:AAHcUunychWYJbL9JSknBxyAbt7NXxlnGKk/sendMessage',
      {
        chat_id: message.chat.id,
        text: message
      }
    )
    .then(response => {
      // We get here if the message was successfully posted
      console.log('TG Message posted')
    })
    .catch(err => {
      // ...and here if it was not
      console.log('TG Error :', err)
    })
}

/*(app.get('/', function(req, res) {
  console.log("Start response")
  getStats()
  res.send("blablablba")
})*/

// Finally, start our server
var port = process.env.PORT // process.env.PORT
app.listen(port, function() {
  console.log('Telegram app listening - ' + port);
})

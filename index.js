var express = require('express')
var app = express()
var bodyParser = require('body-parser')
const cheerio = require('cheerio')
const axios = require('axios')

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

  axios.get(
    'https://www.worldometers.info/coronavirus/'
  ).then(response => {
    if (response.status === 200) {
        const html = response.data
        console.log(html)
        const $ = cheerio.load(html)
        var count = $('/html/body/div[3]/div[2]/div[1]/div/div[4]/div/span').text().trim()
        console.log(count)
        postTGMessage(message, "Total amount of infected - " +count)
    }
  }).catch(err => {
    console.log("Request to worldometers failed")
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
      console.log('Message posted')
      res.end('ok')
    })
    .catch(err => {
      // ...and here if it was not
      console.log('Error :', err)
      res.end('Error :' + err)
    })
}

// Finally, start our server
app.listen(process.env.PORT, function() {
  console.log('Telegram app listening - ' + process.env.PORT)
})

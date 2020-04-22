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
                      "To get amount of infected type /status. To get cases by country type `/status USA`.\n" +
                      "To get top 10 infected countries type /top. You can also type `/top 20` to get more countries.\n" +
                      "You can subscribe to total amount of cases using `/subscribe 500`.\n" +
                      "Information updates once in 10 min.\n" +
                      "[Source](https://www.worldometers.info/coronavirus/)"
const STOP_MESSAGE_SUCCESS = "Removed all your active subscriptions"
const STOP_MESSAGE_NO_SUBSCRIPTIONS = "You don't have any active subscriptions"
const DONATE_MESSAGE = "Your support is greatly appreciated.\n" +
                       "If you want to see more features feel free to support this project.\n" +
                       "[Donate via paypall](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3C7ZRH48YETS4&source=url)\n" +
                       "[Donate via Ethereum](https://etherdonation.com/d?to=0x3f3c8988f40425cd208bbd0f5892d38e03e3772d)\n" +
                       "[Donate via yandex.money](https://money.yandex.ru/to/410014247261560)"

const cheerio = require('cheerio')
const axios = require('axios')
const cron = require('node-cron')
const NodeCache = require('node-cache');
const cache = new NodeCache();
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const TelegramBot = require('node-telegram-bot-api');
const options = {
  webHook : {
    port : process.env.PORT
  }
}
const url = process.env.SERVICE_URL + ':' + process.env.PORT;
const bot = new TelegramBot(process.env.BOT_ID, options);
bot.setWebHook(url + '/bot' + process.env.BOT_ID);

bot.onText(/\/start/, (msg) => {
  trackUser(msg.chat.id)
  bot.sendMessage(msg.chat.id, START_MESSAGE)
});

bot.onText(/\/help/, (msg) => {
  trackUser(msg.chat.id)
  bot.sendMessage(msg.chat.id, HELP_MESSAGE, {"parse_mode": "Markdown"})
});

bot.onText(/\/donate/, (msg) => {
  trackUser(msg.chat.id)
  bot.sendMessage(msg.chat.id, DONATE_MESSAGE, {"parse_mode": "Markdown"})
})

bot.onText(/\/status$/, (msg) => {
  trackUser(msg.chat.id)
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

bot.onText(/\/status (.+)/, (msg, match) => {
  trackUser(msg.chat.id)
  var cacheCountries = cache.get(COUNTRIES_CACHE)
  if (cacheCountries) {
    var filtered = cacheCountries.filter(e => e.country.toLowerCase().includes(match[1].toLowerCase()))
    if (filtered.length == 0) {
      bot.sendMessage(msg.chat.id, "Unknown country - " + match[1] + ". Try to use /top to check country name.")
      return;
    }

    var exactMatch = filtered.filter(e => e.country == match[1])
    if (exactMatch.length == 1) {
      bot.sendMessage(msg.chat.id, getCountriesMessage(exactMatch))
    } else {
      bot.sendMessage(msg.chat.id, getCountriesMessage(filtered))
    }
  }
})

bot.onText(/\/top$/, (msg) => {
  trackUser(msg.chat.id)
  requestTopCountries(msg.chat.id, 10)
})

bot.onText(/\/top (\d+)/, (msg, match) => {
  trackUser(msg.chat.id)
  requestTopCountries(msg.chat.id, match[1])
})

bot.onText(/\/subscribe$/, (msg) => {
  trackUser(msg.chat.id)
  bot.sendMessage(msg.chat.id, SUBSCRIBE_HELP_MESSAGE)
})

bot.onText(/\/subscribe (\d+)/, (msg, match) => {
  trackUser(msg.chat.id)
  var target = match[1]
  var current = cache.get(STATUS_CACHE)
  if (current && current > parseInt(target.replace(/\D/g,''))) {
    sendTotalCasesMessage(msg.chat.id, current)
    return;
  }

  const query = {
    text: 'INSERT INTO subscriptions (chat_id, target) VALUES ($1, $2) RETURNING *',
    values: [msg.chat.id, target],
  }
  pool
    .query(query)
    .then(res => {
      console.log(res.rows[0])
      bot.sendMessage(res.rows[0].chat_id, SUBSCRIBE_NOTIFY_MESSAGE + `${res.rows[0].target}`)
    })
    .catch(e => console.error(e.stack))
})

bot.onText(/\/stop/, (msg) => {
  trackUser(msg.chat.id)
  const query = {
    text: 'DELETE FROM subscriptions WHERE chat_id = $1 RETURNING *',
    values: [msg.chat.id]
  }
  pool
    .query(query)
    .then(res => 
      bot.sendMessage(
        msg.chat.id,
        res.rows.length > 0 ? STOP_MESSAGE_SUCCESS : STOP_MESSAGE_NO_SUBSCRIPTIONS
      )
    )
    .catch(e => console.error(e.stack))
})

bot.onText(/\/stats/, (msg) => {
  const query = {
    text: 'SELECT COUNT(*) FROM users UNION ALL SELECT COUNT(DISTINCT chat_id) FROM subscriptions'
  }
  pool
    .query(query)
    .then(res => {
      bot.sendMessage(
        msg.chat.id,
        "Unique users - " + res.rows[0].count + "\n" +
        "Unique subscriptions - " + res.rows[1].count
      )
    })
    .catch(e => cosole.error(e.stack))
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
  let notCountries = ["total", "world", "europe", "north america", "asia", "south america", "africa", "oceania"];
  for (i = 0; i < countries.length; i++) {
    var filtered = false;
    for (j = 0; j < notCountries.length; j++) {
      if (countries[i].toLowerCase().includes(notCountries[j])) {
        filtered = true;
      }
    }
    if (filtered) {
      continue;
    }
    countriesAndCases.push({
      country: countries[i],
      cases: cases[i]
    })
  }
  cache.set(COUNTRIES_CACHE, countriesAndCases, CACHE_TTL)
}

function sendCountriesResponse(chatId, countriesAndCases, top) {
  if (top == 0) { return; }
  let sorted = countriesAndCases.sort((a, b) => 
    parseInt(a.cases.replace(/\D/g,'')) >=  parseInt(b.cases.replace(/\D/g,'')) ? -1 : 1
  )
  bot.sendMessage(chatId, getCountriesMessage(sorted.slice(0, Math.min(top, sorted.length))))
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

function trackUser(chatId) {
  const query = {
    text: 'INSERT INTO users (chat_id) VALUES ($1) ON CONFLICT DO NOTHING',
    values: [chatId]
  }
  pool
    .query(query)
}

cron.schedule('*/10 * * * *', () => {
  requestHtml(
    function(html) {
      console.log("Success cron update")
      updateCache(html)
      var currentCases = cache.get(STATUS_CACHE)

      const query = {
        text: 'DELETE FROM subscriptions WHERE target <= $1 RETURNING *',
        values: [currentCases.replace(/\D/g,'')]
      }
      pool
        .query(query)
        .then(res => {
          for (i = 0; i < res.rows.length; i++) {
            sendTotalCasesMessage(res.rows[i].chat_id, currentCases)
          }
        })
        .catch(e => console.error(e.stack))
    })
})

requestHtml(function (html) { 
  console.log("Initial update")
  updateCache(html) 
})
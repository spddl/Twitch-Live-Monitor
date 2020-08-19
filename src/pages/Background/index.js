/* global window, chrome, browser, WebSocket, FileReader, XMLHttpRequest */

import '../../assets/img/tw128px.png'
import '../../assets/img/bw128px.png'

const re = /^https:\/\/github.com\/spddl\/Twitch-Live-Monitor#access_token=(.*?)&scope=user_read&token_type=bearer$/

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

console.log('isFirefox', isFirefox)
let windowSettings = {}

const OAuthListener = (tabId, changeInfo, tab) => { // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onCreated
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const urlRegex = changeInfo.url.match(re)
    if (urlRegex !== null) {
      window.settingsReducer({ type: 'SET', value: { name: 'OAuth', value: urlRegex[1] } })
      const userID = window.settingsReducer({ type: 'GET', value: { name: 'userID' } }) || ''
      if (!userID) {
        getUserID().then(() => {
          window.getInit(true)
          if (isFirefox) {
            browserAPI.tabs.update(tab.id, { url: browser.runtime.getManifest().options_ui.page })
          } else {
            browserAPI.tabs.update(tab.id, { url: `chrome-extension://${chrome.runtime.id}/options.html` })
          }
          browserAPI.tabs.onCreated.removeListener(OAuthListener)
        })
      } else {
        window.getInit(true)
        if (isFirefox) {
          browserAPI.tabs.update(tab.id, { url: browser.runtime.getManifest().options_ui.page })
        } else {
          browserAPI.tabs.update(tab.id, { url: `chrome-extension://${chrome.runtime.id}/options.html` })
        }
        browserAPI.tabs.onCreated.removeListener(OAuthListener)
      }
    }
  }
}

window.createOAuthListener = () => {
  browserAPI.tabs.onUpdated.addListener(OAuthListener)
}

const getUserID = () => {
  return new Promise((resolve, reject) => {
    const { OAuth, clientID, userID, accountnameInput } = window.settingsReducer({ type: 'GETALL' })
    console.debug('getUserID', { clientID, userID, accountnameInput })
    if (!userID) {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', 'https://api.twitch.tv/kraken/users?login=' + accountnameInput, true, null, null)
      xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json')
      xhr.setRequestHeader('Authorization', 'OAuth ' + OAuth)
      xhr.setRequestHeader('Client-ID', clientID)
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText)
          if (data._total === 1) {
            window.settingsReducer({ type: 'SET', value: { name: 'userID', value: data.users[0]._id } })
            window.settingsReducer({ type: 'SET', value: { name: 'accountname', value: accountnameInput } })
            resolve()
          } else {
            console.warn('not found', { data })
            reject(new Error('not found', { data }))
          }
        } else {
          console.warn(xhr.statusText, xhr.responseText)
          reject(new Error(xhr.statusText, xhr.responseText))
        }
      })
      xhr.send()
    }
  })
}

let ws

const UPDATE_INTERVAL = 60 * 1000 * 2 // 2 minutes
let LiveChannels = {}
let LiveChannelsArray = []
const GameIDList = {}
let allChannels = []

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
function nonce (length) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

const heartbeat = () => { ws.send('{"type":"PING"}') }

// Clients can listen on up to 50 topics per connection. Trying to listen on more topics will result in an error message.
function listen (topics) { // https://dev.twitch.tv/docs/pubsub#topics
  console.debug('listen', topics, ws.readyState)
  if (ws.readyState === 1) {
    const message = {
      type: 'LISTEN',
      nonce: nonce(15),
      data: {
        topics,
        auth_token: 'Bearer ' + windowSettings.OAuth // sessionStorage.twitchOAuthToken
      }
    }
    ws.send(JSON.stringify(message))
  } else {
    setTimeout(() => {
      listen(topics)
    }, Math.floor(Math.random() * 5001 + 3000))
  }
}

function connect () {
  return new Promise((resolve, reject) => {
    const heartbeatInterval = 1000 * 60 // ms between PING's
    const reconnectInterval = 1000 * 3 // ms to wait before reconnect
    let heartbeatHandle

    ws = new WebSocket('wss://pubsub-edge.twitch.tv')

    ws.onopen = event => {
      console.debug('WS: Socket Opened')
      heartbeat()
      heartbeatHandle = setInterval(heartbeat, heartbeatInterval)
      resolve(ws)
    }

    ws.onerror = error => {
      console.warn('ERR: ' + JSON.stringify(error))
      reject(error)
    }

    ws.onmessage = async event => {
      const eventData = JSON.parse(event.data)

      switch (eventData.type) {
        case 'MESSAGE':
          const chanName = eventData.data.topic.substr(15)
          const msg = JSON.parse(eventData.data.message)

          const targetChannel = LiveChannelsArray.find(element => element.toLowerCase() === chanName)
          if (!targetChannel) {
            LiveChannels[targetChannel] = {}
          }
          LiveChannels[targetChannel].viewer_count = msg.viewers

          const LiveChannelsKeys = LiveChannelsArray.map(chan => chan.toLowerCase())

          if (msg.type === 'stream-up') {
            if (LiveChannelsKeys.indexOf(chanName) === -1) {
              const found = allChannels.find(element => element.nametoLowerCase === chanName)

              // https://dev.twitch.tv/docs/v5/reference/channels#get-channel-by-id
              const chan = await request({ url: 'https://api.twitch.tv/kraken/channels/' + found.id, clientID: windowSettings.clientID, OAuth: 'Bearer ' + windowSettings.OAuth })

              LiveChannels[chan.display_name] = {
                game_id: '',
                game: chan.game,
                started_at: new Date(msg.server_time * 1000).toISOString(),
                title: chan.status || chan.description,
                type: 'live',
                viewer_count: 0
              }

              const iconUrl = await toDataURL(chan.logo)
              pushNotification({ channel: chan.display_name, title: `${chan.display_name} is Online`, message: `${chan.status || chan.description}`, iconUrl })
            }
          } else if (msg.type === 'stream-down') {
            // TODO Wieder entfernen
            console.debug('// Wieder entfernen', msg)
          }
          break

        case 'RECONNECT':
          console.debug('WS: Reconnecting...')
          setTimeout(connect, reconnectInterval)
          break

        case 'RESPONSE':
          if (eventData.error) {
            console.warn(eventData)
          }
          break

        case 'PONG':
          break
        default:
          console.debug('ws.onmessage default:', eventData)
      }
    }

    ws.onclose = () => {
      console.debug('WS: Socket Closed')
      clearInterval(heartbeatHandle)
      console.debug('WS: Reconnecting...')
      setTimeout(connect, reconnectInterval)
    }
  })
}

window.getInit = async (channel = false) => {
  if (channel) {
    await getChannels()
  }
  await checkStatus(false)
  browserAPI.browserAction.setBadgeText({ text: LiveChannelsArray.length.toString() })
  await getGameIDList()
}

window.getStreams = () => LiveChannels
window.setPriorityChannelReducer = value => {
  windowSettings.PriorityChannels = value

  browserAPI.storage.sync.set({ PriorityChannels: windowSettings.PriorityChannels }, () => {
    // console.debug('setPriorityChannelReducer saved', { PriorityChannels: windowSettings.PriorityChannels })
  })
}

window.settingsReducer = ({ type, value }) => {
  switch (type) {
    case 'SET':
      windowSettings[value.name] = value.value
      browserAPI.storage.sync.set({ [value.name]: value.value }, () => {
        // console.debug('saved', { [value.name]: value.value })
      })
      break
    case 'GET':
      return windowSettings[value.name]
    case 'GETALL':
      return windowSettings
    case 'CLEAR':
      browserAPI.browserAction.setBadgeText({ text: '0' })
      windowSettings = {}

      LiveChannels = {}
      LiveChannelsArray = []
      allChannels = []

      browserAPI.storage.sync.clear(() => {
        window.alert('Settings deleted')
      })
      return windowSettings
    default:
      console.warn('SettingsReducer', { type, value })
  }
  return null
}

window.getAllChannels = () => allChannels
window.getGameIDList = () => GameIDList

window.openStream = channelName => {
  if (channelName === 'Options') {
    if (isFirefox) {
      browserAPI.runtime.openOptionsPage()
    } else {
      browserAPI.tabs.create({ url: `chrome-extension://${chrome.runtime.id}/options.html` })
    }
  } else {
    browserAPI.tabs.create({ url: 'https://www.twitch.tv/' + channelName.replace(/\s/g, '') })
  }
}

const request = ({ url, clientID, OAuth }) => {
  return new Promise((resolve, reject) => {
    // console.debug({ url, clientID, OAuth })
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url + ((/\?/).test(url) ? '&' : '?') + (new Date()).getTime()) // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
    xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json')
    xhr.setRequestHeader('Client-ID', clientID)
    xhr.setRequestHeader('Authorization', OAuth)
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        console.warn(url, xhr.statusText, xhr.responseText, 'oAuth', OAuth)
        window.alert(url, xhr.responseText)
        reject(xhr.statusText)
      }
    })
    xhr.send()
  })
}

const toDataURL = url => {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.onload = function () {
        const reader = new FileReader()
        reader.onloadend = function () {
          resolve(reader.result)
        }
        reader.readAsDataURL(xhr.response)
      }
      xhr.open('GET', url)
      xhr.responseType = 'blob'
      xhr.send()
    } catch (error) {
      reject(error)
    }
  })
}

let tempGameIDList = []
function checkStatus (notify = true) {
  return new Promise(async (resolve, reject) => {
    if (allChannels.length === 0) {
      return
    }
    const tempAllChannels = allChannels.map(row => row.id)

    const results = []
    while (tempAllChannels.length > 0) { // Split Array in Chunks
      results.push(tempAllChannels.splice(0, 100))
    }

    let tempLiveChannels = []

    // https://dev.twitch.tv/docs/api/reference#get-streams
    const values = await Promise.all(results.map(result => request({ url: 'https://api.twitch.tv/helix/streams?user_id=' + result.join('&user_id='), clientID: windowSettings.clientID, OAuth: 'Bearer ' + windowSettings.OAuth })))
    for (let i = 0; i < values.length; i++) {
      if (values[i] && values[i].data && values[i].data.length) {
        tempLiveChannels = tempLiveChannels.concat(values[i].data)
      }
    }

    LiveChannelsArray = Object.keys(LiveChannels)

    const tempLiveChannelsKeys = tempLiveChannels.map(chan => chan.user_name) // neuen Channels

    const newOnline = tempLiveChannelsKeys.filter(chan => !LiveChannelsArray.includes(chan)) // https://stackoverflow.com/questions/1187518/how-to-get-the-difference-between-two-arrays-in-javascript
    if (newOnline.length) {
      console.debug('newOnline', newOnline)
    }
    newOnline.forEach(async onlineChan => {
      const chan = tempLiveChannels.find(ele => ele.user_name === onlineChan)

      LiveChannels[chan.user_name] = {
        nametoLowerCase: chan.user_name.toLowerCase(),
        game_id: chan.game_id,
        started_at: chan.started_at,
        title: chan.title,
        type: chan.type,
        viewer_count: chan.viewer_count
      }

      if (!GameIDList[chan.game_id] && chan.game_id !== '') { // eslint-disable-line camelcase
        tempGameIDList.push(chan.game_id)
      }

      if (notify && windowSettings.PriorityChannels.indexOf(chan.user_name) !== -1) {
        console.debug('notify', `${chan.user_name} is Online${chan.viewer_count === 0 ? '' : ' (' + chan.viewer_count + ')'}`)
        const iconUrl = await toDataURL(chan.thumbnail_url.replace(/{width}|{height}/g, '64'))
        pushNotification({ channel: chan.user_name, title: `${chan.user_name} is Online${chan.viewer_count === 0 ? '' : ' (' + chan.viewer_count + ')'}`, message: `${chan.title}`, iconUrl })
      }
    })

    const newOffline = LiveChannelsArray.filter(chan => !tempLiveChannelsKeys.includes(chan))
    if (newOffline.length) {
      console.debug('newOffline', newOffline)
    }

    newOffline.forEach(offlineChan => {
      delete LiveChannels[offlineChan]
    })

    tempLiveChannels.forEach(tempChan => { // falls sie die Daten ändern werden sie hier aktualisiert
      const liveChan = LiveChannels[tempChan.user_name]
      if (tempChan.game_id !== liveChan.game_id ||
        tempChan.started_at !== liveChan.started_at ||
        tempChan.title !== liveChan.title ||
        tempChan.type !== liveChan.type ||
        tempChan.viewer_count !== liveChan.viewer_count) {
        const { game_id, started_at, title, type, viewer_count } = tempChan // eslint-disable-line camelcase
        if (!GameIDList[game_id] && game_id !== '') { // eslint-disable-line camelcase
          tempGameIDList.push(game_id)
        }
        LiveChannels[tempChan.user_name] = { game_id, started_at, title, type, viewer_count }
      }
    })
    LiveChannelsArray = Object.keys(LiveChannels)
    // console.timeEnd('// TODO: needs to be improved')
    resolve(LiveChannels)
  })
}

function getGameIDList () { // TODO: Games in der Gamelist die nicht gebraucht werden sollten auch gelöscht werden
  return new Promise(async (resolve, reject) => {
    if (tempGameIDList.length) {
      // https://dev.twitch.tv/docs/api/reference#get-games
      const url = 'https://api.twitch.tv/helix/games?id=' + tempGameIDList.join('&id=')
      await request({
        url,
        clientID: windowSettings.clientID,
        OAuth: 'Bearer ' + windowSettings.OAuth
      }).then(result => {
        result.data.forEach(ele => {
          GameIDList[ele.id] = ele.name
        })
      }, reason => {
        console.warn('// rejection2', reason)
        window.alert(reason)
      })
      tempGameIDList = []
    }
    resolve()
  })
}

function getChannels () {
  return new Promise((resolve, reject) => {
    browserAPI.storage.sync.get(['clientID', 'OAuth', 'userID'], async result => { // TODO: nötig?
      if (result.clientID === '' || !result.OAuth || result.OAuth === '' || !result.userID || result.userID === '') {
        console.debug("result.clientID === '' || result.OAuth === '' || result.userID === ''")
        return
      }

      let total = 0
      let pagination = ''
      let i = 1
      while (true) {
        const count = i * 100

        let url
        if (pagination) { // https://dev.twitch.tv/docs/api/reference#get-users-follows
          url = 'https://api.twitch.tv/helix/users/follows?first=100&after=' + pagination + '&from_id=' + result.userID
        } else {
          url = 'https://api.twitch.tv/helix/users/follows?first=100&from_id=' + result.userID
        }

        try {
          const twitchResult = await request({ url, clientID: result.clientID, OAuth: 'Bearer ' + result.OAuth })
          total = twitchResult.total
          pagination = twitchResult.pagination.cursor
          const chanID = twitchResult.data.map(row => ({ id: row.to_id, name: row.to_name, nametoLowerCase: row.to_name.toLowerCase(), followed_at: row.followed_at }))
          allChannels = allChannels.concat(chanID)
        } catch (error) {
          if (error) {
            console.warn('// rejection3', error) // TODO: rejection3
            window.alert(error)
          }
        }

        if (count >= total) {
          break
        }
        i++
      }
      resolve()
    })
  })
}

function pushNotification ({ channel, title, message, iconUrl }) {
  if (isFirefox) {
    browserAPI.notifications.create(channel, { // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/create
      type: 'basic',
      title,
      priority: 0,
      iconUrl,
      message,
      contextMessage: 'Twitch Live Monitor'
      // buttons: [ // Error: Type error for parameter options (Property "buttons" is unsupported by Firefox) for notifications.create.
      //   { title: 'Open' }
      // ]
    })
  } else {
    browserAPI.notifications.create(channel, {// https://developer.chrome.com/apps/notifications#type-NotificationOptions
      type: 'basic',
      title,
      priority: 0,
      iconUrl,
      message,
      contextMessage: 'Twitch Live Monitor',
      buttons: [
        { title: 'Open' }
      ]
    })
  }
}

if (isFirefox) { // without Buttons
  browserAPI.notifications.onClicked.addListener(notificationId => {
    browserAPI.tabs.create({ url: 'https://www.twitch.tv/' + notificationId })
  })
} else {
  browserAPI.notifications.onButtonClicked.addListener(notificationId => {
    browserAPI.tabs.create({ url: 'https://www.twitch.tv/' + notificationId })
  })
}

;(async () => {
  browserAPI.browserAction.setBadgeBackgroundColor({ color: '#9146FF' }) // https://brand.twitch.tv/
  if (isFirefox) browserAPI.browserAction.setBadgeTextColor({ color: '#f0f0f0' })

  browserAPI.storage.sync.get(null, result => { // init Data
    windowSettings = result

    window.getInit(true)
    window.setInterval(async () => {
      window.getInit()
    }, UPDATE_INTERVAL)

    if (windowSettings && windowSettings.PriorityChannels && windowSettings.PriorityChannels.length < 51) {
      connect().then(() => {
        listen(windowSettings.PriorityChannels.map(chan => `video-playback.${chan.toLowerCase()}`))
      })
    }
  })
})()

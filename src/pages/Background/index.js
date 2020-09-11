/* global window, chrome, browser, WebSocket, FileReader, XMLHttpRequest */

import '../../assets/img/tw128px.png'
import '../../assets/img/bw128px.png'

const re = /^https:\/\/github.com\/spddl\/Twitch-Live-Monitor#access_token=(.*?)&scope=user_read&token_type=bearer$/

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

let ws
const UPDATE_INTERVAL = 60 * 1000 * 2 // 2 minutes
// const UPDATE_INTERVAL = 25 * 1000 // debug
let LiveChannels = {}
const GameIDList = {}
let allChannels = []
let windowSettings = {}

const storageGet = (params = null) => {
  return new Promise((resolve, reject) => {
    browserAPI.storage.sync.get(params, result => {
      resolve(result)
    })
  })
}

const OAuthListener = (tabId, changeInfo, tab) => { // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onCreated
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const urlRegex = changeInfo.url.match(re)
    if (urlRegex !== null) {
      window.settingsReducer({ type: 'SET', value: { name: 'OAuth', value: urlRegex[1] } })
      const { OAuth, clientID, userID, accountnameInput } = window.settingsReducer({ type: 'GETALL' }) || {}
      if (!userID) {
        const url = 'https://api.twitch.tv/kraken/users?login=' + accountnameInput
        request({ url, clientID, OAuth }).then(data => {
          if (data._total === 1) {
            window.settingsReducer({ type: 'SET', value: { name: 'userID', value: data.users[0]._id } })
            window.settingsReducer({ type: 'SET', value: { name: 'accountname', value: accountnameInput } })
          } else {
            console.warn('OAuthListener, not found', { data })
          }

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

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const nonce = length => {
  let text = ''
  let i = 0
  while (i < length) {
    text += possible.charAt(Math.floor(Math.random() * possible.length)); i++
  }
  return text
}

const heartbeat = () => { ws.send('{"type":"PING"}') }

// Clients can listen on up to 50 topics per connection. Trying to listen on more topics will result in an error message.
const listen = topics => { // https://dev.twitch.tv/docs/pubsub#topics
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

const connect = () => {
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

          if (msg.type === 'stream-up') {
            if (!LiveChannels[chanName]) {
              const found = allChannels.find(element => element.nametoLowerCase === chanName)

              // https://dev.twitch.tv/docs/v5/reference/channels#get-channel-by-id
              const chan = await request({ url: 'https://api.twitch.tv/kraken/channels/' + found.id, clientID: windowSettings.clientID, OAuth: 'Bearer ' + windowSettings.OAuth })

              LiveChannels[chanName] = {
                game_id: '',
                game: chan.game,
                started_at: new Date(msg.server_time * 1000).toISOString(),
                title: chan.status || chan.description,
                type: 'live',
                viewer_count: 0
              }
              const iconUrl = await toDataURL(chan.logo)
              pushNotification({ channel: chanName, title: `${chan.display_name} is Online`, message: `${chan.status || chan.description}`, iconUrl })
            }
          } else if (msg.type === 'stream-down') {
            delete LiveChannels[chanName]
          } else if (msg.type === 'viewcount') {
            if (LiveChannels[chanName]) {
              LiveChannels[chanName].viewer_count = msg.viewers
            }
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

window.getInit = async (init = false) => {
  if (init) {
    await getChannels() // schreibt alle Channels in "allchannels"
    await checkStatus(false) // notify
  } else {
    await checkStatus()
  }
  browserAPI.browserAction.setBadgeText({ text: Object.keys(LiveChannels).length.toString() })
  await getGameIDList()
}

window.getStreams = () => LiveChannels

window.setPriorityChannelReducer = value => {
  windowSettings.PriorityChannels = value

  browserAPI.storage.sync.set({ PriorityChannels: windowSettings.PriorityChannels }, () => {
    // console.debug('setPriorityChannelReducer saved', { PriorityChannels: windowSettings.PriorityChannels })
  })
}

window.setPropertyChannelReducer = (type, value) => {
  switch (type) {
    case 'isOnline':
      windowSettings.PriorityChannels = value
      browserAPI.storage.sync.set({ PriorityChannels: value }, () => {
        // console.debug('setPriorityChannelReducer saved', { PriorityChannels: windowSettings.PriorityChannels })
      })
      break

    case 'changeTitle':
      windowSettings.changeTitleChannels = value
      browserAPI.storage.sync.set({ changeTitleChannels: value }, () => {})
      break

    case 'changeGame':
      windowSettings.changeGameChannels = value
      browserAPI.storage.sync.set({ changeGameChannels: value }, () => {})
      break

    case 'isOffline':
      windowSettings.isOfflineChannels = value
      browserAPI.storage.sync.set({ isOfflineChannels: value }, () => {})
      break

    default:
      console.warn('setPropertyChannelReducer', type, value)
  }
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

window.openLink = url => {
  browserAPI.tabs.create({ url })
}

const request = ({ url, clientID, OAuth }) => {
  return new Promise((resolve, reject) => {
    // console.debug({ url, clientID, OAuth })
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url + ((/\?/).test(url) ? '&' : '?') + new Date().getTime()) // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
    xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json')
    xhr.setRequestHeader('Authorization', OAuth)
    xhr.setRequestHeader('Client-ID', clientID)
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
      xhr.onload = () => {
        const reader = new FileReader()
        reader.onloadend = () => {
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
const checkStatus = (notify = true) => {
  return new Promise(async (resolve, reject) => {
    if (allChannels.length === 0) {
      return
    }
    const tempAllChannels = allChannels.map(row => row.id) // userId

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

    const LiveChannelsCopy = { ...LiveChannels }
    const GameIDListCopy = { ...GameIDList }

    for (let i = 0, len = tempLiveChannels.length; i < len; i++) {
      const value = tempLiveChannels[i]
      value.nametoLowerCase = value.user_name.toLowerCase()

      if (value.type !== 'live') {
        console.warn(value, 'ist nicht Live')
      }

      if (LiveChannelsCopy[value.nametoLowerCase]) { // Channel ist weiterhin Online
        if (LiveChannelsCopy[value.nametoLowerCase].game_id !== value.game_id) { // Channel spielt nicht mehr das selbe Spiel
          console.log(value.user_name, 'neues Spiel', LiveChannelsCopy[value.nametoLowerCase].game_id, '!==', value.game_id)
          console.log(value)

          if (notify && windowSettings.changeGameChannels.indexOf(value.nametoLowerCase) !== -1) { // TODO: neues Spiel property
            if (!GameIDList[value.game_id] && value.game_id !== '') { // eslint-disable-line camelcase
              await getGameIDList(value.game_id)
            }
            console.debug('notify', `${value.user_name} neues Spiel ${GameIDList[value.game_id]}`)

            const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
            pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name} (Game has changed)`, message: GameIDList[value.game_id] ? GameIDList[value.game_id] : 'undefined', iconUrl })
          }

          if (!GameIDList[value.game_id] && value.game_id !== '') { // eslint-disable-line camelcase
            tempGameIDList.push(value.game_id)
          }
        }

        if (LiveChannelsCopy[value.nametoLowerCase].title !== value.title) { // Channel spielt nicht mehr das selbe Spiel
          console.log(value.user_name, 'neuer Titel', LiveChannelsCopy[value.nametoLowerCase].title, '!==', value.title)
          console.log(value)

          if (notify && windowSettings.changeTitleChannels.indexOf(value.nametoLowerCase) !== -1) { // TODO: neuer Titel property
            console.debug('notify', `${value.user_name} neuer Titel ${value.game_id}`)
            const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
            pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name}, (new Title)`, message: value.title, iconUrl })
          }
        }

        delete LiveChannelsCopy[value.nametoLowerCase]
        delete GameIDListCopy[value.game_id]
      } else {
        if (notify) console.log(value.user_name, 'ist jetzt online')
        if (!GameIDList[value.game_id] && value.game_id !== '') { // eslint-disable-line camelcase
          tempGameIDList.push(value.game_id)
        }

        if (notify && windowSettings.PriorityChannels.indexOf(value.nametoLowerCase) !== -1) {
          console.debug('notify', `${value.user_name} is Online${value.viewer_count === 0 ? '' : ' (' + value.viewer_count + ')'}`)
          const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
          pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name} is Online${value.viewer_count === 0 ? '' : ' (' + value.viewer_count + ')'}`, message: `${value.title}`, iconUrl })
        }
      }

      LiveChannels[value.user_name.toLowerCase()] = {
        name: value.user_name,
        game_id: value.game_id,
        started_at: value.started_at,
        title: value.title,
        type: value.type,
        viewer_count: value.viewer_count,
        thumbnail_url: value.thumbnail_url
      }
    }

    for (let channel in LiveChannelsCopy) {
      if (notify && windowSettings.isOfflineChannels.indexOf(channel) !== -1) {
        console.log('isOffline', channel)
        const chan = await request({ url: 'https://api.twitch.tv/kraken/users?login=' + channel, clientID: windowSettings.clientID, OAuth: 'Bearer ' + windowSettings.OAuth })
        const targetChannel = chan.users[0]

        const iconUrl = await toDataURL(targetChannel.logo)
        pushNotification({ channel: targetChannel.display_name, title: `${targetChannel.display_name} is Offline`, iconUrl })
      }
      delete LiveChannels[channel]
    }

    for (let gameId in GameIDListCopy) {
      delete GameIDList[gameId]
    }
    resolve(LiveChannels)
  })
}

const getGameIDList = (array = []) => { // TODO: Games in der Gamelist die nicht gebraucht werden sollten auch gelöscht werden
  return new Promise(async (resolve, reject) => {
    if (array.length) {
      tempGameIDList = tempGameIDList.concat(array)
    }

    if (tempGameIDList.length) {
      // https://dev.twitch.tv/docs/api/reference#get-games
      const url = 'https://api.twitch.tv/helix/games?id=' + tempGameIDList.join('&id=')
      await request({
        url,
        clientID: windowSettings.clientID,
        OAuth: 'Bearer ' + windowSettings.OAuth
      }).then(result => {
        // console.log('getGameIDList', result)
        result.data.forEach(ele => {
          GameIDList[ele.id] = ele.name
        })
      }, reason => {
        console.warn('// getGameIDList() rejection', reason)
        window.alert(reason)
      })
      tempGameIDList = []
    }
    resolve()
  })
}

// getChannels gibt alle gefolgten Channels zurück
const getChannels = () => {
  return new Promise(async (resolve, reject) => {
    let { clientID, OAuth, userID } = windowSettings || {}
    if (clientID === '' || !OAuth || OAuth === '' || !userID || userID === '') {
      console.debug("(window.settingsReducer) clientID === '' || OAuth === '' || userID === ''")
      const result = await storageGet(['clientID', 'OAuth', 'userID'])
      // { clientID, OAuth, userID } = result
      clientID = result.clientID
      OAuth = result.OAuth
      userID = result.userID
    }

    if (clientID === '' || !OAuth || OAuth === '' || !userID || userID === '') {
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
        url = 'https://api.twitch.tv/helix/users/follows?first=100&after=' + pagination + '&from_id=' + userID
      } else {
        url = 'https://api.twitch.tv/helix/users/follows?first=100&from_id=' + userID
      }

      try {
        const twitchResult = await request({ url, clientID: clientID, OAuth: 'Bearer ' + OAuth })
        total = twitchResult.total
        pagination = twitchResult.pagination.cursor

        const chanID = twitchResult.data.map(row => ({ id: row.to_id, name: row.to_name, nametoLowerCase: row.to_name.toLowerCase(), followed_at: row.followed_at }))
        allChannels = allChannels.concat(chanID)
      } catch (error) {
        if (error) {
          console.warn('// getChannels() rejection', error)
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
}

const pushNotification = ({ channel = '', title = '', message = '', iconUrl }) => {
  console.debug('pushNotification', { channel, title, message, iconUrl })
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
    browserAPI.notifications.create(channel, { // https://developer.chrome.com/apps/notifications#type-NotificationOptions
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
  windowSettings = await storageGet() // init Data

  window.getInit(true)
  window.setInterval(async () => {
    window.getInit()
  }, UPDATE_INTERVAL)

  if (windowSettings && windowSettings.PriorityChannels && windowSettings.PriorityChannels.length < 51) {
    connect().then(() => {
      listen(windowSettings.PriorityChannels.map(chan => `video-playback.${chan.toLowerCase()}`))
    })
  }
})()

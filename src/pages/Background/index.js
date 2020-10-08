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
let allChannelsId = []
let windowSettings = {
  OAuth: '',
  clientID: '',
  PriorityChannels: [],
  changeTitleChannels: [],
  changeGameChannels: [],
  isOfflineChannels: []
}

const storageGet = (params = null) => {
  return new Promise((resolve, reject) => {
    browserAPI.storage.sync.get(params, result => {
      resolve({
        ...windowSettings,
        ...result
      })
    })
  })
}

const OAuthListener = (tabId, changeInfo, tab) => { // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onCreated
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const urlRegex = changeInfo.url.match(re)
    if (urlRegex !== null) {
      window.settingsReducer({ type: 'SET', value: { name: 'OAuth', value: urlRegex[1] } })
      const { OAuth, clientID, userID, accountnameInput } = window.settingsReducer({ type: 'GETALL' }) || {}
      browserAPI.tabs.onCreated.removeListener(OAuthListener)
      console.debug({ OAuth, clientID, userID, accountnameInput })
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
        })
      } else {
        window.getInit(true)
        if (isFirefox) {
          browserAPI.tabs.update(tab.id, { url: browser.runtime.getManifest().options_ui.page })
        } else {
          browserAPI.tabs.update(tab.id, { url: `chrome-extension://${chrome.runtime.id}/options.html` })
        }
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
                source: 'ws',
                name: chan.display_name || chan.name,
                user_id: chan._id,
                game_id: '',
                game: chan.game,
                started_at: new Date(msg.server_time * 1000).toISOString(),
                title: chan.status || chan.description,
                type: 'live',
                viewer_count: 0,
                thumbnail_url: ''
              }

              const iconUrl = await toDataURL(chan.logo)
              pushNotification({ channel: chanName, title: `${chan.display_name} is Online`, message: `${chan.status || chan.description}`, iconUrl })
            }
          } else if (msg.type === 'stream-down') {
            LiveChannels[chanName] = { disable: true }
          } else if (msg.type === 'viewcount') {
            if (LiveChannels[chanName]) {
              LiveChannels[chanName].viewer_count = msg.viewers
            }
          } else if (msg.type !== 'commercial') {
            console.warn('WS default:', chanName, msg) // {type: "commercial", server_time: 1600273745.207176, length: 60}
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
    await checkStatus(true) // init
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
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message)
    }
  })
}

window.setPropertyChannelReducer = (type, value) => {
  switch (type) {
    case 'isOnline':
      windowSettings.PriorityChannels = value
      browserAPI.storage.sync.set({ PriorityChannels: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
      })
      break

    case 'changeTitle':
      windowSettings.changeTitleChannels = value
      browserAPI.storage.sync.set({ changeTitleChannels: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
      })
      break

    case 'changeGame':
      windowSettings.changeGameChannels = value
      browserAPI.storage.sync.set({ changeGameChannels: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
      })
      break

    case 'isOffline':
      windowSettings.isOfflineChannels = value
      browserAPI.storage.sync.set({ isOfflineChannels: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
      })
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
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
      })
      break
    case 'GET':
      return windowSettings[value.name]
    case 'GETALL':
      return windowSettings
    case 'CLEAR':
      browserAPI.browserAction.setBadgeText({ text: '0' })
      windowSettings = {
        OAuth: '',
        clientID: '',
        PriorityChannels: [],
        changeTitleChannels: [],
        changeGameChannels: [],
        isOfflineChannels: []
      }

      LiveChannels = {}
      allChannels = []
      allChannelsId = []

      browserAPI.storage.sync.clear(() => {
        window.alert('Settings deleted')
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message)
        }
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
    window.openLink('https://www.twitch.tv/' + channelName.replace(/\s/g, ''))
  }
}

window.openLink = url => {
  browserAPI.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message)
    }
  })
}

const request = ({ url, clientID, OAuth }) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url + ((/\?/).test(url) ? '&' : '?') + new Date().getTime()) // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
    xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json')
    if (OAuth) xhr.setRequestHeader('Authorization', OAuth)
    xhr.setRequestHeader('Client-ID', clientID)
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        console.warn(url, xhr.statusText, xhr.responseText, 'oAuth', OAuth)
        // window.alert(url + " " + xhr.responseText)
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
const checkStatus = (init = false) => {
  return new Promise(async resolve => {
    if (allChannelsId.length === 0) {
      return
    }

    const tempAllChannels = [...allChannelsId]
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

    const oldLiveChannels = Object.keys(LiveChannels)
    const GameIDListCopy = Object.assign({}, GameIDList)

    for (let i = tempLiveChannels.length; i--;) {
      const value = tempLiveChannels[i]
      value.nametoLowerCase = value.user_name.toLowerCase()

      if (value.type !== 'live') {
        console.warn(value, 'ist nicht Live')
      }

      if (LiveChannels[value.nametoLowerCase] && LiveChannels[value.nametoLowerCase].disable) {
        continue
      }

      if (LiveChannels[value.nametoLowerCase]) { // Channel ist weiterhin Online
        if (LiveChannels[value.nametoLowerCase].game_id !== value.game_id && LiveChannels[value.nametoLowerCase] !== '') { // Channel spielt nicht mehr das selbe Spiel
          if (!init && windowSettings && windowSettings.changeGameChannels && windowSettings.changeGameChannels.indexOf(value.nametoLowerCase) !== -1) {
            if (!GameIDList[value.game_id]) { // eslint-disable-line camelcase
              await getGameIDList(value.game_id)
            }
            console.debug(`${value.user_name} neues Spiel ${GameIDList[value.game_id]}`)
            const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
            pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name} (Game has changed)`, message: GameIDList[value.game_id] ? GameIDList[value.game_id] : 'undefined', iconUrl })
          }

          if (!GameIDList[value.game_id]) { // eslint-disable-line camelcase
            tempGameIDList.push(value.game_id)
          }
        }

        if (LiveChannels[value.nametoLowerCase].title !== value.title) { // Channel spielt nicht mehr das selbe Spiel
          console.debug(value.user_name, 'neuer Titel', LiveChannels[value.nametoLowerCase].title, '!==', value.title, { value })
          if (!init && windowSettings && windowSettings.changeTitleChannels && windowSettings.changeTitleChannels.indexOf(value.nametoLowerCase) !== -1) {
            console.debug(`${value.user_name} neuer Titel ${value.title}`)
            const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
            pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name} (new Title)`, message: value.title, iconUrl })
          }
        }

        const indexOf = oldLiveChannels.indexOf(value.nametoLowerCase)
        if (indexOf !== -1) {
          oldLiveChannels.splice(indexOf, 1)
        }
        delete GameIDListCopy[value.game_id] // lösche jede GameID aus der Copy die verwendet werden, um später die GameIDs zu löschen die nicht genutzt werden
      } else {
        if (!init) console.log(value.user_name, 'ist jetzt online')

        if (!GameIDList[value.game_id] && value.game_id !== '') { // eslint-disable-line camelcase
          tempGameIDList.push(value.game_id)
        }

        if (!init && windowSettings && windowSettings.PriorityChannels && windowSettings.PriorityChannels.indexOf(value.nametoLowerCase) !== -1) {
          console.debug(`${value.user_name} is Online${value.viewer_count === 0 ? '' : ' (' + value.viewer_count + ')'}`)
          const iconUrl = await toDataURL(value.thumbnail_url.replace(/{width}|{height}/g, '256'))
          pushNotification({ channel: value.nametoLowerCase, title: `${value.user_name} is Online${value.viewer_count === 0 ? '' : ' (' + value.viewer_count + ')'}`, message: `${value.title}`, iconUrl })
        }
      }

      LiveChannels[value.nametoLowerCase] = {
        source: (LiveChannels[value.nametoLowerCase] && LiveChannels[value.nametoLowerCase].source) ? LiveChannels[value.nametoLowerCase].source : 'rest',
        name: value.user_name,
        user_id: value.user_id,
        game: undefined,
        game_id: value.game_id,
        started_at: value.started_at,
        title: value.title,
        type: value.type,
        viewer_count: value.viewer_count,
        thumbnail_url: value.thumbnail_url
      }
    }

    if (!init) {
      for (let i = 0, len = oldLiveChannels.length; i < len; i++) {
        const channel = LiveChannels[oldLiveChannels[i]].nametoLowerCase
        if (LiveChannels[oldLiveChannels[i]].source === 'ws') { continue } // wird übersprungen, vermutlich ist der Channel im nächsten Durchlauf "live"
        if (!init && windowSettings && windowSettings.isOfflineChannels && windowSettings.isOfflineChannels.indexOf(channel) !== -1) {
          // https://dev.twitch.tv/docs/v5/reference/users#get-user-by-id
          const targetChannel = await request({ url: 'https://api.twitch.tv/kraken/users/' + LiveChannels[oldLiveChannels[i]].user_id, clientID: windowSettings.clientID })
          const iconUrl = await toDataURL(targetChannel.logo)
          pushNotification({ channel: targetChannel.display_name, title: `${targetChannel.display_name} is Offline`, iconUrl })
        }
        delete LiveChannels[oldLiveChannels[i]]
      }
    }

    for (let gameId in GameIDListCopy) {
      delete GameIDList[gameId]
    }
    resolve(LiveChannels)
  })
}

const getGameIDList = (array = []) => {
  return new Promise(async resolve => {
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
        // window.alert(reason)
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
          // window.alert(error)
        }
      }

      if (count >= total) {
        break
      }
      i++
    }
    allChannelsId = allChannels.map(row => row.id)
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
        { title: 'Open' },
        { title: 'Close' }
      ]
    })
  }
}

if (isFirefox) { // without Buttons
  // browserAPI.notifications.onClicked.addListener((notificationId, buttonIndex) => {
  //   browserAPI.tabs.create({ url: 'https://www.twitch.tv/' + notificationId })
  // })
} else {
  browserAPI.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    switch (buttonIndex) {
      case 0: window.openLink('https://www.twitch.tv/' + notificationId.replace(/\s/g, '')); break // https://developer.chrome.com/extensions/tabs#method-create
      case 1: browserAPI.notifications.clear(notificationId); break // https://developer.chrome.com/apps/notifications#method-clear
      default:
        console.warn({ notificationId, buttonIndex })
    }
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

/* global chrome, browser, window */

import React from 'react'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import InputBase from '@material-ui/core/InputBase'
import ListItemAvatar from '@material-ui/core/ListItemAvatar'
import Avatar from '@material-ui/core/Avatar'
import Paper from '@material-ui/core/Paper'
import IconButton from '@material-ui/core/IconButton'
import SearchIcon from '@material-ui/icons/Search'
import './Popup.css'

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

const background = browserAPI.extension.getBackgroundPage()

const zeroPad2 = num => num < 10 ? '0' + num : num
function timeAgo (timeStamp, now) {
  const StartedAt = new Date(timeStamp).getTime()
  const difference = now - StartedAt
  const date = new Date(difference)

  const mm = zeroPad2(date.getMinutes())
  const ss = zeroPad2(date.getSeconds())

  if (difference >= 8.64e7) { // 1 Tag
    const HH = zeroPad2(date.getHours())
    const DD = date.getDate()
    return `${DD}:${HH}:${mm}:${ss}`
  } else if (difference >= 3.6e6) { // 1 Stunde
    const HH = zeroPad2(date.getHours())
    return `${HH}:${mm}:${ss}`
  } else {
    return `${mm}:${ss}`
  }
}

const PromiseType = /{channelName}|{timeAgo}|{viewerCount}|{startedAt}|{title}|{type}|{game}|{gameID}/g

const AwaitFunctionsSync = function ({ name, channel }) {
  switch (name) {
    case '{channelName}': return channel.name
    case '{timeAgo}': return timeAgo(channel.started_at, now)
    case '{viewerCount}': return channel.viewer_count
    case '{startedAt}': return channel.started_at
    case '{title}': return channel.title
    case '{type}': return channel.type
    case '{game}': return background.getGameIDList()[channel.game_id]
    case '{gameID}': return channel.game_id
    default:
      return 'unknown'
  }
}

const getTemplateData = (template, channel) => {
  const FunctionsFound = PromiseType[Symbol.match](template)
  if (FunctionsFound) {
    try {
      const target = FunctionsFound.map(name => AwaitFunctionsSync({ name, channel }))
      for (let i = 0; i < FunctionsFound.length; i++) {
        template = template.replace(FunctionsFound[i], target[i])
      }
      return template
    } catch (err) {
      console.error('err', err)
      return 'Error'
    }
  } else {
    return template
  }
}

const now = Date.now()
export default React.memo(function Popup () {
  const [pressed, setPressed] = React.useState([])
  const {
    checkboxDense,
    checkboxTwoLines,
    checkboxDarkMode,
    checkboxThumbnail,
    checkboxSortByViewers,
    popupFirstLine,
    popupSecondLine
  } = background.settingsReducer({ type: 'GETALL' }) || {}

  const streams = background.getStreams()
  const handleKeyDown = React.useCallback(event => {
    const { key, keyCode } = event
    if (keyCode === 13) { // Enter
      const selected = document.getElementsByClassName('Mui-focusVisible')
      if (selected.length) { // First Item
        background.openStream(selected[0].id)
      } else { // selected Item
        const firstItem = document.querySelector('li.makeStyles-listSection div')
        background.openStream(firstItem.id)
      }
      window.close()
    } else if (keyCode === 8 || keyCode === 46) { // Delete
      setPressed([])
    } else if ((keyCode > 64 && keyCode < 91 /* a - z */) || (keyCode > 47 && keyCode < 58 /* 0 - 9 */)) {
      setPressed([...pressed, key])
    }
  }, [pressed])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  })

  const GameIDList = background.getGameIDList()
  const searchBar = pressed.join('').toLowerCase()

  let list
  if (checkboxSortByViewers) {
    list = (
      <GroupByViewers
        streams={streams}
        GameIDList={GameIDList}
        searchBar={searchBar}
        checkboxDarkMode={checkboxDarkMode}
        checkboxDense={checkboxDense}
        checkboxThumbnail={checkboxThumbnail}
        popupFirstLine={popupFirstLine}
        popupSecondLine={popupSecondLine}
        checkboxTwoLines={checkboxTwoLines}
      />
    )
  } else {
    list = (
      <GroupByGames
        streams={streams}
        GameIDList={GameIDList}
        searchBar={searchBar}
        checkboxDarkMode={checkboxDarkMode}
        checkboxDense={checkboxDense}
        checkboxThumbnail={checkboxThumbnail}
        popupFirstLine={popupFirstLine}
        popupSecondLine={popupSecondLine}
        checkboxTwoLines={checkboxTwoLines}
      />
    )
  }

  return (
    <>
      {searchBar !== '' &&
        <Paper component='form' className='makeStyles-searchRoot'>
          <InputBase
            className='makeStyles-input'
            placeholder='Search...'
            value={pressed.join('')}
            inputProps={{ 'aria-label': 'search streamer/game' }}
          />
          <IconButton
            type='submit'
            className='.makeStyles-iconButton'
            aria-label='search'
          >
            <SearchIcon />
          </IconButton>
        </Paper>}
      {list}
    </>
  )
})

function GroupByGames ({ streams, GameIDList, searchBar, checkboxDarkMode, checkboxDense, checkboxThumbnail, popupFirstLine, popupSecondLine, checkboxTwoLines }) {
  const viewData = []
  for (const chanName in streams) {
    const data = streams[chanName]
    const game = data.game || GameIDList[data.game_id] || 'undefined'

    if (data.disable) {
      continue
    }

    if (searchBar !== '') { // Filter Game or Streamer
      if (chanName.toLowerCase().indexOf(searchBar) === -1 && game.toLowerCase().indexOf(searchBar) === -1) {
        continue
      }
    }

    if (viewData.find(ele => ele.game === game)) { // Spiel gefunden
      viewData.map(name => {
        if (name.game === game) {
          name.streamer.push({ name: data.name, title: data.title, started_at: data.started_at, viewer_count: data.viewer_count, type: data.type, game_id: data.game_id, thumbnail_url: data.thumbnail_url ? data.thumbnail_url.replace(/{width}|{height}/g, '40') : '' }) // neuer Streamer wird hinzugefügt
        }
        return null
      })
    } else {
      viewData.push({ // erster Streamer in diesem Spiel
        game,
        streamer: [{ name: data.name, title: data.title, started_at: data.started_at, viewer_count: data.viewer_count, type: data.type, game_id: data.game_id, thumbnail_url: data.thumbnail_url ? data.thumbnail_url.replace(/{width}|{height}/g, '40') : '' }]
      })
    }
  }

  if (viewData.length === 0 && searchBar === '') {
    viewData.push({
      game: '',
      streamer: [{ name: 'Options', title: '', started_at: 0, viewer_count: 0, type: '', game_id: '' }]
    })
  }

  return (
    <Paper className='makeStyles-searchRoot'>
      <List className={'makeStyles-root ' + ((checkboxDarkMode || false) ? 'DarkMode' : 'BrightMode')} subheader={<li />} dense={checkboxDense || false}>
        {viewData.sort((a, b) => {
          let i = 0
          while (true) {
            const aGameCharCodeAt = a.game.charCodeAt(i)
            const bGameCharCodeAt = b.game.charCodeAt(i)
            if (isNaN(aGameCharCodeAt) || isNaN(bGameCharCodeAt)) {
              return 0
            }
            if (aGameCharCodeAt !== bGameCharCodeAt) {
              if (aGameCharCodeAt < bGameCharCodeAt) {
                return -1
              } else {
                return 1
              }
            }
            i += 1
          }
        }).map((channelName, index) => (
          <li key={`section-${index}`} className='makeStyles-listSection'>
            <ul className='makeStyles-ul'>
              <ListSubheader
                style={{ cursor: 'pointer' }}
                onMouseDown={() => { background.openLink('https://www.twitch.tv/directory/game/' + encodeURI(channelName.game)); window.close() }}
              >
                {channelName.game}
              </ListSubheader>
              {channelName.streamer.sort((a, b) => {
                let i = 0
                while (true) {
                  const aNameCharCodeAt = a.name.charCodeAt(i)
                  const bNameCharCodeAt = b.name.charCodeAt(i)
                  if (isNaN(aNameCharCodeAt) || isNaN(bNameCharCodeAt)) {
                    return 0
                  }
                  if (aNameCharCodeAt !== bNameCharCodeAt) {
                    if (aNameCharCodeAt < bNameCharCodeAt) {
                      return -1
                    } else {
                      return 1
                    }
                  }
                  i += 1
                }
              }).map((channel, i) => (
                <ListItem
                  button
                  key={`item-${index}-${channel.name}`}
                  onMouseDown={() => { background.openStream(channel.name); window.close() }}
                  id={channel.name}
                >
                  {checkboxThumbnail &&
                    <ListItemAvatar>
                      <Avatar
                        variant='rounded'
                        imgProps={{ async: 'on', loading: 'lazy' }}
                        alt={channel.name}
                        src={channel.thumbnail_url}
                      />
                    </ListItemAvatar>}
                  <ListItemText
                    primary={getTemplateData(popupFirstLine, channel)}
                    secondary={(checkboxTwoLines || false) && channel.name !== 'Options' ? getTemplateData(popupSecondLine, channel) : null}
                  />
                </ListItem>
              ))}
            </ul>
          </li>
        ))}
      </List>
    </Paper>
  )
}

function GroupByViewers ({ streams, GameIDList, searchBar, checkboxDarkMode, checkboxDense, checkboxThumbnail, popupFirstLine, popupSecondLine, checkboxTwoLines }) {
  const viewData = []

  if (Object.keys(streams).length === 0 && searchBar === '') {
    viewData.push({
      game: '',
      streamer: [{ name: 'Options', title: '', started_at: 0, viewer_count: 0, type: '', game_id: '' }]
    })
  } else {
    for (const chanName in streams) {
      const data = streams[chanName]
      const game = data.game || GameIDList[data.game_id] || 'undefined'

      if (data.disable) {
        continue
      }

      if (searchBar !== '') {
        if (chanName.toLowerCase().indexOf(searchBar) === -1 && game.toLowerCase().indexOf(searchBar) === -1) {
          continue
        }
      }
      viewData.push({ name: data.name, title: data.title, started_at: data.started_at, viewer_count: data.viewer_count, type: data.type, game_id: data.game_id, thumbnail_url: data.thumbnail_url ? data.thumbnail_url.replace(/{width}|{height}/g, '40') : '' })
    }
    viewData.sort((a, b) => b.viewer_count - a.viewer_count) // highest first
  }

  return (
    <Paper className='makeStyles-searchRoot'>
      <List className={'makeStyles-root ' + ((checkboxDarkMode || false) ? 'DarkMode' : 'BrightMode')} subheader={<li />} dense={checkboxDense || false}>
        {viewData.map((channel, index) => (
          <li key={`section-${index}`} className='makeStyles-listSection'>
            <ul className='makeStyles-ul'>
              <ListItem
                button
                key={`item-${index}-${channel.name}`}
                onMouseDown={() => { background.openStream(channel.name); window.close() }}
                id={channel.name}
              >
                {checkboxThumbnail &&
                  <ListItemAvatar>
                    <Avatar
                      variant='rounded'
                      imgProps={{ async: 'on', loading: 'lazy' }}
                      alt={channel.name}
                      src={channel.thumbnail_url}
                    />
                  </ListItemAvatar>}
                <ListItemText
                  primary={getTemplateData(popupFirstLine, channel)}
                  secondary={(checkboxTwoLines || false) && channel.name !== 'Options' ? getTemplateData(popupSecondLine, channel) : null}
                />
              </ListItem>
            </ul>
          </li>
        ))}
      </List>
    </Paper>
  )
}

/* global chrome, browser, window */

import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
// import useMediaQuery from '@material-ui/core/useMediaQuery'
import InputBase from '@material-ui/core/InputBase'
import SearchIcon from '@material-ui/icons/Search'

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

const background = browserAPI.extension.getBackgroundPage()

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: theme.palette.background.paper,
    position: 'relative',
    overflow: 'auto',
    maxHeight: 592
  },
  listSection: {
    backgroundColor: 'inherit'
  },
  ul: {
    backgroundColor: 'inherit',
    padding: 0
  },
  search: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(1),
      width: 'auto'
    }
  },
  searchIcon: {
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputRoot: {
    color: 'inherit'
  },
  inputInput: {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)}px)`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '20ch'
      }
    }
  }
}))

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

export default function Popup () {
  const classes = useStyles()

  const [pressed, setPressed] = React.useState([])

  const { checkboxDense, checkboxTwoLines, checkboxDarkMode } = background.settingsReducer({ type: 'GETALL' }) || {}

  const streams = background.getStreams()

  const handleKeyDown = React.useCallback(event => {
    const { key, keyCode } = event
    if (keyCode === 8 || keyCode === 46) { // Delete
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

  const viewData = []
  for (const chanName in streams) {
    const data = streams[chanName]
    const game = data.game || GameIDList[data.game_id] || 'undefined'

    if (searchBar !== '') { // Filter Game
      if (chanName.toLowerCase().indexOf(searchBar) === -1 && game.toLowerCase().indexOf(searchBar) === -1) {
        continue
      }
    }

    if (viewData.find(ele => ele.game === game)) { // Spiel gefunden
      viewData.map(name => {
        if (name.game === game) {
          name.streamer.push({ name: chanName, title: data.title, started_at: data.started_at, viewer_count: data.viewer_count, type: data.type, game_id: data.game_id }) // neuer Streamer wird hinzugefügt
        }
        return null
      })
    } else {
      viewData.push({ // erster Streamer in diesem Spiel
        game,
        streamer: [{ name: chanName, title: data.title, started_at: data.started_at, viewer_count: data.viewer_count, type: data.type, game_id: data.game_id }]
      })
    }
  }

  if (viewData.length === 0 && searchBar === '') {
    viewData.push({
      game: '',
      streamer: [{ name: 'Options', title: '', started_at: 0, viewer_count: 0, type: '', game_id: '' }]
    })
  }

  const now = new Date().getTime()
  return (
    <>
      {searchBar !== '' &&
        <div className={classes.search}>
          <div className={classes.searchIcon}>
            <SearchIcon />
          </div>
          <InputBase
            placeholder='Search…'
            value={pressed.join('')}
            classes={{
              root: classes.inputRoot,
              input: classes.inputInput
            }}
            inputProps={{ 'aria-label': 'search' }}
          />
        </div>
      }
      {viewData.length !== 0 &&
      <List className={classes.root + ' ' + ((checkboxDarkMode || false) ? 'DarkMode' : 'BrightMode')} subheader={<li />} dense={checkboxDense || false} >
        {viewData.map((channelName, index) => (
          <li key={`section-${index}`} className={classes.listSection}>
            <ul className={classes.ul}>
              <ListSubheader>{channelName.game}</ListSubheader>
              {channelName.streamer.map((channel, i) => (
                <ListItem button key={`item-${index}-${channel.name}`}>
                  <ListItemText
                    primary={channel.name}
                    secondary={(checkboxTwoLines || false) && channel.name !== 'Options' ? `viewer: ${channel.viewer_count}, uptime: ${timeAgo(channel.started_at, now)}` : null}
                    onMouseDown={() => { background.openStream(channel.name); window.close() }}
                  />
                </ListItem>
              ))}
            </ul>
          </li>
        ))
        }
      </List>
      }
    </>
  )
}

/* global chrome */

import React from 'react'
import { render } from 'react-dom'

import { createMuiTheme } from '@material-ui/core/styles'
import { ThemeProvider } from '@material-ui/styles'
import CssBaseline from '@material-ui/core/CssBaseline'

import Popup from './Popup'
import './index.css'

const background = chrome.extension.getBackgroundPage()
const darkmode = background.settingsReducer({ type: 'GET', value: { name: 'checkboxDarkMode' } }) || false

const theme = createMuiTheme({
  palette: {
    type: (darkmode ? 'dark' : 'light')
  }
})

render((
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Popup />
  </ThemeProvider>
), document.getElementById('app-container'))

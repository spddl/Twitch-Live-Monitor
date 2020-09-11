/* eslint-disable no-restricted-globals */
/* global chrome, browser */

import React from 'react'
import { lighten, makeStyles, withStyles } from '@material-ui/core/styles'
import CssBaseline from '@material-ui/core/CssBaseline'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import TextField from '@material-ui/core/TextField'
import { Button } from '@material-ui/core'
import Checkbox from '@material-ui/core/Checkbox'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormControl from '@material-ui/core/FormControl'

import PropTypes from 'prop-types'
import clsx from 'clsx'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TablePagination from '@material-ui/core/TablePagination'
import TableRow from '@material-ui/core/TableRow'
import TableSortLabel from '@material-ui/core/TableSortLabel'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import Paper from '@material-ui/core/Paper'
import Link from '@material-ui/core/Link'

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

const background = browserAPI.extension.getBackgroundPage()

// chrome.storage.sync.clear(success => {
//   console.debug('chrome.storage.sync.clear', success)
// })

// chrome.storage.sync.get(null, result => {
//   console.debug('// DEBUG: chrome.storage.sync', result)
// })

const clientIDApp = 's8gs9idntg25gl66k3w73y7ck02a6r'

browserAPI.storage.sync.get('clientID', result => {
  if (result.clientID !== clientIDApp) { // https://developer.chrome.com/extensions/storage
    background.settingsReducer({ type: 'SET', value: { name: 'clientID', value: clientIDApp } })
  }
})

const allRows = background.getAllChannels()

function descendingComparator (a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1
  }
  if (b[orderBy] > a[orderBy]) {
    return 1
  }
  return 0
}

function getComparator (order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

function stableSort (array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index])
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0])
    if (order !== 0) return order
    return a[1] - b[1]
  })
  return stabilizedThis.map(el => el[0])
}

const headCells = [
  { id: 'name', numeric: false, disablePadding: true, label: 'Twitch Name (Notification on Online)' },
  { id: 'changeTitle', numeric: true, disablePadding: false, label: 'on Title change' },
  { id: 'changeGame', numeric: true, disablePadding: false, label: 'on changing Game' },
  { id: 'isOffline', numeric: true, disablePadding: false, label: 'when is Offline' },
  { id: 'followed_at', numeric: true, disablePadding: false, label: 'followed at' }
]

function EnhancedTableHead (props) {
  const {
    classes,
    onSelectAllClick,
    order,
    orderBy,
    numSelected,
    rowCount,
    onRequestSort
  } = props
  const createSortHandler = property => event => {
    onRequestSort(event, property)
  }

  return (
    <TableHead>
      <TableRow>
        <TableCell padding='checkbox'>
          <Checkbox
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            inputProps={{ 'aria-label': 'select all desserts' }}
          />
        </TableCell>
        {headCells.map(headCell => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? 'right' : 'left'}
            padding={headCell.disablePadding ? 'none' : 'default'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <span className={classes.visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </span>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  )
}

EnhancedTableHead.propTypes = {
  classes: PropTypes.object.isRequired,
  numSelected: PropTypes.number.isRequired,
  onRequestSort: PropTypes.func.isRequired,
  onSelectAllClick: PropTypes.func.isRequired,
  order: PropTypes.oneOf(['asc', 'desc']).isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired
}

const useToolbarStyles = makeStyles(theme => ({
  root: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(1)
  },
  highlight:
    theme.palette.type === 'light'
      ? {
        color: theme.palette.secondary.main,
        backgroundColor: lighten(theme.palette.secondary.light, 0.85)
      }
      : {
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.secondary.dark
      },
  title: {
    flex: '1 1 100%'
  }
}))

const TwitchButton = withStyles(theme => ({
  root: {
    color: theme.palette.getContrastText('#6441A4'),
    backgroundColor: '#6441A4',
    '&:hover': {
      backgroundColor: '#956dd6'
    }
  }
}))(Button)

const EnhancedTableToolbar = props => {
  const classes = useToolbarStyles()
  const { numSelected } = props

  return (
    <Toolbar
      className={clsx(classes.root, {
        [classes.highlight]: numSelected > 0
      })}
    >
      {numSelected > 0 ? (
        <Typography
          className={classes.title}
          color='inherit'
          variant='subtitle1'
          component='div'
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography
          className={classes.title}
          variant='h6'
          id='tableTitle'
          component='div'
        >
            Notification when these channels go live:
        </Typography>
      )}
    </Toolbar>
  )
}

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired
}

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap'
  },
  textField: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    width: '25ch'
  },
  paper: {
    width: '100%',
    marginBottom: theme.spacing(2)
  },

  searchBar: {
    margin: theme.spacing(1)
  },

  table: {
    minWidth: 750
  },
  visuallyHidden: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    top: 20,
    width: 1
  }
}))

const save = state => {
  const OAuth = background.settingsReducer({ type: 'GET', value: { name: 'OAuth' } }) || false
  if (!OAuth) {
    background.createOAuthListener()
    browserAPI.tabs.getCurrent(tab => {
      browserAPI.tabs.update(tab.id, { url: `https://id.twitch.tv/oauth2/authorize?client_id=${clientIDApp}&redirect_uri=https://github.com/spddl/Twitch-Live-Monitor&response_type=token&scope=user_read` })
    })
  }
}

export default function Options () { // https://material-ui.com/components/tables/
  const classes = useStyles()

  const [order, setOrder] = React.useState('desc')
  const [orderBy, setOrderBy] = React.useState('followed_at')
  const [selectedPriority, setSelectedPriority] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'PriorityChannels' } }) || [])
  const [selectedChangeTitle, setSelectedChangeTitle] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'changeTitleChannels' } }) || [])
  const [selectedChangeGame, setSelectedChangeGame] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'changeGameChannels' } }) || [])
  const [selectedIsOffline, setSelectedIsOffline] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'isOfflineChannels' } }) || [])

  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(25)
  const [state, setState] = React.useState({
    accountname: background.settingsReducer({ type: 'GET', value: { name: 'accountname' } }) || '',
    accountnameInput: background.settingsReducer({ type: 'GET', value: { name: 'accountnameInput' } }) || '',
    checkboxDense: background.settingsReducer({ type: 'GET', value: { name: 'checkboxDense' } }) || false,
    checkboxTwoLines: background.settingsReducer({ type: 'GET', value: { name: 'checkboxTwoLines' } }) || false,
    checkboxDarkMode: background.settingsReducer({ type: 'GET', value: { name: 'checkboxDarkMode' } }) || false,
    checkboxThumbnail: background.settingsReducer({ type: 'GET', value: { name: 'checkboxThumbnail' } }) || false
  })
  let rowsPerPageOptions = [25, 50, 100, 200]
  if (allRows.length > 200) {
    rowsPerPageOptions.push(allRows.length)
  }

  const [filter, setfilter] = React.useState('')
  const lowercasedFilter = filter.toLowerCase()
  let rows
  if (lowercasedFilter === '') {
    rows = allRows
  } else {
    rows = allRows.filter(item => item.nametoLowerCase.indexOf(lowercasedFilter) !== -1)
  }

  const OAuth = background.settingsReducer({ type: 'GET', value: { name: 'OAuth' } }) || ''
  const userID = background.settingsReducer({ type: 'GET', value: { name: 'userID' } }) || ''

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllClick = event => {
    if (event.target.checked) {
      const newSelecteds = rows.map(n => n.name)
      background.setPriorityChannelReducer(newSelecteds)
      setSelectedPriority(newSelecteds)

      return
    }
    background.setPriorityChannelReducer([])
    setSelectedPriority([])
  }

  const handleClickWrapper = (type, name) => {
    const nametoLowerCase = name.toLowerCase()
    let array
    let newSelected = []
    switch (type) {
      case 'isOnline': array = selectedPriority; break
      case 'changeTitle': array = selectedChangeTitle; break
      case 'changeGame': array = selectedChangeGame; break
      case 'isOffline': array = selectedIsOffline; break
      default:
        console.warn('handleClickWrapper', type, name, nametoLowerCase)
    }
    const selectedIndex = array.indexOf(nametoLowerCase)
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(array, nametoLowerCase)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(array.slice(1))
    } else if (selectedIndex === array.length - 1) {
      newSelected = newSelected.concat(array.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        array.slice(0, selectedIndex),
        array.slice(selectedIndex + 1)
      )
    }

    switch (type) {
      case 'isOnline': setSelectedPriority(newSelected); break
      case 'changeTitle': setSelectedChangeTitle(newSelected); break
      case 'changeGame': setSelectedChangeGame(newSelected); break
      case 'isOffline': setSelectedIsOffline(newSelected); break
      default:
        console.warn('handleClickWrapper', type, name, nametoLowerCase)
    }

    background.setPropertyChannelReducer(type, newSelected)
  }

  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = event => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const isSelected = name => selectedPriority.indexOf(name) !== -1

  const emptyRows = rowsPerPage - Math.min(rowsPerPage, rows.length - page * rowsPerPage)
  if (page !== 0 && rowsPerPage > rows.length) {
    setPage(0)
  }

  const handleChange = event => {
    event.persist()
    const name = event.target.name
    let value

    if (name === 'accountnameInput' || name === 'updateRate') {
      value = event.target.value
    } else {
      value = event.target.checked
    }
    setState((prevState, props) => {
      return { ...prevState, [name]: value }
    })
    background.settingsReducer({ type: 'SET', value: { name, value } })
  }

  let NotificationTable
  if (userID !== '' && OAuth !== '' && state.accountname !== '' && rows.length === 0 && filter === '') {
    NotificationTable =
      <Grid item xs={12}>
        <Typography variant='h4' component='h2' onClick={window.location.reload(false)}>
          Try to Reload
        </Typography>
      </Grid >
  } else if (rows.length > 0 || filter !== '') {
    NotificationTable =
      <Grid item xs={12}>
        <div className={classes.root}>
          <Paper className={classes.paper}>
            <TextField id='standard-basic' className={classes.textField + ' ' + classes.searchBar} label='Search...' onChange={(e) => { setfilter(e.target.value) }} />
            <EnhancedTableToolbar numSelected={selectedPriority.length} />
            <TableContainer>
              <Table
                className={classes.table}
                aria-labelledby='tableTitle'
                size='small'
                aria-label='enhanced table'
              >
                <EnhancedTableHead
                  classes={classes}
                  numSelected={selectedPriority.length}
                  order={order}
                  orderBy={orderBy}
                  onSelectAllClick={handleSelectAllClick}
                  onRequestSort={handleRequestSort}
                  rowCount={rows.length}
                />
                <TableBody>
                  {stableSort(rows, getComparator(order, orderBy))
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row, index) => {
                      const isItemSelected = isSelected(row.nametoLowerCase)
                      const labelId = `enhanced-table-checkbox-${index}`
                      return (
                        <TableRow
                          hover
                          role='checkbox'
                          aria-checked={isItemSelected}
                          tabIndex={-1}
                          key={row.id}
                          selected={isItemSelected}
                        >
                          <TableCell padding='checkbox'>
                            <Checkbox
                              onClick={() => handleClickWrapper('isOnline', row.nametoLowerCase)}
                              checked={isItemSelected}
                              inputProps={{ 'aria-labelledby': labelId }}
                            />
                          </TableCell>

                          <TableCell
                            component='th'
                            id={labelId}
                            scope='row'
                            padding='none'
                          >
                            <Link href={'https://www.twitch.tv/' + row.name} color='inherit' target='_blank' rel='noopener'>
                              {row.name}
                            </Link>
                            {/* <Link href='#' onClick={() => background.openLink('https://www.twitch.tv/' + row.name)} color='inherit' style={{ cursor: 'pointer' }}>
                              {row.name}
                            </Link> */}
                          </TableCell>
                          <TableCell align='right'>
                            <Checkbox // changeTitle
                              onClick={() => handleClickWrapper('changeTitle', row.nametoLowerCase)}
                              checked={selectedChangeTitle.indexOf(row.nametoLowerCase) !== -1}
                            />
                          </TableCell>
                          <TableCell align='right'>
                            <Checkbox // changeGame
                              onClick={() => handleClickWrapper('changeGame', row.nametoLowerCase)}
                              checked={selectedChangeGame.indexOf(row.nametoLowerCase) !== -1}
                            />
                          </TableCell>
                          <TableCell align='right'>
                            <Checkbox // isOffline
                              onClick={() => handleClickWrapper('isOffline', row.nametoLowerCase)}
                              checked={selectedIsOffline.indexOf(row.nametoLowerCase) !== -1}
                            />
                          </TableCell>

                          <TableCell align='right'>{row.followed_at}</TableCell>
                        </TableRow>
                      )
                    })}
                  {emptyRows > 0 && (
                    <TableRow style={{ height: 33 * emptyRows }}>
                      <TableCell colSpan={6} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={rowsPerPageOptions}
              component='div'
              count={rows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onChangePage={handleChangePage}
              onChangeRowsPerPage={handleChangeRowsPerPage}
            />
          </Paper>
        </div>
      </Grid >
  }

  return (
    <React.Fragment>
      <CssBaseline />
      <Container fixed>
        <Grid container spacing={3}>

          <Grid item xs={12} lg={12}>
            <FormControl fullWidth>
              <TextField
                id='accountnameInput'
                name='accountnameInput'
                placeholder='Twitch.tv Account Name'
                helperText='Twitch.tv Account Name'
                fullWidth
                margin='normal'
                InputLabelProps={{
                  shrink: true
                }}
                value={state.accountnameInput || state.accountname}
                onChange={handleChange}
              />
            </FormControl>
          </Grid>

          <Grid item xs={12} lg={6}>
            <FormControlLabel
              control={<Checkbox checked={state.checkboxDense} onChange={handleChange} name='checkboxDense' />}
              label='Styles the density of the list, making it appear more compact.'
            />
          </Grid>

          <Grid item xs={12} lg={6}>
            <FormControlLabel
              control={<Checkbox checked={state.checkboxTwoLines} onChange={handleChange} name='checkboxTwoLines' />}
              label='Two Lines in popup List, viewers and uptime in the second line'
            />
          </Grid>

          <Grid item xs={12} lg={6}>
            <FormControlLabel
              control={<Checkbox checked={state.checkboxDarkMode} onChange={handleChange} name='checkboxDarkMode' />}
              label='Popup List on Darkmode'
            />
          </Grid>

          <Grid item xs={12} lg={6}>
            <FormControlLabel
              control={<Checkbox checked={state.checkboxThumbnail} onChange={handleChange} name='checkboxThumbnail' />}
              label='Thumbnail in List'
            />
          </Grid>

          <Grid container item justify='space-between'>
            <TwitchButton variant='contained' color='primary' onClick={() => save(state)} disabled={state.accountnameInput === '' || state.accountnameInput === state.accountname}>
              Twitch Login
            </TwitchButton>

            <Button variant='outlined' color='secondary' disabled={userID === '' && OAuth === ''} onClick={() => background.settingsReducer({ type: 'CLEAR' })}>
              Clear Data
            </Button>
          </Grid>

          {NotificationTable}
        </Grid >
      </Container >
    </React.Fragment >
  )
}

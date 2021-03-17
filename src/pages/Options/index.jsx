/* global chrome, browser, location */

import React from 'react'
import ReactDOM from 'react-dom'

import { lighten, makeStyles, withStyles } from '@material-ui/core/styles'
import CssBaseline from '@material-ui/core/CssBaseline'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import ButtonGroup from '@material-ui/core/ButtonGroup'
import Checkbox from '@material-ui/core/Checkbox'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormControl from '@material-ui/core/FormControl'
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
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Chip from '@material-ui/core/Chip'
import Snackbar from '@material-ui/core/Snackbar'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import './index.css'

const isFirefox = typeof browser !== 'undefined'
const browserAPI = isFirefox ? browser : chrome

const background = browserAPI.extension.getBackgroundPage()

// chrome.storage.sync.clear(success => {
//   console.debug('chrome.storage.sync.clear', success)
// })

// chrome.storage.sync.get(null, result => {
//   console.debug('// DEBUG: chrome.storage.sync', result)
// })

// const clientIDApp = 's8gs9idntg25gl66k3w73y7ck02a6r'

// browserAPI.storage.sync.get('clientID', result => {
//   if (result.clientID !== clientIDApp) { // https://developer.chrome.com/extensions/storage
//     background.settingsReducer({ type: 'SET', value: { name: 'clientID', value: clientIDApp } })
//   }
// })

let allRows = background.getAllChannels()

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
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular
  },
  chipDiv: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5)
    }
  }
}))

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
              {orderBy === headCell.id &&
                <span className={classes.visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </span>}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  )
}

const EnhancedTableToolbar = props => {
  const classes = useToolbarStyles()
  const { numSelected } = props
  let title
  if (numSelected > 0) {
    title = (
      <Typography
        className={classes.title}
        color='inherit'
        variant='subtitle1'
        component='div'
      >
        {numSelected}/50 selected,
        {numSelected < 51
          ? ' Realtime Online Notification activated'
          : ' Realtime Online Notification deactivated'}
      </Typography>
    )
  } else {
    title = (
      <Typography
        className={classes.title}
        variant='h6'
        id='tableTitle'
        component='div'
      >
        Notification when these channels go live:
      </Typography>
    )
  }
  return (
    <Toolbar
      className={clsx(classes.root, {
        [classes.highlight]: numSelected > 0
      })}
    >
      {title}
    </Toolbar>
  )
}

const save = () => {
  const OAuth = background.settingsReducer({ type: 'GET', value: { name: 'OAuth' } }) || false
  if (!OAuth) {
    background.createNewOAuth()
  }
}

function Options () { // https://material-ui.com/components/tables/
  const classes = useStyles()

  const [order, setOrder] = React.useState('desc')
  const [orderBy, setOrderBy] = React.useState('followed_at')
  const [selectedPriority, setSelectedPriority] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'PriorityChannels' } }) || [])
  const [selectedChangeTitle, setSelectedChangeTitle] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'changeTitleChannels' } }) || [])
  const [selectedChangeGame, setSelectedChangeGame] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'changeGameChannels' } }) || [])
  const [selectedIsOffline, setSelectedIsOffline] = React.useState(background.settingsReducer({ type: 'GET', value: { name: 'isOfflineChannels' } }) || [])

  const [openDialogPopup, setOpenDialogPopup] = React.useState(false)

  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(25)
  const [state, setState] = React.useState({
    accountname: background.settingsReducer({ type: 'GET', value: { name: 'accountname' } }) || '',
    accountnameInput: background.settingsReducer({ type: 'GET', value: { name: 'accountnameInput' } }) || '',
    checkboxDense: background.settingsReducer({ type: 'GET', value: { name: 'checkboxDense' } }) || false,
    checkboxDarkMode: background.settingsReducer({ type: 'GET', value: { name: 'checkboxDarkMode' } }) || false,
    checkboxThumbnail: background.settingsReducer({ type: 'GET', value: { name: 'checkboxThumbnail' } }) || false,
    checkboxSortByViewers: background.settingsReducer({ type: 'GET', value: { name: 'checkboxSortByViewers' } }) || false,
    popupFirstLine: background.settingsReducer({ type: 'GET', value: { name: 'popupFirstLine' } }) || '',
    popupSecondLine: background.settingsReducer({ type: 'GET', value: { name: 'popupSecondLine' } }) || '',
    popupThirdLine: background.settingsReducer({ type: 'GET', value: { name: 'popupThirdLine' } }) || ''
  })

  const [openSnackbar, setOpenSnackbar] = React.useState(false)
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setOpenSnackbar(false)
  }

  const handleClickOpenDialogPopup = () => { setOpenDialogPopup(true) }
  const handleCloseDialogPopup = () => { setOpenDialogPopup(false) }

  const copyClick = name => {
    navigator.clipboard.writeText(name).then(() => { // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
      setOpenSnackbar(true)
    })
  }

  const rowsPerPageOptions = [25, 50, 100, 200]
  if (allRows.length > 200) {
    rowsPerPageOptions.push(allRows.length)
  }

  const [filter, setfilter] = React.useState('')
  let rows
  if (filter === '') {
    rows = allRows
  } else {
    const filterToLowerCase = filter.toLowerCase()
    rows = allRows.filter(item => item.nametoLowerCase.indexOf(filterToLowerCase) !== -1)
  }

  let OAuth = background.settingsReducer({ type: 'GET', value: { name: 'OAuth' } }) || ''
  let userID = background.settingsReducer({ type: 'GET', value: { name: 'userID' } }) || ''

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

  const handleButtonChange = event => {
    if (event.persist) {
      event.persist()
    }
    const name = event.target.id || event.target.parentNode.id || event.target.parentNode.parentNode.id
    setState((prevState, props) => {
      background.settingsReducer({ type: 'SET', value: { name, value: !prevState[name] } })
      return { ...prevState, [name]: !prevState[name] }
    })
  }

  const handleChange = event => {
    if (event.persist) {
      event.persist()
    }
    const name = event.target.name
    let value
    if (name === 'accountnameInput' ||
      name === 'popupFirstLine' ||
      name === 'popupSecondLine' ||
      name === 'popupThirdLine') {
      value = event.target.value
    } else {
      value = event.target.checked
    }
    setState((prevState, props) => {
      background.settingsReducer({ type: 'SET', value: { name, value } })
      return { ...prevState, [name]: value }
    })
  }

  let NotificationTable
  if (userID !== '' && OAuth !== '' && state.accountname !== '' && rows.length === 0 && filter === '') {
    console.debug({ userID, OAuth, stateAccountName: state.accountname, rowsLength: rows.length, filter, state })
    NotificationTable = (
      <Grid item xs={12}>
        <Typography variant='h4' component='h2' onClick={() => location.reload()}>
          Try to Reload
        </Typography>
      </Grid>
    )
  } else if (rows.length > 0 || filter !== '') {
    NotificationTable = (
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
                            <Link href={'https://www.twitch.tv/' + row.name} color='inherit' target='_blank' rel='noopener noreferrer'> {/* https://www.pixelstech.net/article/1537002042-The-danger-of-target=_blank-and-opener */}
                              {row.name}
                            </Link>
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
      </Grid>
    )
  }

  return (
    <>
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

          <Grid item xs={12} lg={6}>
            <ButtonGroup disableElevation variant='contained' color='primary' onClick={handleButtonChange} id='checkboxSortByViewers'>
              <Button disabled={state.checkboxSortByViewers}>Group by Games</Button>
              <Button disabled={!state.checkboxSortByViewers}>Sort by Viewers</Button>
            </ButtonGroup>
          </Grid>

          <Grid container item>
            <Button variant='outlined' color='secondary' onClick={handleClickOpenDialogPopup}>
              Edit Popup Template
            </Button>
            <Dialog open={openDialogPopup} onClose={handleCloseDialogPopup} aria-labelledby='form-dialog-title'>
              <DialogTitle id='form-dialog-title'>Popup Template</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  It is possible to change the content of the line, in addition we use variables which are later replaced by the correct value.
                </DialogContentText>

                Copy some Var's
                <div className={classes.chipDiv}>
                  <Chip label='{channelName}' variant='outlined' color='primary' onClick={() => copyClick('{channelName}')} />
                  <Chip label='{timeAgo}' variant='outlined' color='primary' onClick={() => copyClick('{timeAgo}')} />
                  <Chip label='{viewerCount}' variant='outlined' color='primary' onClick={() => copyClick('{viewerCount}')} />
                  <Chip label='{startedAt}' variant='outlined' color='primary' onClick={() => copyClick('{startedAt}')} />
                  <Chip label='{title}' variant='outlined' color='primary' onClick={() => copyClick('{title}')} />
                  <Chip label='{game}' variant='outlined' color='primary' onClick={() => copyClick('{game}')} />
                </div>

                <TextField
                  autoFocus
                  margin='dense'
                  name='popupFirstLine'
                  label='First Line'
                  type='text'
                  fullWidth
                  value={state.popupFirstLine}
                  onChange={handleChange}
                />

                <TextField
                  autoFocus
                  margin='dense'
                  name='popupSecondLine'
                  label='Second Line'
                  type='text'
                  fullWidth
                  value={state.popupSecondLine}
                  onChange={handleChange}
                />

                <TextField
                  autoFocus
                  margin='dense'
                  name='popupThirdLine'
                  label='Third Line'
                  type='text'
                  fullWidth
                  value={state.popupThirdLine}
                  onChange={handleChange}
                />
              </DialogContent>
              <DialogActions>
                <Button
                  color='primary' onClick={() => {
                    handleCloseDialogPopup()
                    handleChange({ target: { name: 'popupFirstLine', value: '{channelName}' } })
                    handleChange({ target: { name: 'popupSecondLine', value: 'viewer: {viewerCount}, uptime: {timeAgo}' } })
                    handleChange({ target: { name: 'popupThirdLine', value: '' } })
                  }}
                >
                  Reset to default
                </Button>
                <Button onClick={handleCloseDialogPopup} color='primary'>
                  OK
                </Button>
              </DialogActions>
            </Dialog>
          </Grid>

          <Grid container item justify='space-between'>
            <TwitchButton variant='contained' color='primary' onClick={() => save()} disabled={state.accountnameInput === '' || state.accountnameInput === state.accountname}>
              Twitch Login
            </TwitchButton>

            <Button
              variant='outlined' color='secondary' disabled={userID === '' && OAuth === ''} onClick={() => {
                background.settingsReducer({ type: 'CLEAR' })

                userID = ''
                OAuth = ''
                rows = []
                allRows = []
                setfilter('')
                // setState({ accountname: '' })
                setState((prevState, props) => {
                  return { ...prevState, accountname: '' }
                })
                location.reload()
                // OAuth !== '' && state.accountname !== '' && rows.length === 0 && filter === ''
              }}
            >
              Clear Data
            </Button>
          </Grid>

          {NotificationTable}
        </Grid>

        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          open={openSnackbar}
          autoHideDuration={600}
          onClose={handleSnackbarClose}
          message='Copy'
          action={
            <>
              <IconButton size='small' aria-label='close' color='inherit' onClick={handleSnackbarClose}>
                <CloseIcon fontSize='small' />
              </IconButton>
            </>
          }
        />

      </Container>
    </>
  )
}

ReactDOM.render(<Options />, window.document.querySelector('#app-container'))

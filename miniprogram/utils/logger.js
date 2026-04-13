const fs = wx.getFileSystemManager()
const DEBUG_DIR = `${wx.env.USER_DATA_PATH}/debug/`

const ENABLED = true

const LOG_LEVEL = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
}

function padZero(n) {
  return String(n).padStart(2, '0')
}

function getTimeStr() {
  const d = new Date()
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())} ${padZero(d.getHours())}:${padZero(d.getMinutes())}:${padZero(d.getSeconds())}`
}

function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`
}

function ensureDir() {
  return new Promise((resolve) => {
    fs.mkdir({
      dirPath: DEBUG_DIR,
      recursive: true,
      success: () => resolve(),
      fail: () => resolve()
    })
  })
}

function writeLog(level, tag, data) {
  if (!ENABLED) return

  const timestamp = getTimeStr()
  const content = data === undefined ? tag : `${tag}: ${JSON.stringify(data)}`
  const logLine = `[${timestamp}] [${level}] ${content}\n`

  console.log(logLine.trim())

  const fileName = `${getDateStr()}.log`
  const filePath = DEBUG_DIR + fileName

  ensureDir().then(() => {
    fs.readFile({
      filePath: filePath,
      encoding: 'utf8',
      success: (res) => {
        fs.writeFile({
          filePath: filePath,
          data: res.data + logLine,
          encoding: 'utf8',
          fail: () => {}
        })
      },
      fail: () => {
        fs.writeFile({
          filePath: filePath,
          data: logLine,
          encoding: 'utf8',
          fail: () => {}
        })
      }
    })
  })
}

function debug(tag, data) {
  writeLog(LOG_LEVEL.debug, tag, data)
}

function info(tag, data) {
  writeLog(LOG_LEVEL.info, tag, data)
}

function warn(tag, data) {
  writeLog(LOG_LEVEL.warn, tag, data)
}

function error(tag, data) {
  writeLog(LOG_LEVEL.error, tag, data)
}

module.exports = {
  debug,
  info,
  warn,
  error
}
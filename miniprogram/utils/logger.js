const ENABLED = false

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

function writeLog(level, tag, data) {
  if (!ENABLED) return
  const timestamp = getTimeStr()
  const content = data === undefined ? tag : `${tag}: ${JSON.stringify(data)}`
  const logLine = `[${timestamp}] [${level}] ${content}`
  console.log(logLine)
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
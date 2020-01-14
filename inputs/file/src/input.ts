import fs from 'fs'
import { Socket } from 'net'
import path from 'path'
import { promisify } from 'util'
import {
  FileInputConfig,
  FileSizeMap,
  InputConfig,
} from './types'

const openAsync = promisify(fs.open)
const readAsync = promisify(fs.read)
const readdirAsync = promisify(fs.readdir)
const statAsync = promisify(fs.stat)
const env = process.env
const fds: {[filePath: string]: number} = {}

/**
 * Get initial byte sizes of each file that will be watched
 */
async function initializeFileSizes(
  inputPath: string,
  isDir: boolean,
): Promise<FileSizeMap> {
  const fileSizes: FileSizeMap = {}
  if (isDir) {
    const files = await readdirAsync(inputPath)
    await Promise.all(files.map(async (fileName) => {
      const filePath = path.join(inputPath, fileName)
      const fileStat = await statAsync(filePath)
      if (!fileStat.isDirectory()) {
        fileSizes[filePath] = fileStat.size
      }
    }))
  } else {
    fileSizes[inputPath] = (await statAsync(inputPath)).size
  }
  return fileSizes
}

/**
 * Reads new lines from file on disk and sends them to the server
 */
async function sendNewMessages(
  client: Socket,
  streamName: string,
  sourceName: string,
  filePath: string,
  newSize: number,
  oldSize: number,
): Promise<void> {
  let fd = fds[filePath]
  if (!fd) {
    fd = await openAsync(filePath, 'r')
    fds[filePath] = fd
  }
  const readBuffer = Buffer.alloc(newSize - oldSize)
  await readAsync(fd, readBuffer, 0, newSize - oldSize, oldSize)
  const messages = readBuffer.toString().split('\r\n').filter(msg => !!msg.trim())
  messages.forEach((message) => {
    console.log(`+msg|${streamName}|${sourceName}|${message}`)

    client.write(`+msg|${streamName}|${sourceName}|${message}\0`)
  })
}

/**
 * Sends an input registration to server
 */
async function sendInput(
  client: Socket,
  input: FileInputConfig,
): Promise<void> {
  client.write(`+input|${input.stream}|${input.source}\0`)
}

/**
 * Initializes file watcher for the provided path
 */
async function startFileWatcher(
  client: Socket,
  streamName: string,
  sourceName: string,
  inputPath: string,
): Promise<void> {
  const isDir = (await statAsync(inputPath)).isDirectory()
  const fileSizes = await initializeFileSizes(inputPath, isDir)
  const watcher = fs.watch(inputPath)
  watcher.on('change', async (eventType: string, fileName: string) => {
    console.log(`change : ${eventType} ${fileName}`)

    const filePath = isDir ? path.join(inputPath, fileName) : inputPath
    const newSize = (await statAsync(filePath)).size
    await sendNewMessages(
      client,
      streamName,
      sourceName,
      filePath,
      newSize,
      fileSizes[filePath] || 0,
    )
    fileSizes[filePath] = newSize
  })
}

/**
 * Async sleep helper
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Start file input process
 */
async function main(config: InputConfig): Promise<void> {
  const {  inputs } = config
  const serverStr = `${env.MESSAGE_SERVER_HOST}:${env.MESSAGE_SERVER_PORT}`
  const client = new Socket()
  let lastConnectionAttempt = new Date().getTime()
  // Register new inputs w/ server
  client.on('connect', async () => {
    // eslint-disable-next-line no-console
    console.log(`Connected to server: ${serverStr}`)
    await Promise.all(inputs.map(async (input) => {
      sendInput(client, input)
    }))
  })
  // Reconnect to server if an error occurs while sending a message
  client.on('error', async () => {
    const currTime = new Date().getTime()
    if (currTime - lastConnectionAttempt > 5000) {
      lastConnectionAttempt = new Date().getTime()
      // eslint-disable-next-line no-console
      console.error(`Unable to connect to server (${serverStr}), retrying...`)
      await sleep(5000)
      client.connect(env.MESSAGE_SERVER_PORT, env.MESSAGE_SERVER_HOST)
    }
  })
  // Connect to server & start watching files for changes
  client.connect(env.MESSAGE_SERVER_PORT, env.MESSAGE_SERVER_HOST)
  await Promise.all(inputs.map(async (input) => (
    startFileWatcher(client, input.stream, input.source, input.config.path)
  )))
}

export default main

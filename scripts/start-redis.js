const net = require('net')
const { spawn } = require('child_process')

const REDIS_BIN = process.env.REDIS_PATH || 'C:\\Users\\saies\\AppData\\Local\\Microsoft\\WinGet\\Packages\\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\\Redis-8.8.0-Windows-x64-msys2\\redis-server.exe'

const client = net.connect({ port: 6379 }, () => {
  console.log('[REDIS] Redis is already running on port 6379.')
  client.end()
  process.exit(0)
})

client.on('error', () => {
  console.log('[REDIS] Redis is not running. Starting Redis server on port 6379...')
  const proc = spawn(REDIS_BIN, [], { stdio: 'inherit' })
  proc.on('error', (err) => {
    console.error('[REDIS] Failed to start Redis server:', err.message)
    process.exit(1)
  })
})

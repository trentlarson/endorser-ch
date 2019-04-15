import NodeCache from 'node-cache'

// I expect this is a singleton.
const NetworkCache = new NodeCache()

export default NetworkCache

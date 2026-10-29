/**
 * Client addresses, for limits keyed by where a request comes from.
 */

const net = require('net')

/**
 * The Express 'trust proxy' value from a TRUST_PROXY setting.
 *
 * Accepts a hop count (eg. "1") or a comma-separated list of proxy addresses
 * and subnets (eg. "10.0.0.5" or "loopback, 172.16.0.0/12"). Never returns
 * true: trusting every hop lets any client choose its own address with an
 * X-Forwarded-For header.
 *
 * @param {string|undefined} value
 * @returns {number|string[]|null} null when Express should keep its default (trust nothing)
 */
function trustProxySetting(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed === '' || /^(true|false)$/i.test(trimmed)) {
    return null
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }
  return trimmed.split(',').map((s) => s.trim()).filter((s) => s !== '')
}

/**
 * The key for per-address limits: an IPv4 address, or the /64 prefix of an
 * IPv6 address (one subscriber usually holds a whole /64). An IPv4-mapped IPv6
 * address (::ffff:1.2.3.4) counts as its IPv4 address.
 *
 * @param {string|undefined} ip - eg. req.ip
 * @returns {string}
 */
function ipRateKey(ip) {
  if (typeof ip !== 'string' || ip === '') {
    return 'unknown'
  }
  let addr = ip.split('%')[0] // drop any zone, eg. fe80::1%eth0
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) {
    addr = mapped[1]
  }
  if (!net.isIPv6(addr)) {
    return addr
  }
  // expand to 8 groups; an embedded IPv4 tail counts as 2 groups (and lies past the prefix)
  const groups = (part) => (part ? part.split(':').flatMap((g) => (g.includes('.') ? ['0', '0'] : [g])) : [])
  const [head, tail] = addr.split('::')
  const headGroups = groups(head)
  const tailGroups = groups(tail)
  const full = tail === undefined
    ? headGroups
    : [...headGroups, ...Array(8 - headGroups.length - tailGroups.length).fill('0'), ...tailGroups]
  return full.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':') + '::/64'
}

module.exports = {
  ipRateKey,
  trustProxySetting,
}

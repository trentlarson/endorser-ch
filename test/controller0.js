
// Set Up Tests

import { DateTime } from "luxon"
import { dbService } from '../server/api/services/endorser.db.service'
import testUtil from './util'

const credentials = testUtil.credentials

describe('0 - Setup', () => {

  it('should register initial user', () =>
    dbService.registrationInsert({
      did: testUtil.creds[0].did,
      epoch: DateTime.utc().toSeconds(),
      maxRegs: 16,
    })
      .then((res) => {
        // Now make them as registered last month so that they can register others
        const yesterday = DateTime.utc().minus({ month: 1 })
        const yesterdayEpoch = Math.floor(yesterday.valueOf() / 1000)
        dbService.registrationUpdateIssueDateForTests(testUtil.creds[0].did, yesterdayEpoch)
      })
  )

})

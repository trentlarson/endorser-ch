
// Set Up Tests

import { DateTime } from "luxon"
import { dbService } from '../server/api/services/endorser.db.service'
import testUtil from './util'

const credentials = testUtil.credentials

describe('0 - Setup', () => {

  it('should register initial user', () => {
    // pretend they were registered last month so they can register everyone
    const lastMonthEpoch = DateTime.utc().minus({ month: 1 }).toSeconds();
    dbService.registrationInsert({
      did: testUtil.credData[0].did,
      epoch: lastMonthEpoch,
      maxRegs: 16,
    })
  })

})

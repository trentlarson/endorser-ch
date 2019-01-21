import R from 'ramda'

// create confirmation list from a list of actionClaimsAndConfirmations for the same action
// internal helper function
function buildConfirmationList(acacList) {
  return {
    action: acacList[0].action,
    confirmations: (acacList.length == 1 && !acacList[0].confirmation)
      ? []
      : R.map(acac=>acac.confirmation)(acacList)
  }
}

module.exports = { buildConfirmationList }

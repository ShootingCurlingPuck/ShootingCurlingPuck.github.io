// The little bit of shared, changing state. Everything else is passed explicitly.
export const state = {
  standby: null, // true outside office hours; null until the first check
  clockOffset: 0, // server time minus device time, in ms
  lastData: null, // Map of schedule per room email, from the last good fetch
  lastOk: 0, // device time of the last good fetch
  errMsg: "",
};

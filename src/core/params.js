// URL switches, for testing on a laptop:
// ?mode=live|standby  ?debug=1 (errors on screen)  ?icons=text|emoji  ?theme=fall|winter|none
// Theme tuning switches are listed in the theme's own files.
export const QS = new URLSearchParams(location.search);
export const FORCE = QS.get("mode"); // "standby" or "live"

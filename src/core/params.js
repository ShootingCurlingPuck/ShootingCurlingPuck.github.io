// URL switches, for testing on a laptop:
// ?mode=live|standby  ?debug=1 (errors on screen)  ?icons=text|emoji  ?theme=fall|winter|none
// Theme tuning switches are listed in the theme's own files.
// Some TV launchers HTML-escape the URL ("&" becomes "&amp;"): read those as plain "&" too
export const QS = new URLSearchParams(location.search.replace(/&amp;/g, "&"));
export const FORCE = QS.get("mode"); // "standby" or "live"

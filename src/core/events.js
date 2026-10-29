// Tiny event bus, so parts can react to each other without importing each other.
// Events: "mode" (standby: boolean)
const handlers = {};
export function on(name, fn) {
  (handlers[name] = handlers[name] || []).push(fn);
}
export function emit(name, data) {
  (handlers[name] || []).forEach((fn) => fn(data));
}

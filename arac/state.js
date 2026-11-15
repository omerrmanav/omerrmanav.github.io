// Uygulama durumu: tek veri nesnesi + ayarlar, değişiklikte tek bir dinleyici.
import * as store from './storage.js';

export const state = {
  data: store.loadData(),
  settings: store.loadSettings(),
  tab: 'panel',
};
export const bus = { onChange: null, onSaveError: null };

export function commit() {
  const ok = store.saveData(state.data);
  if (!ok && bus.onSaveError) bus.onSaveError();
  if (bus.onChange) bus.onChange();
  return ok;
}

export function replaceData(data) {
  state.data = data;
  return commit();
}

export const activeVehicle = () => state.data.vehicles.find((v) => v.id === state.data.activeVehicleId) || null;
export const vehicleFuel = (id) => state.data.fuel.filter((r) => r.vehicleId === id);
export const vehicleService = (id) => state.data.service.filter((r) => r.vehicleId === id);
export const vehicleReminders = (id) => state.data.reminders.filter((r) => r.vehicleId === id);

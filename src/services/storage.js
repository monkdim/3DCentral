// Storage service — abstraction layer for JSON file storage
// All modules should use this instead of directly calling api.readData/writeData
// This makes it easy to swap to SQLite later without touching module code.

class StorageService {
  constructor() {
    this._cache = {};
  }

  async load(fileName) {
    const data = await window.api.readData(fileName);
    this._cache[fileName] = data;
    return data;
  }

  async save(fileName, data) {
    this._cache[fileName] = data;
    return window.api.writeData(fileName, data);
  }

  getCached(fileName) {
    return this._cache[fileName] || null;
  }

  // --- Print Records ---

  async getPrints() {
    return (await this.load('prints.json')) || [];
  }

  async addPrint(record) {
    const prints = await this.getPrints();
    prints.unshift(record);
    await this.save('prints.json', prints);
    return record;
  }

  async updatePrint(id, updates) {
    const prints = await this.getPrints();
    const idx = prints.findIndex(p => p.id === id);
    if (idx === -1) return null;
    Object.assign(prints[idx], updates);
    await this.save('prints.json', prints);
    return prints[idx];
  }

  async deletePrint(id) {
    let prints = await this.getPrints();
    prints = prints.filter(p => p.id !== id);
    await this.save('prints.json', prints);
  }

  // --- Filament Spools ---

  async getFilaments() {
    return (await this.load('filaments.json')) || [];
  }

  async addFilament(spool) {
    const filaments = await this.getFilaments();
    filaments.push(spool);
    await this.save('filaments.json', filaments);
    return spool;
  }

  async updateFilament(id, updates) {
    const filaments = await this.getFilaments();
    const idx = filaments.findIndex(f => f.id === id);
    if (idx === -1) return null;
    Object.assign(filaments[idx], updates);
    await this.save('filaments.json', filaments);
    return filaments[idx];
  }

  async deleteFilament(id) {
    let filaments = await this.getFilaments();
    filaments = filaments.filter(f => f.id !== id);
    await this.save('filaments.json', filaments);
  }

  async deductFilament(id, grams) {
    const filaments = await this.getFilaments();
    const spool = filaments.find(f => f.id === id);
    if (!spool) return null;
    spool.weightRemaining_g = Math.max(0, spool.weightRemaining_g - grams);
    await this.save('filaments.json', filaments);
    return spool;
  }

  // --- Print Profiles ---

  async getProfiles() {
    return (await this.load('profiles.json')) || [];
  }

  async addProfile(profile) {
    const profiles = await this.getProfiles();
    profiles.push(profile);
    await this.save('profiles.json', profiles);
    return profile;
  }

  async updateProfile(id, updates) {
    const profiles = await this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    Object.assign(profiles[idx], updates);
    await this.save('profiles.json', profiles);
    return profiles[idx];
  }

  async deleteProfile(id) {
    let profiles = await this.getProfiles();
    profiles = profiles.filter(p => p.id !== id);
    await this.save('profiles.json', profiles);
  }

  // --- App Settings ---

  async getSettings() {
    return (await this.load('settings.json')) || {};
  }

  async saveSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.save('settings.json', settings);
    return settings;
  }
}

window.storage = new StorageService();

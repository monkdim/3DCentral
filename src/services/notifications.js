// Desktop notification manager

window.notifications = {
  async send(title, body) {
    try {
      await window.api.notify(title, body);
    } catch (err) {
      console.warn('Notification failed:', err);
    }
  },

  printComplete(printName, printer) {
    this.send('Print Complete!', `"${printName}" on ${printer} has finished.`);
  },

  timerComplete(printName) {
    this.send('Timer Done!', `Timer for "${printName}" has reached zero.`);
  },

  lowFilament(spoolName, remaining) {
    this.send('Low Filament Warning', `${spoolName} has only ${remaining}g remaining.`);
  },

  printFailed(printName, reason) {
    this.send('Print Failed', `"${printName}" failed: ${reason}`);
  }
};

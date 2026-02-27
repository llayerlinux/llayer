export class ApplyThemeResult {
    constructor(success, theme, messages = [], errors = [], backupPath = null) {
        this.success = success;
        this.theme = theme;
        this.messages = messages;
        this.errors = errors;
        this.backupPath = backupPath;
        this.elapsedTime = 0;
    }

    pushValue(list, value) {
        list.push(value);
    }

    addMessage(message) {
        this.pushValue(this.messages, message);
        return this;
    }

    addError(error) {
        this.pushValue(this.errors, error);
        this.success = false;
        return this;
    }
}

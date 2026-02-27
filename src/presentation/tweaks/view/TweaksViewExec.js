import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import { CommandExecutionService } from '../../../infrastructure/proc/CommandExecutionService.js';

export function applyTweaksViewExec(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewExec.prototype);
}

class TweaksViewExec {
    getCommandExecutionService() {
        if (!this.commandExecutionService) {
            const container = this.container;
            const hasService = container && typeof container.get === 'function'
                && (typeof container.has !== 'function' || container.has('commandExecutionService'));
            this.commandExecutionService = hasService ? container.get('commandExecutionService') : new CommandExecutionService();
        }
        return this.commandExecutionService;
    }

    execSync(args) {
        const result = this.getCommandExecutionService().executeSync(args);
        return [result.success, result.stdout, result.stderr];
    }

    execSyncCommand(command) {
        const result = this.getCommandExecutionService().executeCommandSync(command);
        return result.success ? result.stdout : '';
    }

    execAsync(argv) {
        const result = this.getCommandExecutionService().executeSync(argv);
        return [result.success, result.stdout, result.stderr];
    }
}

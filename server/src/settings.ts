import * as fs from 'fs';
import * as path from 'path';

// The settings are defined in the root `package.json` under `contributes.configuration`.
export interface Settings {
    logPerformanceMetrics: boolean;
    inputDebounceDelay: number;
    rootFile: string;
}

// This indicates that the user set a setting to an invalid value.
export class SettingsError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = SettingsError.name;
    }
}

export function getRootFileSettingError(rootFile: string): SettingsError | null {
    if (!rootFile) {
        return null;
    }

    if (!path.isAbsolute(rootFile)) {
        return new SettingsError(`The "Root File" setting is set to "${rootFile}", which is not an absolute file path.`);
    }
    
    try {
        const rootFileStats = fs.statSync(rootFile);
        if (!rootFileStats.isFile()) {
            return new SettingsError(`The "Root File" setting is set to "${rootFile}", which is not a file.`);
        }
    } catch (err) {
        return new SettingsError(`The "Root File" setting is set to "${rootFile}", which does not exist.`);
    }

    return null;
}

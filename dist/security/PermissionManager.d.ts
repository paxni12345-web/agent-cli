import { PermissionManager, Action, PermissionResult, PermissionMode } from '../types/index.js';
export declare class DefaultPermissionManager implements PermissionManager {
    private mode;
    private autoApproveCache;
    constructor(mode?: PermissionMode);
    setMode(mode: PermissionMode): void;
    check(action: Action): PermissionResult;
    requestApproval(action: Action): Promise<boolean>;
    private getCacheKey;
    clearCache(): void;
}
//# sourceMappingURL=PermissionManager.d.ts.map
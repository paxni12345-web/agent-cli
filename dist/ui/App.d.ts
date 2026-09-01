/**
 * Main Application - Claude Code CLI Style
 * Beautiful terminal interface for Agent CLI
 */
import React from 'react';
interface AppProps {
    workingDirectory: string;
    model?: string;
    mode?: 'normal' | 'fast' | 'ultra';
}
declare const App: React.FC<AppProps>;
export default App;
export declare const startCLI: (options: AppProps) => any;
//# sourceMappingURL=App.d.ts.map
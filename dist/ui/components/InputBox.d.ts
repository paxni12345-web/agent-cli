/**
 * InputBox Component - Message Input
 * Beautiful input field like Claude Code
 */
import React from 'react';
interface InputBoxProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}
export declare const InputBox: React.FC<InputBoxProps>;
export {};
//# sourceMappingURL=InputBox.d.ts.map
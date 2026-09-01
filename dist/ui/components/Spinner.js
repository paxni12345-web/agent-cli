"use strict";
/**
 * Spinner Component - Loading Indicator
 * Beautiful animated spinner like Claude Code
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spinner = void 0;
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const Spinner = ({ text = 'Loading...', type = 'dots', color = 'cyan', }) => {
    const [frame, setFrame] = (0, react_1.useState)(0);
    // Spinner frames by type
    const frames = {
        dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        line: ['—', '\\', '|', '/'],
        arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
        bounce: ['⠁', '⠂', '⠄', '⠂'],
        pulse: ['●', '◉', '◎', '○', '◎', '◉'],
    };
    const currentFrames = frames[type];
    (0, react_1.useEffect)(() => {
        const interval = setInterval(() => {
            setFrame((prev) => (prev + 1) % currentFrames.length);
        }, 80);
        return () => clearInterval(interval);
    }, [currentFrames.length]);
    return (react_1.default.createElement(ink_1.Box, { gap: 1 },
        react_1.default.createElement(ink_1.Text, { color: color }, currentFrames[frame]),
        react_1.default.createElement(ink_1.Text, { color: color }, text)));
};
exports.Spinner = Spinner;

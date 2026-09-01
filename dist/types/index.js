"use strict";
// Core type definitions for the agent system
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.WorkspaceError = exports.PermissionError = exports.ProviderError = exports.ToolError = exports.AgentError = void 0;
class AgentError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AgentError';
    }
}
exports.AgentError = AgentError;
class ToolError extends AgentError {
    constructor(message, details) {
        super(message, 'TOOL_ERROR', details);
        this.name = 'ToolError';
    }
}
exports.ToolError = ToolError;
class ProviderError extends AgentError {
    constructor(message, details) {
        super(message, 'PROVIDER_ERROR', details);
        this.name = 'ProviderError';
    }
}
exports.ProviderError = ProviderError;
class PermissionError extends AgentError {
    constructor(message, details) {
        super(message, 'PERMISSION_ERROR', details);
        this.name = 'PermissionError';
    }
}
exports.PermissionError = PermissionError;
class WorkspaceError extends AgentError {
    constructor(message, details) {
        super(message, 'WORKSPACE_ERROR', details);
        this.name = 'WorkspaceError';
    }
}
exports.WorkspaceError = WorkspaceError;
class ValidationError extends AgentError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;

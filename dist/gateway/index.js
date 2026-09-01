"use strict";
/**
 * VALIDATION MIDDLEWARE EXPORTS
 * Central export point for all validation components
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIGatewayManager = exports.initializeGatewayWithExamples = exports.createOrderCreationRoute = exports.createWebhookRoute = exports.createCommentSubmissionRoute = exports.createAdminUpdateRoute = exports.createFileUploadRoute = exports.createProductSearchRoute = exports.createUserRegistrationRoute = exports.ValidationPresets = exports.CommonSchemas = exports.EndpointRateLimiter = exports.SecurityValidator = exports.RequestValidator = exports.ValidationMiddlewareFactory = void 0;
// Core validation middleware
var ValidationMiddleware_1 = require("./ValidationMiddleware");
Object.defineProperty(exports, "ValidationMiddlewareFactory", { enumerable: true, get: function () { return ValidationMiddleware_1.ValidationMiddlewareFactory; } });
Object.defineProperty(exports, "RequestValidator", { enumerable: true, get: function () { return ValidationMiddleware_1.RequestValidator; } });
Object.defineProperty(exports, "SecurityValidator", { enumerable: true, get: function () { return ValidationMiddleware_1.SecurityValidator; } });
Object.defineProperty(exports, "EndpointRateLimiter", { enumerable: true, get: function () { return ValidationMiddleware_1.EndpointRateLimiter; } });
// Common schemas and presets
var ValidationMiddleware_2 = require("./ValidationMiddleware");
Object.defineProperty(exports, "CommonSchemas", { enumerable: true, get: function () { return ValidationMiddleware_2.CommonSchemas; } });
Object.defineProperty(exports, "ValidationPresets", { enumerable: true, get: function () { return ValidationMiddleware_2.ValidationPresets; } });
// Example implementations
var ValidationExamples_1 = require("./ValidationExamples");
Object.defineProperty(exports, "createUserRegistrationRoute", { enumerable: true, get: function () { return ValidationExamples_1.createUserRegistrationRoute; } });
Object.defineProperty(exports, "createProductSearchRoute", { enumerable: true, get: function () { return ValidationExamples_1.createProductSearchRoute; } });
Object.defineProperty(exports, "createFileUploadRoute", { enumerable: true, get: function () { return ValidationExamples_1.createFileUploadRoute; } });
Object.defineProperty(exports, "createAdminUpdateRoute", { enumerable: true, get: function () { return ValidationExamples_1.createAdminUpdateRoute; } });
Object.defineProperty(exports, "createCommentSubmissionRoute", { enumerable: true, get: function () { return ValidationExamples_1.createCommentSubmissionRoute; } });
Object.defineProperty(exports, "createWebhookRoute", { enumerable: true, get: function () { return ValidationExamples_1.createWebhookRoute; } });
Object.defineProperty(exports, "createOrderCreationRoute", { enumerable: true, get: function () { return ValidationExamples_1.createOrderCreationRoute; } });
Object.defineProperty(exports, "initializeGatewayWithExamples", { enumerable: true, get: function () { return ValidationExamples_1.initializeGatewayWithExamples; } });
// API Gateway exports
var APIGateway_1 = require("./APIGateway");
Object.defineProperty(exports, "APIGatewayManager", { enumerable: true, get: function () { return APIGateway_1.APIGatewayManager; } });

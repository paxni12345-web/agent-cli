/**
 * API Gateway Validation Examples
 * Demonstrates comprehensive request validation usage
 */
import { APIGateway, Route } from './APIGateway';
export declare function createUserRegistrationRoute(): Omit<Route, 'id'>;
export declare function createFileUploadRoute(): Omit<Route, 'id'>;
export declare function createSearchRoute(): Omit<Route, 'id'>;
export declare function createAdminCommandRoute(): Omit<Route, 'id'>;
export declare function createBlogPostRoute(): Omit<Route, 'id'>;
export declare function createCustomValidationRoute(): Omit<Route, 'id'>;
export declare function createMultiStepValidationRoute(): Omit<Route, 'id'>;
export declare function createUserProfileRoute(): Omit<Route, 'id'>;
export declare function setupAPIGatewayWithValidation(): Promise<APIGateway>;
export declare function standaloneValidationExamples(): Promise<void>;
//# sourceMappingURL=validation-examples.d.ts.map
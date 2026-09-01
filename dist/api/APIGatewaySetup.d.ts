/**
 * API Gateway Setup and Configuration
 * Complete setup with production-ready handlers and middleware
 */
import { APIGateway, apiGateway } from './APIGateway';
/**
 * Setup production API Gateway with all endpoints
 */
export declare function setupProductionAPIGateway(gateway?: APIGateway): void;
/**
 * Setup development API Gateway (with relaxed security)
 */
export declare function setupDevelopmentAPIGateway(gateway?: APIGateway): void;
/**
 * Initialize the API Gateway based on environment
 */
export declare function initializeAPIGateway(): APIGateway;
/**
 * Export configured gateway
 */
export { apiGateway };
//# sourceMappingURL=APIGatewaySetup.d.ts.map
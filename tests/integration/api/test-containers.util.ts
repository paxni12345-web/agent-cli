/**
 * Test Containers Setup and Utilities
 * Provides utilities for using test containers in integration tests
 */

import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface ContainerConfig {
  image: string;
  name: string;
  ports?: { host: number; container: number }[];
  env?: Record<string, string>;
  volumes?: { host: string; container: string }[];
  command?: string[];
}

export class TestContainer {
  private containerId?: string;
  private config: ContainerConfig;

  constructor(config: ContainerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      // Check if Docker is available
      await execAsync('docker --version');
    } catch (error) {
      console.warn('Docker not available, skipping container tests');
      return;
    }

    const args = ['run', '-d', '--name', this.config.name];

    // Add port mappings
    if (this.config.ports) {
      this.config.ports.forEach(port => {
        args.push('-p', `${port.host}:${port.container}`);
      });
    }

    // Add environment variables
    if (this.config.env) {
      Object.entries(this.config.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }

    // Add volumes
    if (this.config.volumes) {
      this.config.volumes.forEach(volume => {
        args.push('-v', `${volume.host}:${volume.container}`);
      });
    }

    // Add image
    args.push(this.config.image);

    // Add command
    if (this.config.command) {
      args.push(...this.config.command);
    }

    try {
      const { stdout } = await execAsync(`docker ${args.join(' ')}`);
      this.containerId = stdout.trim();

      // Wait for container to be ready
      await this.waitForReady();
    } catch (error) {
      throw new Error(`Failed to start container: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.containerId) {
      return;
    }

    try {
      await execAsync(`docker stop ${this.config.name}`);
      await execAsync(`docker rm ${this.config.name}`);
    } catch (error) {
      console.warn(`Failed to stop container: ${error}`);
    }
  }

  async waitForReady(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${this.config.name}`);
        if (stdout.trim() === 'true') {
          // Wait a bit more for the service to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          return;
        }
      } catch (error) {
        // Container not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Container ${this.config.name} not ready after ${timeout}ms`);
  }

  async exec(command: string): Promise<string> {
    if (!this.containerId) {
      throw new Error('Container not started');
    }

    const { stdout } = await execAsync(`docker exec ${this.config.name} ${command}`);
    return stdout;
  }

  async getLogs(): Promise<string> {
    if (!this.containerId) {
      throw new Error('Container not started');
    }

    const { stdout } = await execAsync(`docker logs ${this.config.name}`);
    return stdout;
  }

  getConnectionString(type: 'postgresql' | 'mysql' | 'redis' | 'mongodb'): string {
    const port = this.config.ports?.[0]?.host || 5432;

    switch (type) {
      case 'postgresql':
        return `postgresql://test:test@localhost:${port}/testdb`;
      case 'mysql':
        return `mysql://test:test@localhost:${port}/testdb`;
      case 'redis':
        return `redis://localhost:${port}`;
      case 'mongodb':
        return `mongodb://localhost:${port}/testdb`;
      default:
        throw new Error(`Unknown database type: ${type}`);
    }
  }
}

export class PostgreSQLContainer extends TestContainer {
  constructor(name: string = 'test-postgres', port: number = 5432) {
    super({
      image: 'postgres:15-alpine',
      name,
      ports: [{ host: port, container: 5432 }],
      env: {
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'testdb',
      },
    });
  }

  getConnectionConfig() {
    return {
      host: 'localhost',
      port: this.config.ports![0].host,
      database: 'testdb',
      username: 'test',
      password: 'test',
    };
  }
}

export class MySQLContainer extends TestContainer {
  constructor(name: string = 'test-mysql', port: number = 3306) {
    super({
      image: 'mysql:8.0',
      name,
      ports: [{ host: port, container: 3306 }],
      env: {
        MYSQL_ROOT_PASSWORD: 'root',
        MYSQL_DATABASE: 'testdb',
        MYSQL_USER: 'test',
        MYSQL_PASSWORD: 'test',
      },
    });
  }

  getConnectionConfig() {
    return {
      host: 'localhost',
      port: this.config.ports![0].host,
      database: 'testdb',
      username: 'test',
      password: 'test',
    };
  }
}

export class RedisContainer extends TestContainer {
  constructor(name: string = 'test-redis', port: number = 6379) {
    super({
      image: 'redis:7-alpine',
      name,
      ports: [{ host: port, container: 6379 }],
    });
  }

  getConnectionConfig() {
    return {
      host: 'localhost',
      port: this.config.ports![0].host,
    };
  }
}

export class MongoDBContainer extends TestContainer {
  constructor(name: string = 'test-mongodb', port: number = 27017) {
    super({
      image: 'mongo:7.0',
      name,
      ports: [{ host: port, container: 27017 }],
      env: {
        MONGO_INITDB_ROOT_USERNAME: 'test',
        MONGO_INITDB_ROOT_PASSWORD: 'test',
        MONGO_INITDB_DATABASE: 'testdb',
      },
    });
  }

  getConnectionConfig() {
    return {
      host: 'localhost',
      port: this.config.ports![0].host,
      database: 'testdb',
      username: 'test',
      password: 'test',
    };
  }
}

/**
 * Helper to check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to cleanup all test containers
 */
export async function cleanupTestContainers(): Promise<void> {
  try {
    const { stdout } = await execAsync('docker ps -a --filter "name=test-" --format "{{.Names}}"');
    const containers = stdout.trim().split('\n').filter(Boolean);

    for (const container of containers) {
      try {
        await execAsync(`docker stop ${container}`);
        await execAsync(`docker rm ${container}`);
      } catch (error) {
        console.warn(`Failed to cleanup container ${container}:`, error);
      }
    }
  } catch (error) {
    // No containers to cleanup
  }
}

/**
 * Wait for a service to be available
 */
export async function waitForService(
  check: () => Promise<boolean>,
  timeout: number = 30000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const ready = await check();
      if (ready) {
        return;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Service not ready after ${timeout}ms`);
}

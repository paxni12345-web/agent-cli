/**
 * Integration Tests for DatasetManager
 * Tests dataset operations, augmentation, versioning, and quality control
 */

import DatasetManager, {
  Dataset,
  DataExample,
  AugmentationConfig,
  FilterConfig
} from '../../../src/ai/training/DatasetManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DatasetManager Integration Tests', () => {
  let manager: DatasetManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dataset-test-'));
    manager = new DatasetManager();
  });

  afterEach(async () => {
    manager.removeAllListeners();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createSampleExamples = (count: number): DataExample[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `example_${i}`,
      input: `Input text for example ${i}. This is a sample sentence.`,
      output: `Output for example ${i}. This is the expected response.`,
      quality: 0.8 + Math.random() * 0.2
    }));
  };

  describe('Dataset Creation and Management', () => {
    it('should create dataset with examples and metadata', () => {
      const examples = createSampleExamples(10);
      const datasetId = manager.createDataset('test-dataset', examples, {
        author: 'test-user',
        description: 'Test dataset for integration testing',
        tags: ['test', 'integration'],
        license: 'MIT'
      });

      expect(datasetId).toBeDefined();

      const dataset = manager.getDataset(datasetId);
      expect(dataset).toBeDefined();
      expect(dataset!.name).toBe('test-dataset');
      expect(dataset!.examples).toHaveLength(10);
      expect(dataset!.metadata.author).toBe('test-user');
      expect(dataset!.metadata.tags).toContain('test');
    });

    it('should calculate statistics on creation', () => {
      const examples = createSampleExamples(20);
      const datasetId = manager.createDataset('stats-test', examples, {});

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.statistics.totalExamples).toBe(20);
      expect(dataset!.statistics.avgInputLength).toBeGreaterThan(0);
      expect(dataset!.statistics.avgOutputLength).toBeGreaterThan(0);
    });

    it('should add examples to existing dataset', () => {
      const initial = createSampleExamples(5);
      const datasetId = manager.createDataset('expandable', initial, {});

      const additional = createSampleExamples(3);
      manager.addExamples(datasetId, additional);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.examples).toHaveLength(8);
      expect(dataset!.statistics.totalExamples).toBe(8);
    });

    it('should update metadata when examples are added', () => {
      const datasetId = manager.createDataset('test', createSampleExamples(5), {});
      const dataset1 = manager.getDataset(datasetId);
      const initialUpdate = dataset1!.metadata.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        manager.addExamples(datasetId, createSampleExamples(2));
        const dataset2 = manager.getDataset(datasetId);
        expect(dataset2!.metadata.updatedAt.getTime()).toBeGreaterThanOrEqual(
          initialUpdate.getTime()
        );
      }, 10);
    });
  });

  describe('Dataset Augmentation', () => {
    it('should augment dataset with paraphrasing', async () => {
      const examples = createSampleExamples(5);
      const datasetId = manager.createDataset('aug-test', examples, {});

      const config: AugmentationConfig = {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      };

      const augmentedCount = await manager.augmentDataset(datasetId, config);

      expect(augmentedCount).toBeGreaterThan(0);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.examples.length).toBeGreaterThan(5);

      const augmented = dataset!.examples.filter(e => e.augmented);
      expect(augmented.length).toBeGreaterThan(0);
    });

    it('should apply multiple augmentation methods', async () => {
      const examples = createSampleExamples(3);
      const datasetId = manager.createDataset('multi-aug', examples, {});

      const config: AugmentationConfig = {
        methods: ['synonym_replacement', 'random_insertion', 'random_swap'],
        factor: 1,
        preserveOriginal: true
      };

      const augmentedCount = await manager.augmentDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      // 3 original + (3 examples * 3 methods * 1 factor) = 12 total
      expect(dataset!.examples.length).toBeGreaterThan(3);
    });

    it('should replace originals when preserveOriginal is false', async () => {
      const examples = createSampleExamples(5);
      const datasetId = manager.createDataset('replace-test', examples, {});

      const config: AugmentationConfig = {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: false
      };

      await manager.augmentDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      const allAugmented = dataset!.examples.every(e => e.augmented);
      expect(allAugmented).toBe(true);
    });

    it('should track augmentation sources', async () => {
      const examples = createSampleExamples(2);
      const datasetId = manager.createDataset('source-track', examples, {});

      const config: AugmentationConfig = {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      };

      await manager.augmentDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      const augmented = dataset!.examples.filter(e => e.augmented);

      augmented.forEach(aug => {
        expect(aug.source).toBeDefined();
        expect(dataset!.examples.some(e => e.id === aug.source)).toBe(true);
      });
    });

    it('should handle concurrent augmentation requests', async () => {
      const datasetId = manager.createDataset('concurrent', createSampleExamples(10), {});

      const config: AugmentationConfig = {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      };

      // Run multiple augmentations concurrently
      const results = await Promise.all([
        manager.augmentDataset(datasetId, config),
        manager.augmentDataset(datasetId, config)
      ]);

      expect(results.every(r => r > 0)).toBe(true);
    });
  });

  describe('Dataset Filtering and Quality Control', () => {
    it('should filter by length constraints', () => {
      const examples: DataExample[] = [
        { id: '1', input: 'short', output: 'tiny', quality: 0.9 },
        { id: '2', input: 'This is a medium length input text', output: 'Medium output', quality: 0.8 },
        { id: '3', input: 'A'.repeat(200), output: 'B'.repeat(200), quality: 0.7 }
      ];

      const datasetId = manager.createDataset('filter-test', examples, {});

      const config: FilterConfig = {
        minLength: 10,
        maxLength: 100,
        minQuality: 0,
        removeDuplicates: false,
        removeOutliers: false
      };

      const removed = manager.filterDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      expect(removed).toBeGreaterThan(0);
      expect(dataset!.examples.length).toBeLessThan(3);
    });

    it('should filter by quality threshold', () => {
      const examples: DataExample[] = [
        { id: '1', input: 'test', output: 'result', quality: 0.95 },
        { id: '2', input: 'test', output: 'result', quality: 0.6 },
        { id: '3', input: 'test', output: 'result', quality: 0.3 }
      ];

      const datasetId = manager.createDataset('quality-filter', examples, {});

      const config: FilterConfig = {
        minLength: 0,
        maxLength: 10000,
        minQuality: 0.7,
        removeDuplicates: false,
        removeOutliers: false
      };

      manager.filterDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.examples.length).toBe(1);
      expect(dataset!.examples[0].quality).toBeGreaterThanOrEqual(0.7);
    });

    it('should remove duplicate examples', () => {
      const examples: DataExample[] = [
        { id: '1', input: 'duplicate', output: 'same', quality: 0.9 },
        { id: '2', input: 'duplicate', output: 'same', quality: 0.9 },
        { id: '3', input: 'unique', output: 'different', quality: 0.8 }
      ];

      const datasetId = manager.createDataset('dup-test', examples, {});

      const config: FilterConfig = {
        minLength: 0,
        maxLength: 10000,
        minQuality: 0,
        removeDuplicates: true,
        removeOutliers: false
      };

      const removed = manager.filterDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      expect(removed).toBe(1);
      expect(dataset!.examples.length).toBe(2);
    });

    it('should remove statistical outliers', () => {
      const examples: DataExample[] = [
        { id: '1', input: 'A'.repeat(50), output: 'B'.repeat(50), quality: 0.9 },
        { id: '2', input: 'C'.repeat(55), output: 'D'.repeat(45), quality: 0.9 },
        { id: '3', input: 'E'.repeat(52), output: 'F'.repeat(48), quality: 0.9 },
        { id: '4', input: 'X'.repeat(500), output: 'Y'.repeat(500), quality: 0.9 } // Outlier
      ];

      const datasetId = manager.createDataset('outlier-test', examples, {});

      const config: FilterConfig = {
        minLength: 0,
        maxLength: 10000,
        minQuality: 0,
        removeDuplicates: false,
        removeOutliers: true
      };

      manager.filterDataset(datasetId, config);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.examples.length).toBeLessThan(4);
    });
  });

  describe('Bias Detection', () => {
    it('should detect gender bias in dataset', () => {
      const examples: DataExample[] = [
        { id: '1', input: 'He is a doctor', output: 'Male professional', quality: 0.9 },
        { id: '2', input: 'She is a nurse', output: 'Female caregiver', quality: 0.9 },
        { id: '3', input: 'The man works', output: 'Male worker', quality: 0.9 },
        { id: '4', input: 'His job is important', output: 'Male role', quality: 0.9 }
      ];

      const datasetId = manager.createDataset('bias-test', examples, {});
      const biasResult = manager.detectBias(datasetId);

      expect(biasResult.biasTypes).toContain('gender');
      expect(biasResult.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect length uniformity bias', () => {
      const examples = Array.from({ length: 20 }, (_, i) => ({
        id: `ex_${i}`,
        input: 'A'.repeat(50),
        output: 'B'.repeat(50),
        quality: 0.9
      }));

      const datasetId = manager.createDataset('uniform-test', examples, {});
      const biasResult = manager.detectBias(datasetId);

      expect(biasResult.biasTypes).toContain('length_uniformity');
      expect(biasResult.severity).toBe('medium');
    });

    it('should provide recommendations for detected bias', () => {
      const biasedExamples = Array.from({ length: 10 }, (_, i) => ({
        id: `ex_${i}`,
        input: `She ${i}`,
        output: `Her ${i}`,
        quality: 0.9
      }));

      const datasetId = manager.createDataset('recommend-test', biasedExamples, {});
      const biasResult = manager.detectBias(datasetId);

      expect(biasResult.recommendations.length).toBeGreaterThan(0);
      expect(biasResult.recommendations[0]).toBeTruthy();
    });
  });

  describe('Dataset Versioning', () => {
    it('should create versions of datasets', () => {
      const datasetId = manager.createDataset('versioned', createSampleExamples(5), {});

      const v1 = manager.createVersion(datasetId, '1.1.0');
      expect(v1).toBe('1.1.0');

      const versions = manager.listVersions(datasetId);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
    });

    it('should retrieve specific versions', () => {
      const datasetId = manager.createDataset('version-test', createSampleExamples(3), {});

      manager.addExamples(datasetId, createSampleExamples(2));
      manager.createVersion(datasetId, '2.0.0');

      const v1 = manager.getVersion(datasetId, '1.0.0');
      const v2 = manager.getVersion(datasetId, '2.0.0');

      expect(v1!.examples).toHaveLength(3);
      expect(v2!.examples).toHaveLength(5);
    });

    it('should maintain independent version histories', () => {
      const datasetId = manager.createDataset('multi-version', createSampleExamples(5), {});

      manager.createVersion(datasetId, 'v1');
      manager.addExamples(datasetId, createSampleExamples(3));
      manager.createVersion(datasetId, 'v2');
      manager.addExamples(datasetId, createSampleExamples(2));

      const versions = manager.listVersions(datasetId);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Import and Export', () => {
    it('should export dataset to JSON', () => {
      const examples = createSampleExamples(5);
      const datasetId = manager.createDataset('export-test', examples, {
        description: 'Test export'
      });

      const json = manager.exportDataset(datasetId, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('export-test');
      expect(parsed.examples).toHaveLength(5);
      expect(parsed.metadata.description).toBe('Test export');
    });

    it('should export dataset to JSONL', () => {
      const examples = createSampleExamples(3);
      const datasetId = manager.createDataset('jsonl-test', examples, {});

      const jsonl = manager.exportDataset(datasetId, 'jsonl');
      const lines = jsonl.split('\n').filter(Boolean);

      expect(lines).toHaveLength(3);
      lines.forEach(line => {
        const parsed = JSON.parse(line);
        expect(parsed.input).toBeDefined();
        expect(parsed.output).toBeDefined();
      });
    });

    it('should export dataset to CSV', () => {
      const examples = createSampleExamples(3);
      const datasetId = manager.createDataset('csv-test', examples, {});

      const csv = manager.exportDataset(datasetId, 'csv');
      const lines = csv.split('\n');

      expect(lines[0]).toContain('id,input,output,quality');
      expect(lines.length).toBeGreaterThan(3);
    });

    it('should import JSON dataset', () => {
      const examples = createSampleExamples(5);
      const datasetId = manager.createDataset('import-source', examples, {});
      const exported = manager.exportDataset(datasetId, 'json');

      const importedId = manager.importDataset('imported', exported, 'json');
      const imported = manager.getDataset(importedId);

      expect(imported!.examples).toHaveLength(5);
    });

    it('should import JSONL dataset', () => {
      const jsonl = [
        '{"id":"1","input":"test1","output":"result1","quality":0.9}',
        '{"id":"2","input":"test2","output":"result2","quality":0.8}'
      ].join('\n');

      const datasetId = manager.importDataset('from-jsonl', jsonl, 'jsonl');
      const dataset = manager.getDataset(datasetId);

      expect(dataset!.examples).toHaveLength(2);
    });

    it('should import CSV dataset', () => {
      const csv = [
        'id,input,output,quality',
        '"1","input1","output1",0.9',
        '"2","input2","output2",0.8'
      ].join('\n');

      const datasetId = manager.importDataset('from-csv', csv, 'csv');
      const dataset = manager.getDataset(datasetId);

      expect(dataset!.examples).toHaveLength(2);
    });
  });

  describe('Real File Operations', () => {
    it('should export to file and reimport', async () => {
      const examples = createSampleExamples(10);
      const datasetId = manager.createDataset('file-test', examples, {});

      const exported = manager.exportDataset(datasetId, 'json');
      const filePath = path.join(tempDir, 'dataset.json');
      await fs.writeFile(filePath, exported);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const importedId = manager.importDataset('reimported', fileContent, 'json');

      const imported = manager.getDataset(importedId);
      expect(imported!.examples).toHaveLength(10);
    });

    it('should handle multiple export formats concurrently', async () => {
      const datasetId = manager.createDataset('multi-export', createSampleExamples(5), {});

      const [jsonExport, csvExport, jsonlExport] = await Promise.all([
        Promise.resolve(manager.exportDataset(datasetId, 'json')),
        Promise.resolve(manager.exportDataset(datasetId, 'csv')),
        Promise.resolve(manager.exportDataset(datasetId, 'jsonl'))
      ]);

      await Promise.all([
        fs.writeFile(path.join(tempDir, 'dataset.json'), jsonExport),
        fs.writeFile(path.join(tempDir, 'dataset.csv'), csvExport),
        fs.writeFile(path.join(tempDir, 'dataset.jsonl'), jsonlExport)
      ]);

      const files = await fs.readdir(tempDir);
      expect(files).toContain('dataset.json');
      expect(files).toContain('dataset.csv');
      expect(files).toContain('dataset.jsonl');
    });
  });

  describe('Concurrent Operations and Data Integrity', () => {
    it('should handle concurrent dataset creation', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(
          manager.createDataset(`dataset_${i}`, createSampleExamples(5), {})
        )
      );

      const ids = await Promise.all(operations);
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10); // All unique
    });

    it('should handle concurrent modifications', async () => {
      const datasetId = manager.createDataset('concurrent', createSampleExamples(5), {});

      await Promise.all([
        manager.addExamples(datasetId, createSampleExamples(2)),
        manager.addExamples(datasetId, createSampleExamples(3)),
        manager.addExamples(datasetId, createSampleExamples(1))
      ]);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.examples.length).toBe(11); // 5 + 2 + 3 + 1
    });

    it('should maintain consistency during augmentation and filtering', async () => {
      const datasetId = manager.createDataset('consistency', createSampleExamples(10), {});

      const augConfig: AugmentationConfig = {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      };

      const filterConfig: FilterConfig = {
        minLength: 10,
        maxLength: 1000,
        minQuality: 0.7,
        removeDuplicates: true,
        removeOutliers: false
      };

      await manager.augmentDataset(datasetId, augConfig);
      manager.filterDataset(datasetId, filterConfig);

      const dataset = manager.getDataset(datasetId);
      expect(dataset!.statistics.totalExamples).toBe(dataset!.examples.length);
    });
  });

  describe('Event-Driven Integration', () => {
    it('should emit events during dataset lifecycle', () => {
      const events: string[] = [];

      manager.on('dataset:created', () => events.push('created'));
      manager.on('dataset:updated', () => events.push('updated'));
      manager.on('dataset:filtered', () => events.push('filtered'));

      const datasetId = manager.createDataset('event-test', createSampleExamples(5), {});
      manager.addExamples(datasetId, createSampleExamples(2));
      manager.filterDataset(datasetId, {
        minLength: 0,
        maxLength: 1000,
        minQuality: 0.5,
        removeDuplicates: true,
        removeOutliers: false
      });

      expect(events).toContain('created');
      expect(events).toContain('updated');
      expect(events).toContain('filtered');
    });

    it('should provide detailed event data', async () => {
      let augmentationData: any = null;

      manager.on('dataset:augmented', (data) => {
        augmentationData = data;
      });

      const datasetId = manager.createDataset('detail-test', createSampleExamples(3), {});

      await manager.augmentDataset(datasetId, {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      });

      expect(augmentationData).toBeDefined();
      expect(augmentationData.datasetId).toBe(datasetId);
      expect(augmentationData.originalSize).toBe(3);
      expect(augmentationData.augmentedCount).toBeGreaterThan(0);
    });
  });

  describe('Dataset Deletion and Cleanup', () => {
    it('should delete datasets and versions', () => {
      const datasetId = manager.createDataset('deletable', createSampleExamples(5), {});
      manager.createVersion(datasetId, 'v1.1');

      manager.deleteDataset(datasetId);

      expect(manager.getDataset(datasetId)).toBeNull();
      expect(manager.listVersions(datasetId)).toHaveLength(0);
    });

    it('should emit deletion events', () => {
      let deletedId: string | null = null;

      manager.on('dataset:deleted', (data) => {
        deletedId = data.datasetId;
      });

      const datasetId = manager.createDataset('delete-event', createSampleExamples(3), {});
      manager.deleteDataset(datasetId);

      expect(deletedId).toBe(datasetId);
    });
  });
});

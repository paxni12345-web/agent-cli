/**
 * Content Management System (CMS)
 * Content creation, versioning, publishing, and media management
 */

import { eventBus } from '../core/EventBus';

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  author: string;
  status: ContentStatus;
  visibility: ContentVisibility;
  metadata: ContentMetadata;
  tags: string[];
  categories: string[];
  version: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum ContentType {
  Article = 'article',
  Page = 'page',
  Post = 'post',
  Product = 'product',
  Documentation = 'documentation',
  Custom = 'custom',
}

export enum ContentStatus {
  Draft = 'draft',
  Review = 'review',
  Published = 'published',
  Archived = 'archived',
  Scheduled = 'scheduled',
}

export enum ContentVisibility {
  Public = 'public',
  Private = 'private',
  Protected = 'protected',
}

export interface ContentMetadata {
  description?: string;
  keywords?: string[];
  featuredImage?: string;
  customFields: Record<string, any>;
  seo: SEOMetadata;
}

export interface SEOMetadata {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export interface ContentVersion {
  version: number;
  contentId: string;
  title: string;
  body: string;
  author: string;
  changes: string;
  createdAt: Date;
}

export interface Media {
  id: string;
  name: string;
  type: MediaType;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  dimensions?: MediaDimensions;
  metadata: MediaMetadata;
  uploadedBy: string;
  createdAt: Date;
}

export enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Other = 'other',
}

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface MediaMetadata {
  alt?: string;
  caption?: string;
  title?: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
  order: number;
  count: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface ContentTemplate {
  id: string;
  name: string;
  type: ContentType;
  fields: TemplateField[];
  layout: string;
  createdAt: Date;
}

export interface TemplateField {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  defaultValue?: any;
  validation?: FieldValidation;
}

export enum FieldType {
  Text = 'text',
  Textarea = 'textarea',
  RichText = 'rich_text',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Select = 'select',
  MultiSelect = 'multi_select',
  Image = 'image',
  Gallery = 'gallery',
  Relationship = 'relationship',
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  options?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  currentStep?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  role: string;
  actions: WorkflowAction[];
  nextSteps: string[];
}

export enum WorkflowAction {
  Approve = 'approve',
  Reject = 'reject',
  Edit = 'edit',
  Comment = 'comment',
}

export interface Comment {
  id: string;
  contentId: string;
  author: string;
  body: string;
  status: CommentStatus;
  parent?: string;
  createdAt: Date;
}

export enum CommentStatus {
  Pending = 'pending',
  Approved = 'approved',
  Spam = 'spam',
  Trash = 'trash',
}

/**
 * Content Manager
 */
export class ContentManager {
  private content: Map<string, Content> = new Map();
  private versions: Map<string, ContentVersion[]> = new Map();
  private templates: Map<string, ContentTemplate> = new Map();

  /**
   * Create content
   */
  createContent(content: Omit<Content, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Content {
    const fullContent: Content = {
      ...content,
      id: this.generateContentId(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.content.set(fullContent.id, fullContent);

    // Create initial version
    this.createVersion(fullContent, 'Initial version');

    eventBus.emitSync('cms.content_created', fullContent, 'ContentManager');

    return fullContent;
  }

  /**
   * Update content
   */
  updateContent(contentId: string, updates: Partial<Content>, changes: string = 'Content updated'): Content {
    const content = this.content.get(contentId);

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    Object.assign(content, updates, {
      version: content.version + 1,
      updatedAt: new Date(),
    });

    // Create new version
    this.createVersion(content, changes);

    eventBus.emitSync('cms.content_updated', content, 'ContentManager');

    return content;
  }

  /**
   * Publish content
   */
  publishContent(contentId: string): void {
    const content = this.content.get(contentId);

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    content.status = ContentStatus.Published;
    content.publishedAt = new Date();
    content.updatedAt = new Date();

    eventBus.emitSync('cms.content_published', content, 'ContentManager');
  }

  /**
   * Unpublish content
   */
  unpublishContent(contentId: string): void {
    const content = this.content.get(contentId);

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    content.status = ContentStatus.Draft;
    content.updatedAt = new Date();

    eventBus.emitSync('cms.content_unpublished', content, 'ContentManager');
  }

  /**
   * Delete content
   */
  deleteContent(contentId: string): void {
    this.content.delete(contentId);
    this.versions.delete(contentId);

    eventBus.emitSync('cms.content_deleted', { contentId }, 'ContentManager');
  }

  /**
   * Get content
   */
  getContent(contentId: string): Content | undefined {
    return this.content.get(contentId);
  }

  /**
   * Get content by slug
   */
  getContentBySlug(slug: string): Content | undefined {
    return Array.from(this.content.values()).find(c => c.slug === slug);
  }

  /**
   * List content
   */
  listContent(filter?: {
    type?: ContentType;
    status?: ContentStatus;
    author?: string;
    tags?: string[];
    categories?: string[];
  }): Content[] {
    let contents = Array.from(this.content.values());

    if (filter?.type) {
      contents = contents.filter(c => c.type === filter.type);
    }

    if (filter?.status) {
      contents = contents.filter(c => c.status === filter.status);
    }

    if (filter?.author) {
      contents = contents.filter(c => c.author === filter.author);
    }

    if (filter?.tags) {
      contents = contents.filter(c => filter.tags!.some(tag => c.tags.includes(tag)));
    }

    if (filter?.categories) {
      contents = contents.filter(c => filter.categories!.some(cat => c.categories.includes(cat)));
    }

    return contents.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get versions
   */
  getVersions(contentId: string): ContentVersion[] {
    return this.versions.get(contentId) || [];
  }

  /**
   * Restore version
   */
  restoreVersion(contentId: string, version: number): Content {
    const content = this.content.get(contentId);

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    const versions = this.versions.get(contentId) || [];
    const targetVersion = versions.find(v => v.version === version);

    if (!targetVersion) {
      throw new Error(`Version not found: ${version}`);
    }

    return this.updateContent(
      contentId,
      {
        title: targetVersion.title,
        body: targetVersion.body,
      },
      `Restored to version ${version}`
    );
  }

  /**
   * Register template
   */
  registerTemplate(template: Omit<ContentTemplate, 'id' | 'createdAt'>): ContentTemplate {
    const fullTemplate: ContentTemplate = {
      ...template,
      id: this.generateTemplateId(),
      createdAt: new Date(),
    };

    this.templates.set(fullTemplate.id, fullTemplate);

    return fullTemplate;
  }

  /**
   * Get template
   */
  getTemplate(templateId: string): ContentTemplate | undefined {
    return this.templates.get(templateId);
  }

  private createVersion(content: Content, changes: string): void {
    const version: ContentVersion = {
      version: content.version,
      contentId: content.id,
      title: content.title,
      body: content.body,
      author: content.author,
      changes,
      createdAt: new Date(),
    };

    if (!this.versions.has(content.id)) {
      this.versions.set(content.id, []);
    }

    this.versions.get(content.id)!.push(version);

    // Keep only last 50 versions
    const versions = this.versions.get(content.id)!;
    if (versions.length > 50) {
      versions.shift();
    }
  }

  private generateContentId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Media Manager
 */
export class MediaManager {
  private media: Map<string, Media> = new Map();

  /**
   * Upload media
   */
  uploadMedia(media: Omit<Media, 'id' | 'createdAt'>): Media {
    const fullMedia: Media = {
      ...media,
      id: this.generateMediaId(),
      createdAt: new Date(),
    };

    this.media.set(fullMedia.id, fullMedia);

    eventBus.emitSync('cms.media_uploaded', fullMedia, 'MediaManager');

    return fullMedia;
  }

  /**
   * Get media
   */
  getMedia(mediaId: string): Media | undefined {
    return this.media.get(mediaId);
  }

  /**
   * List media
   */
  listMedia(filter?: { type?: MediaType; uploadedBy?: string }): Media[] {
    let mediaList = Array.from(this.media.values());

    if (filter?.type) {
      mediaList = mediaList.filter(m => m.type === filter.type);
    }

    if (filter?.uploadedBy) {
      mediaList = mediaList.filter(m => m.uploadedBy === filter.uploadedBy);
    }

    return mediaList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Delete media
   */
  deleteMedia(mediaId: string): void {
    this.media.delete(mediaId);
    eventBus.emitSync('cms.media_deleted', { mediaId }, 'MediaManager');
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(mediaId: string, width: number, height: number): Promise<string> {
    const media = this.media.get(mediaId);

    if (!media || media.type !== MediaType.Image) {
      throw new Error('Invalid media for thumbnail generation');
    }

    // Mock thumbnail generation
    return `${media.url}?w=${width}&h=${height}`;
  }

  private generateMediaId(): string {
    return `media_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Taxonomy Manager
 */
export class TaxonomyManager {
  private categories: Map<string, Category> = new Map();
  private tags: Map<string, Tag> = new Map();

  /**
   * Create category
   */
  createCategory(category: Omit<Category, 'id' | 'count'>): Category {
    const fullCategory: Category = {
      ...category,
      id: this.generateCategoryId(),
      count: 0,
    };

    this.categories.set(fullCategory.id, fullCategory);

    eventBus.emitSync('cms.category_created', fullCategory, 'TaxonomyManager');

    return fullCategory;
  }

  /**
   * Get category
   */
  getCategory(categoryId: string): Category | undefined {
    return this.categories.get(categoryId);
  }

  /**
   * List categories
   */
  listCategories(parent?: string): Category[] {
    let categories = Array.from(this.categories.values());

    if (parent !== undefined) {
      categories = categories.filter(c => c.parent === parent);
    }

    return categories.sort((a, b) => a.order - b.order);
  }

  /**
   * Create tag
   */
  createTag(tag: Omit<Tag, 'id' | 'count'>): Tag {
    const fullTag: Tag = {
      ...tag,
      id: this.generateTagId(),
      count: 0,
    };

    this.tags.set(fullTag.id, fullTag);

    eventBus.emitSync('cms.tag_created', fullTag, 'TaxonomyManager');

    return fullTag;
  }

  /**
   * Get tag
   */
  getTag(tagId: string): Tag | undefined {
    return this.tags.get(tagId);
  }

  /**
   * List tags
   */
  listTags(): Tag[] {
    return Array.from(this.tags.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Increment category count
   */
  incrementCategoryCount(categoryId: string): void {
    const category = this.categories.get(categoryId);

    if (category) {
      category.count++;
    }
  }

  /**
   * Increment tag count
   */
  incrementTagCount(tagId: string): void {
    const tag = this.tags.get(tagId);

    if (tag) {
      tag.count++;
    }
  }

  private generateCategoryId(): string {
    return `category_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateTagId(): string {
    return `tag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Comment Manager
 */
export class CommentManager {
  private comments: Map<string, Comment> = new Map();

  /**
   * Create comment
   */
  createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Comment {
    const fullComment: Comment = {
      ...comment,
      id: this.generateCommentId(),
      createdAt: new Date(),
    };

    this.comments.set(fullComment.id, fullComment);

    eventBus.emitSync('cms.comment_created', fullComment, 'CommentManager');

    return fullComment;
  }

  /**
   * Update comment status
   */
  updateCommentStatus(commentId: string, status: CommentStatus): void {
    const comment = this.comments.get(commentId);

    if (comment) {
      comment.status = status;
      eventBus.emitSync('cms.comment_status_updated', comment, 'CommentManager');
    }
  }

  /**
   * Get comment
   */
  getComment(commentId: string): Comment | undefined {
    return this.comments.get(commentId);
  }

  /**
   * List comments
   */
  listComments(filter?: { contentId?: string; status?: CommentStatus }): Comment[] {
    let comments = Array.from(this.comments.values());

    if (filter?.contentId) {
      comments = comments.filter(c => c.contentId === filter.contentId);
    }

    if (filter?.status) {
      comments = comments.filter(c => c.status === filter.status);
    }

    return comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get comment thread
   */
  getCommentThread(commentId: string): Comment[] {
    const comment = this.comments.get(commentId);

    if (!comment) {
      return [];
    }

    const thread: Comment[] = [comment];

    // Get all replies
    const replies = Array.from(this.comments.values()).filter(c => c.parent === commentId);

    for (const reply of replies) {
      thread.push(...this.getCommentThread(reply.id));
    }

    return thread;
  }

  /**
   * Delete comment
   */
  deleteComment(commentId: string): void {
    this.comments.delete(commentId);
    eventBus.emitSync('cms.comment_deleted', { commentId }, 'CommentManager');
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Search Engine
 */
export class ContentSearchEngine {
  private contentManager: ContentManager;

  constructor(contentManager: ContentManager) {
    this.contentManager = contentManager;
  }

  /**
   * Search content
   */
  search(query: string, options?: SearchOptions): SearchResult[] {
    const allContent = this.contentManager.listContent({
      status: ContentStatus.Published,
    });

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const content of allContent) {
      let score = 0;

      // Title match (highest weight)
      if (content.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // Body match
      if (content.body.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }

      // Tag match
      if (content.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        score += 3;
      }

      // Excerpt match
      if (content.excerpt?.toLowerCase().includes(lowerQuery)) {
        score += 2;
      }

      if (score > 0) {
        results.push({
          content,
          score,
          highlights: this.generateHighlights(content, query),
        });
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const start = (options?.page || 0) * (options?.limit || 10);
    const end = start + (options?.limit || 10);

    return results.slice(start, end);
  }

  private generateHighlights(content: Content, query: string): string[] {
    const highlights: string[] = [];
    const lowerBody = content.body.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerBody.indexOf(lowerQuery);

    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(content.body.length, index + query.length + 50);
      highlights.push('...' + content.body.slice(start, end) + '...');
    }

    return highlights;
  }
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  types?: ContentType[];
}

export interface SearchResult {
  content: Content;
  score: number;
  highlights: string[];
}

/**
 * Singleton instances
 */
export const contentManager = new ContentManager();
export const mediaManager = new MediaManager();
export const taxonomyManager = new TaxonomyManager();
export const commentManager = new CommentManager();
export const contentSearchEngine = new ContentSearchEngine(contentManager);

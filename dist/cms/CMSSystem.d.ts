/**
 * Content Management System (CMS)
 * Content creation, versioning, publishing, and media management
 */
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
export declare enum ContentType {
    Article = "article",
    Page = "page",
    Post = "post",
    Product = "product",
    Documentation = "documentation",
    Custom = "custom"
}
export declare enum ContentStatus {
    Draft = "draft",
    Review = "review",
    Published = "published",
    Archived = "archived",
    Scheduled = "scheduled"
}
export declare enum ContentVisibility {
    Public = "public",
    Private = "private",
    Protected = "protected"
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
export declare enum MediaType {
    Image = "image",
    Video = "video",
    Audio = "audio",
    Document = "document",
    Other = "other"
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
export declare enum FieldType {
    Text = "text",
    Textarea = "textarea",
    RichText = "rich_text",
    Number = "number",
    Boolean = "boolean",
    Date = "date",
    Select = "select",
    MultiSelect = "multi_select",
    Image = "image",
    Gallery = "gallery",
    Relationship = "relationship"
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
export declare enum WorkflowAction {
    Approve = "approve",
    Reject = "reject",
    Edit = "edit",
    Comment = "comment"
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
export declare enum CommentStatus {
    Pending = "pending",
    Approved = "approved",
    Spam = "spam",
    Trash = "trash"
}
/**
 * Content Manager
 */
export declare class ContentManager {
    private content;
    private versions;
    private templates;
    /**
     * Create content
     */
    createContent(content: Omit<Content, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Content;
    /**
     * Update content
     */
    updateContent(contentId: string, updates: Partial<Content>, changes?: string): Content;
    /**
     * Publish content
     */
    publishContent(contentId: string): void;
    /**
     * Unpublish content
     */
    unpublishContent(contentId: string): void;
    /**
     * Delete content
     */
    deleteContent(contentId: string): void;
    /**
     * Get content
     */
    getContent(contentId: string): Content | undefined;
    /**
     * Get content by slug
     */
    getContentBySlug(slug: string): Content | undefined;
    /**
     * List content
     */
    listContent(filter?: {
        type?: ContentType;
        status?: ContentStatus;
        author?: string;
        tags?: string[];
        categories?: string[];
    }): Content[];
    /**
     * Get versions
     */
    getVersions(contentId: string): ContentVersion[];
    /**
     * Restore version
     */
    restoreVersion(contentId: string, version: number): Content;
    /**
     * Register template
     */
    registerTemplate(template: Omit<ContentTemplate, 'id' | 'createdAt'>): ContentTemplate;
    /**
     * Get template
     */
    getTemplate(templateId: string): ContentTemplate | undefined;
    private createVersion;
    private generateContentId;
    private generateTemplateId;
}
/**
 * Media Manager
 */
export declare class MediaManager {
    private media;
    /**
     * Upload media
     */
    uploadMedia(media: Omit<Media, 'id' | 'createdAt'>): Media;
    /**
     * Get media
     */
    getMedia(mediaId: string): Media | undefined;
    /**
     * List media
     */
    listMedia(filter?: {
        type?: MediaType;
        uploadedBy?: string;
    }): Media[];
    /**
     * Delete media
     */
    deleteMedia(mediaId: string): void;
    /**
     * Generate thumbnail
     */
    generateThumbnail(mediaId: string, width: number, height: number): Promise<string>;
    private generateMediaId;
}
/**
 * Taxonomy Manager
 */
export declare class TaxonomyManager {
    private categories;
    private tags;
    /**
     * Create category
     */
    createCategory(category: Omit<Category, 'id' | 'count'>): Category;
    /**
     * Get category
     */
    getCategory(categoryId: string): Category | undefined;
    /**
     * List categories
     */
    listCategories(parent?: string): Category[];
    /**
     * Create tag
     */
    createTag(tag: Omit<Tag, 'id' | 'count'>): Tag;
    /**
     * Get tag
     */
    getTag(tagId: string): Tag | undefined;
    /**
     * List tags
     */
    listTags(): Tag[];
    /**
     * Increment category count
     */
    incrementCategoryCount(categoryId: string): void;
    /**
     * Increment tag count
     */
    incrementTagCount(tagId: string): void;
    private generateCategoryId;
    private generateTagId;
}
/**
 * Comment Manager
 */
export declare class CommentManager {
    private comments;
    /**
     * Create comment
     */
    createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Comment;
    /**
     * Update comment status
     */
    updateCommentStatus(commentId: string, status: CommentStatus): void;
    /**
     * Get comment
     */
    getComment(commentId: string): Comment | undefined;
    /**
     * List comments
     */
    listComments(filter?: {
        contentId?: string;
        status?: CommentStatus;
    }): Comment[];
    /**
     * Get comment thread
     */
    getCommentThread(commentId: string): Comment[];
    /**
     * Delete comment
     */
    deleteComment(commentId: string): void;
    private generateCommentId;
}
/**
 * Search Engine
 */
export declare class ContentSearchEngine {
    private contentManager;
    constructor(contentManager: ContentManager);
    /**
     * Search content
     */
    search(query: string, options?: SearchOptions): SearchResult[];
    private generateHighlights;
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
export declare const contentManager: ContentManager;
export declare const mediaManager: MediaManager;
export declare const taxonomyManager: TaxonomyManager;
export declare const commentManager: CommentManager;
export declare const contentSearchEngine: ContentSearchEngine;
//# sourceMappingURL=CMSSystem.d.ts.map
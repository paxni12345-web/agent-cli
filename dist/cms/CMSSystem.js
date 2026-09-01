"use strict";
/**
 * Content Management System (CMS)
 * Content creation, versioning, publishing, and media management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentSearchEngine = exports.commentManager = exports.taxonomyManager = exports.mediaManager = exports.contentManager = exports.ContentSearchEngine = exports.CommentManager = exports.TaxonomyManager = exports.MediaManager = exports.ContentManager = exports.CommentStatus = exports.WorkflowAction = exports.FieldType = exports.MediaType = exports.ContentVisibility = exports.ContentStatus = exports.ContentType = void 0;
const EventBus_1 = require("../core/EventBus");
var ContentType;
(function (ContentType) {
    ContentType["Article"] = "article";
    ContentType["Page"] = "page";
    ContentType["Post"] = "post";
    ContentType["Product"] = "product";
    ContentType["Documentation"] = "documentation";
    ContentType["Custom"] = "custom";
})(ContentType || (exports.ContentType = ContentType = {}));
var ContentStatus;
(function (ContentStatus) {
    ContentStatus["Draft"] = "draft";
    ContentStatus["Review"] = "review";
    ContentStatus["Published"] = "published";
    ContentStatus["Archived"] = "archived";
    ContentStatus["Scheduled"] = "scheduled";
})(ContentStatus || (exports.ContentStatus = ContentStatus = {}));
var ContentVisibility;
(function (ContentVisibility) {
    ContentVisibility["Public"] = "public";
    ContentVisibility["Private"] = "private";
    ContentVisibility["Protected"] = "protected";
})(ContentVisibility || (exports.ContentVisibility = ContentVisibility = {}));
var MediaType;
(function (MediaType) {
    MediaType["Image"] = "image";
    MediaType["Video"] = "video";
    MediaType["Audio"] = "audio";
    MediaType["Document"] = "document";
    MediaType["Other"] = "other";
})(MediaType || (exports.MediaType = MediaType = {}));
var FieldType;
(function (FieldType) {
    FieldType["Text"] = "text";
    FieldType["Textarea"] = "textarea";
    FieldType["RichText"] = "rich_text";
    FieldType["Number"] = "number";
    FieldType["Boolean"] = "boolean";
    FieldType["Date"] = "date";
    FieldType["Select"] = "select";
    FieldType["MultiSelect"] = "multi_select";
    FieldType["Image"] = "image";
    FieldType["Gallery"] = "gallery";
    FieldType["Relationship"] = "relationship";
})(FieldType || (exports.FieldType = FieldType = {}));
var WorkflowAction;
(function (WorkflowAction) {
    WorkflowAction["Approve"] = "approve";
    WorkflowAction["Reject"] = "reject";
    WorkflowAction["Edit"] = "edit";
    WorkflowAction["Comment"] = "comment";
})(WorkflowAction || (exports.WorkflowAction = WorkflowAction = {}));
var CommentStatus;
(function (CommentStatus) {
    CommentStatus["Pending"] = "pending";
    CommentStatus["Approved"] = "approved";
    CommentStatus["Spam"] = "spam";
    CommentStatus["Trash"] = "trash";
})(CommentStatus || (exports.CommentStatus = CommentStatus = {}));
/**
 * Content Manager
 */
class ContentManager {
    content = new Map();
    versions = new Map();
    templates = new Map();
    /**
     * Create content
     */
    createContent(content) {
        const fullContent = {
            ...content,
            id: this.generateContentId(),
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.content.set(fullContent.id, fullContent);
        // Create initial version
        this.createVersion(fullContent, 'Initial version');
        EventBus_1.eventBus.emitSync('cms.content_created', fullContent, 'ContentManager');
        return fullContent;
    }
    /**
     * Update content
     */
    updateContent(contentId, updates, changes = 'Content updated') {
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
        EventBus_1.eventBus.emitSync('cms.content_updated', content, 'ContentManager');
        return content;
    }
    /**
     * Publish content
     */
    publishContent(contentId) {
        const content = this.content.get(contentId);
        if (!content) {
            throw new Error(`Content not found: ${contentId}`);
        }
        content.status = ContentStatus.Published;
        content.publishedAt = new Date();
        content.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('cms.content_published', content, 'ContentManager');
    }
    /**
     * Unpublish content
     */
    unpublishContent(contentId) {
        const content = this.content.get(contentId);
        if (!content) {
            throw new Error(`Content not found: ${contentId}`);
        }
        content.status = ContentStatus.Draft;
        content.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('cms.content_unpublished', content, 'ContentManager');
    }
    /**
     * Delete content
     */
    deleteContent(contentId) {
        this.content.delete(contentId);
        this.versions.delete(contentId);
        EventBus_1.eventBus.emitSync('cms.content_deleted', { contentId }, 'ContentManager');
    }
    /**
     * Get content
     */
    getContent(contentId) {
        return this.content.get(contentId);
    }
    /**
     * Get content by slug
     */
    getContentBySlug(slug) {
        return Array.from(this.content.values()).find(c => c.slug === slug);
    }
    /**
     * List content
     */
    listContent(filter) {
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
            contents = contents.filter(c => filter.tags.some(tag => c.tags.includes(tag)));
        }
        if (filter?.categories) {
            contents = contents.filter(c => filter.categories.some(cat => c.categories.includes(cat)));
        }
        return contents.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    /**
     * Get versions
     */
    getVersions(contentId) {
        return this.versions.get(contentId) || [];
    }
    /**
     * Restore version
     */
    restoreVersion(contentId, version) {
        const content = this.content.get(contentId);
        if (!content) {
            throw new Error(`Content not found: ${contentId}`);
        }
        const versions = this.versions.get(contentId) || [];
        const targetVersion = versions.find(v => v.version === version);
        if (!targetVersion) {
            throw new Error(`Version not found: ${version}`);
        }
        return this.updateContent(contentId, {
            title: targetVersion.title,
            body: targetVersion.body,
        }, `Restored to version ${version}`);
    }
    /**
     * Register template
     */
    registerTemplate(template) {
        const fullTemplate = {
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
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    createVersion(content, changes) {
        const version = {
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
        this.versions.get(content.id).push(version);
        // Keep only last 50 versions
        const versions = this.versions.get(content.id);
        if (versions.length > 50) {
            versions.shift();
        }
    }
    generateContentId() {
        return `content_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateTemplateId() {
        return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ContentManager = ContentManager;
/**
 * Media Manager
 */
class MediaManager {
    media = new Map();
    /**
     * Upload media
     */
    uploadMedia(media) {
        const fullMedia = {
            ...media,
            id: this.generateMediaId(),
            createdAt: new Date(),
        };
        this.media.set(fullMedia.id, fullMedia);
        EventBus_1.eventBus.emitSync('cms.media_uploaded', fullMedia, 'MediaManager');
        return fullMedia;
    }
    /**
     * Get media
     */
    getMedia(mediaId) {
        return this.media.get(mediaId);
    }
    /**
     * List media
     */
    listMedia(filter) {
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
    deleteMedia(mediaId) {
        this.media.delete(mediaId);
        EventBus_1.eventBus.emitSync('cms.media_deleted', { mediaId }, 'MediaManager');
    }
    /**
     * Generate thumbnail
     */
    async generateThumbnail(mediaId, width, height) {
        const media = this.media.get(mediaId);
        if (!media || media.type !== MediaType.Image) {
            throw new Error('Invalid media for thumbnail generation');
        }
        // Mock thumbnail generation
        return `${media.url}?w=${width}&h=${height}`;
    }
    generateMediaId() {
        return `media_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MediaManager = MediaManager;
/**
 * Taxonomy Manager
 */
class TaxonomyManager {
    categories = new Map();
    tags = new Map();
    /**
     * Create category
     */
    createCategory(category) {
        const fullCategory = {
            ...category,
            id: this.generateCategoryId(),
            count: 0,
        };
        this.categories.set(fullCategory.id, fullCategory);
        EventBus_1.eventBus.emitSync('cms.category_created', fullCategory, 'TaxonomyManager');
        return fullCategory;
    }
    /**
     * Get category
     */
    getCategory(categoryId) {
        return this.categories.get(categoryId);
    }
    /**
     * List categories
     */
    listCategories(parent) {
        let categories = Array.from(this.categories.values());
        if (parent !== undefined) {
            categories = categories.filter(c => c.parent === parent);
        }
        return categories.sort((a, b) => a.order - b.order);
    }
    /**
     * Create tag
     */
    createTag(tag) {
        const fullTag = {
            ...tag,
            id: this.generateTagId(),
            count: 0,
        };
        this.tags.set(fullTag.id, fullTag);
        EventBus_1.eventBus.emitSync('cms.tag_created', fullTag, 'TaxonomyManager');
        return fullTag;
    }
    /**
     * Get tag
     */
    getTag(tagId) {
        return this.tags.get(tagId);
    }
    /**
     * List tags
     */
    listTags() {
        return Array.from(this.tags.values()).sort((a, b) => b.count - a.count);
    }
    /**
     * Increment category count
     */
    incrementCategoryCount(categoryId) {
        const category = this.categories.get(categoryId);
        if (category) {
            category.count++;
        }
    }
    /**
     * Increment tag count
     */
    incrementTagCount(tagId) {
        const tag = this.tags.get(tagId);
        if (tag) {
            tag.count++;
        }
    }
    generateCategoryId() {
        return `category_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateTagId() {
        return `tag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TaxonomyManager = TaxonomyManager;
/**
 * Comment Manager
 */
class CommentManager {
    comments = new Map();
    /**
     * Create comment
     */
    createComment(comment) {
        const fullComment = {
            ...comment,
            id: this.generateCommentId(),
            createdAt: new Date(),
        };
        this.comments.set(fullComment.id, fullComment);
        EventBus_1.eventBus.emitSync('cms.comment_created', fullComment, 'CommentManager');
        return fullComment;
    }
    /**
     * Update comment status
     */
    updateCommentStatus(commentId, status) {
        const comment = this.comments.get(commentId);
        if (comment) {
            comment.status = status;
            EventBus_1.eventBus.emitSync('cms.comment_status_updated', comment, 'CommentManager');
        }
    }
    /**
     * Get comment
     */
    getComment(commentId) {
        return this.comments.get(commentId);
    }
    /**
     * List comments
     */
    listComments(filter) {
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
    getCommentThread(commentId) {
        const comment = this.comments.get(commentId);
        if (!comment) {
            return [];
        }
        const thread = [comment];
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
    deleteComment(commentId) {
        this.comments.delete(commentId);
        EventBus_1.eventBus.emitSync('cms.comment_deleted', { commentId }, 'CommentManager');
    }
    generateCommentId() {
        return `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CommentManager = CommentManager;
/**
 * Search Engine
 */
class ContentSearchEngine {
    contentManager;
    constructor(contentManager) {
        this.contentManager = contentManager;
    }
    /**
     * Search content
     */
    search(query, options) {
        const allContent = this.contentManager.listContent({
            status: ContentStatus.Published,
        });
        const results = [];
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
    generateHighlights(content, query) {
        const highlights = [];
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
exports.ContentSearchEngine = ContentSearchEngine;
/**
 * Singleton instances
 */
exports.contentManager = new ContentManager();
exports.mediaManager = new MediaManager();
exports.taxonomyManager = new TaxonomyManager();
exports.commentManager = new CommentManager();
exports.contentSearchEngine = new ContentSearchEngine(exports.contentManager);

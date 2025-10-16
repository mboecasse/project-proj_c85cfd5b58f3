// File: src/utils/pagination.js
// Generated: 2025-10-16 10:39:39 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_f8720jp0j7nq


const logger = require('./logger');

/**
 * Pagination utility class for MongoDB queries
 * Provides helper functions for implementing pagination in API responses
 */
class Pagination {
  /**
   * Default pagination configuration
   */
  static DEFAULT_PAGE = 1;
  static DEFAULT_LIMIT = 10;
  static MAX_LIMIT = 100;
  static MIN_LIMIT = 1;

  /**
   * Validate and sanitize pagination parameters
   * @param {number|string} page - Page number (1-indexed)
   * @param {number|string} limit - Items per page
   * @returns {Object} Validated pagination params { page, limit, skip }
   */
  static getPaginationParams(page = this.DEFAULT_PAGE, limit = this.DEFAULT_LIMIT) {
    try {
      // Parse and validate page number
      let validatedPage = parseInt(page, 10);
      if (isNaN(validatedPage) || validatedPage < 1) {
        logger.warn('Invalid page number provided, using default', { page });
        validatedPage = this.DEFAULT_PAGE;
      }

      // Parse and validate limit
      let validatedLimit = parseInt(limit, 10);
      if (isNaN(validatedLimit) || validatedLimit < this.MIN_LIMIT) {
        logger.warn('Invalid limit provided, using default', { limit });
        validatedLimit = this.DEFAULT_LIMIT;
      }

      // Enforce maximum limit to prevent excessive queries
      if (validatedLimit > this.MAX_LIMIT) {
        logger.warn('Limit exceeds maximum, capping at max', {
          requestedLimit: validatedLimit,
          maxLimit: this.MAX_LIMIT
        });
        validatedLimit = this.MAX_LIMIT;
      }

      // Calculate skip value for MongoDB
      const skip = (validatedPage - 1) * validatedLimit;

      return {
        page: validatedPage,
        limit: validatedLimit,
        skip
      };
    } catch (error) {
      logger.error('Error validating pagination params', {
        error: error.message,
        page,
        limit
      });
      return {
        page: this.DEFAULT_PAGE,
        limit: this.DEFAULT_LIMIT,
        skip: 0
      };
    }
  }

  /**
   * Generate pagination metadata for API responses
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} totalCount - Total number of items
   * @returns {Object} Pagination metadata
   */
  static getPaginationMeta(page, limit, totalCount) {
    try {
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPreviousPage: hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null,
        startIndex: totalCount > 0 ? (page - 1) * limit + 1 : 0,
        endIndex: Math.min(page * limit, totalCount)
      };
    } catch (error) {
      logger.error('Error generating pagination metadata', {
        error: error.message,
        page,
        limit,
        totalCount
      });
      throw error;
    }
  }

  /**
   * Build standardized paginated response structure
   * @param {Array} data - Array of items for current page
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} totalCount - Total number of items
   * @param {string} baseUrl - Base URL for generating navigation links
   * @returns {Object} Complete paginated response
   */
  static buildPaginatedResponse(data, page, limit, totalCount, baseUrl = '/api/resource') {
    try {
      const meta = this.getPaginationMeta(page, limit, totalCount);

      // Generate HATEOAS-style navigation links
      const links = this.generateNavigationLinks(baseUrl, page, limit, meta.totalPages);

      return {
        success: true,
        data: data,
        pagination: meta,
        links: links
      };
    } catch (error) {
      logger.error('Error building paginated response', {
        error: error.message,
        page,
        limit,
        totalCount
      });
      throw error;
    }
  }

  /**
   * Generate navigation links for paginated responses (HATEOAS)
   * @param {string} baseUrl - Base URL for the resource
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} totalPages - Total number of pages
   * @returns {Object} Navigation links object
   */
  static generateNavigationLinks(baseUrl, page, limit, totalPages) {
    try {
      const buildUrl = (pageNum) => {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}page=${pageNum}&limit=${limit}`;
      };

      return {
        self: buildUrl(page),
        first: buildUrl(1),
        last: buildUrl(totalPages),
        next: page < totalPages ? buildUrl(page + 1) : null,
        prev: page > 1 ? buildUrl(page - 1) : null
      };
    } catch (error) {
      logger.error('Error generating navigation links', {
        error: error.message,
        baseUrl,
        page,
        limit
      });
      return {
        self: baseUrl,
        first: baseUrl,
        last: baseUrl,
        next: null,
        prev: null
      };
    }
  }

  /**
   * Apply pagination to MongoDB query and return paginated results
   * @param {Object} model - Mongoose model
   * @param {Object} query - MongoDB query object
   * @param {number|string} page - Page number
   * @param {number|string} limit - Items per page
   * @param {Object} sort - Sort criteria (default: { createdAt: -1 })
   * @param {string} baseUrl - Base URL for navigation links
   * @returns {Promise<Object>} Paginated response with data and metadata
   */
  static async paginateQuery(
    model,
    query = {},
    page = this.DEFAULT_PAGE,
    limit = this.DEFAULT_LIMIT,
    sort = { createdAt: -1 },
    baseUrl = '/api/resource'
  ) {
    try {
      const { skip, limit: validatedLimit, page: validatedPage } = this.getPaginationParams(page, limit);

      // Execute query and count in parallel for better performance
      const [data, totalCount] = await Promise.all([
        model
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(validatedLimit)
          .lean()
          .exec(),
        model.countDocuments(query).exec()
      ]);

      logger.info('Paginated query executed', {
        model: model.modelName,
        page: validatedPage,
        limit: validatedLimit,
        totalCount,
        resultCount: data.length
      });

      return this.buildPaginatedResponse(data, validatedPage, validatedLimit, totalCount, baseUrl);
    } catch (error) {
      logger.error('Error executing paginated query', {
        error: error.message,
        model: model.modelName,
        query,
        page,
        limit
      });
      throw error;
    }
  }

  /**
   * Apply pagination with populate to MongoDB query
   * @param {Object} model - Mongoose model
   * @param {Object} query - MongoDB query object
   * @param {number|string} page - Page number
   * @param {number|string} limit - Items per page
   * @param {Object} sort - Sort criteria
   * @param {string|Object|Array} populate - Fields to populate
   * @param {string} baseUrl - Base URL for navigation links
   * @returns {Promise<Object>} Paginated response with populated data
   */
  static async paginateQueryWithPopulate(
    model,
    query = {},
    page = this.DEFAULT_PAGE,
    limit = this.DEFAULT_LIMIT,
    sort = { createdAt: -1 },
    populate = '',
    baseUrl = '/api/resource'
  ) {
    try {
      const { skip, limit: validatedLimit, page: validatedPage } = this.getPaginationParams(page, limit);

      // Execute query with populate and count in parallel
      const [data, totalCount] = await Promise.all([
        model
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(validatedLimit)
          .populate(populate)
          .lean()
          .exec(),
        model.countDocuments(query).exec()
      ]);

      logger.info('Paginated query with populate executed', {
        model: model.modelName,
        page: validatedPage,
        limit: validatedLimit,
        totalCount,
        resultCount: data.length,
        populate: typeof populate === 'string' ? populate : 'multiple fields'
      });

      return this.buildPaginatedResponse(data, validatedPage, validatedLimit, totalCount, baseUrl);
    } catch (error) {
      logger.error('Error executing paginated query with populate', {
        error: error.message,
        model: model.modelName,
        query,
        page,
        limit,
        populate
      });
      throw error;
    }
  }

  /**
   * Express middleware to parse and validate pagination parameters from request
   * Attaches validated pagination params to req.pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static parsePaginationParams(req, res, next) {
    try {
      const page = req.query.page;
      const limit = req.query.limit;

      req.pagination = Pagination.getPaginationParams(page, limit);

      logger.debug('Pagination params parsed', {
        originalPage: page,
        originalLimit: limit,
        validated: req.pagination
      });

      next();
    } catch (error) {
      logger.error('Error parsing pagination params', {
        error: error.message,
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Calculate offset for SQL-style pagination
   * @param {number|string} page - Page number
   * @param {number|string} limit - Items per page
   * @returns {number} Offset value
   */
  static calculateOffset(page, limit) {
    const { skip } = this.getPaginationParams(page, limit);
    return skip;
  }

  /**
   * Validate if page number is within valid range
   * @param {number} page - Page number to validate
   * @param {number} totalPages - Total number of pages
   * @returns {boolean} True if page is valid
   */
  static isValidPage(page, totalPages) {
    return page >= 1 && page <= totalPages;
  }

  /**
   * Get page range for pagination UI (e.g., [1, 2, 3, ..., 10])
   * @param {number} currentPage - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {number} maxPages - Maximum pages to show (default: 5)
   * @returns {Array<number>} Array of page numbers to display
   */
  static getPageRange(currentPage, totalPages, maxPages = 5) {
    try {
      if (totalPages <= maxPages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const halfRange = Math.floor(maxPages / 2);
      let startPage = Math.max(1, currentPage - halfRange);
      let endPage = Math.min(totalPages, startPage + maxPages - 1);

      if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
      }

      return Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => startPage + i
      );
    } catch (error) {
      logger.error('Error calculating page range', {
        error: error.message,
        currentPage,
        totalPages,
        maxPages
      });
      return [1];
    }
  }
}

module.exports = Pagination;

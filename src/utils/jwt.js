// File: src/utils/jwt.js
// Generated: 2025-10-16 10:40:25 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_qx3erjofxkj0


const config = require('../config/environment');


const jwt = require('jsonwebtoken');

/**
 * JWT Utility Class
 * Handles JWT token generation, verification, and decoding
 * Supports both access and refresh tokens with separate secrets
 */
class Jwt {
  /**
   * Generate access token with user payload
   * @param {Object} payload - User data to encode
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @param {number} [payload.tokenVersion] - Token version for invalidation
   * @returns {string} JWT access token
   * @throws {Error} If JWT_ACCESS_SECRET is not configured
   */
  static generateAccessToken(payload) {
    const { userId, email, role, tokenVersion } = payload;

    if (!config.jwt.accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const tokenPayload = {
      userId,
      email,
      role
    };

    // Include token version if provided for invalidation support
    if (tokenVersion !== undefined) {
      tokenPayload.tokenVersion = tokenVersion;
    }

    return jwt.sign(
      tokenPayload,
      config.jwt.accessSecret,
      {
        expiresIn: config.jwt.accessExpiry || '15m',
        algorithm: 'HS256'
      }
    );
  }

  /**
   * Generate refresh token with minimal payload
   * @param {Object} payload - User data to encode
   * @param {string} payload.userId - User ID
   * @param {number} [payload.tokenVersion] - Token version for invalidation
   * @returns {string} JWT refresh token
   * @throws {Error} If JWT_REFRESH_SECRET is not configured
   */
  static generateRefreshToken(payload) {
    const { userId, tokenVersion } = payload;

    if (!config.jwt.refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const tokenPayload = {
      userId
    };

    // Include token version if provided for invalidation support
    if (tokenVersion !== undefined) {
      tokenPayload.tokenVersion = tokenVersion;
    }

    return jwt.sign(
      tokenPayload,
      config.jwt.refreshSecret,
      {
        expiresIn: config.jwt.refreshExpiry || '7d',
        algorithm: 'HS256'
      }
    );
  }

  /**
   * Verify and decode access token
   * @param {string} token - JWT access token to verify
   * @returns {Object} Decoded token payload
   * @throws {Object} Error object with name, message, and statusCode
   */
  static verifyAccessToken(token) {
    if (!token) {
      throw {
        name: 'JsonWebTokenError',
        message: 'No token provided',
        statusCode: 401
      };
    }

    if (!config.jwt.accessSecret) {
      throw {
        name: 'JsonWebTokenError',
        message: 'JWT_ACCESS_SECRET is not configured',
        statusCode: 500
      };
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);

      // Validate required claims
      if (!decoded.userId || !decoded.email || !decoded.role) {
        throw {
          name: 'JsonWebTokenError',
          message: 'Invalid token structure - missing required claims',
          statusCode: 401
        };
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw {
          name: 'TokenExpiredError',
          message: 'Access token has expired',
          statusCode: 401
        };
      }

      if (error.name === 'JsonWebTokenError') {
        throw {
          name: 'JsonWebTokenError',
          message: 'Invalid access token',
          statusCode: 401
        };
      }

      if (error.name === 'NotBeforeError') {
        throw {
          name: 'NotBeforeError',
          message: 'Token not active yet',
          statusCode: 401
        };
      }

      // Re-throw if already formatted
      if (error.statusCode) {
        throw error;
      }

      // Wrap unexpected errors
      throw {
        name: 'JsonWebTokenError',
        message: 'Token verification failed',
        statusCode: 401
      };
    }
  }

  /**
   * Verify and decode refresh token
   * @param {string} token - JWT refresh token to verify
   * @returns {Object} Decoded token payload
   * @throws {Object} Error object with name, message, and statusCode
   */
  static verifyRefreshToken(token) {
    if (!token) {
      throw {
        name: 'JsonWebTokenError',
        message: 'No refresh token provided',
        statusCode: 401
      };
    }

    if (!config.jwt.refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret);

      // Validate required claims
      if (!decoded.userId) {
        throw {
          name: 'JsonWebTokenError',
          message: 'Invalid refresh token structure - missing userId',
          statusCode: 401
        };
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw {
          name: 'TokenExpiredError',
          message: 'Refresh token has expired',
          statusCode: 401
        };
      }

      if (error.name === 'JsonWebTokenError') {
        throw {
          name: 'JsonWebTokenError',
          message: 'Invalid refresh token',
          statusCode: 401
        };
      }

      if (error.name === 'NotBeforeError') {
        throw {
          name: 'NotBeforeError',
          message: 'Refresh token not active yet',
          statusCode: 401
        };
      }

      // Re-throw if already formatted
      if (error.statusCode) {
        throw error;
      }

      // Wrap unexpected errors
      throw {
        name: 'JsonWebTokenError',
        message: 'Refresh token verification failed',
        statusCode: 401
      };
    }
  }

  /**
   * Decode token without verification
   * WARNING: This method does not verify the token signature.
   * Only use for non-security-critical operations like extracting metadata.
   * Always use verifyAccessToken or verifyRefreshToken for authentication.
   * @param {string} token - JWT token to decode
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  static decodeToken(token) {
    if (!token) {
      return null;
    }

    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate both access and refresh tokens
   * Convenience method for login/registration flows
   * @param {Object} payload - User data to encode
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @param {number} [payload.tokenVersion] - Token version for invalidation
   * @returns {Object} Object containing accessToken and refreshToken
   */
  static generateTokenPair(payload) {
    const { userId, email, role, tokenVersion } = payload;

    if (!userId || !email || !role) {
      throw new Error('Missing required fields: userId, email, and role are required');
    }

    const accessToken = this.generateAccessToken({
      userId,
      email,
      role,
      tokenVersion
    });

    const refreshToken = this.generateRefreshToken({
      userId,
      tokenVersion
    });

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Extract token from Authorization header
   * Supports "Bearer <token>" format
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token or null
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Check if token is expired without verification
   * WARNING: This uses unverified token decoding. For security-critical checks,
   * use verifyAccessToken or verifyRefreshToken which will throw on expiration.
   * @param {string} token - JWT token to check
   * @returns {boolean} True if token is expired
   */
  static isTokenExpired(token) {
    if (!token) {
      return true;
    }

    try {
      // Verify the token first to ensure it's authentic
      const tokenType = this._detectTokenType(token);
      if (tokenType === 'access') {
        this.verifyAccessToken(token);
      } else if (tokenType === 'refresh') {
        this.verifyRefreshToken(token);
      } else {
        return true;
      }
      return false;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return true;
      }
      // For other errors (invalid signature, etc.), consider expired
      return true;
    }
  }

  /**
   * Get token expiration date
   * WARNING: This uses unverified token decoding. For security-critical operations,
   * verify the token first using verifyAccessToken or verifyRefreshToken.
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date or null if invalid
   */
  static getTokenExpiration(token) {
    if (!token) {
      return null;
    }

    try {
      // Verify the token first to ensure it's authentic
      const tokenType = this._detectTokenType(token);
      let decoded;

      if (tokenType === 'access') {
        decoded = this.verifyAccessToken(token);
      } else if (tokenType === 'refresh') {
        decoded = this.verifyRefreshToken(token);
      } else {
        return null;
      }

      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch (error) {
      // If verification fails, try to decode for expiration info
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return null;
      }
      return new Date(decoded.exp * 1000);
    }
  }

  /**
   * Validate token version against user's current version
   * Used to invalidate all tokens on password change
   * WARNING: Only call this with a verified token payload from verifyAccessToken or verifyRefreshToken
   * @param {Object} decodedToken - Decoded JWT payload from verified token
   * @param {number} currentVersion - User's current token version from database
   * @returns {boolean} True if token version is valid
   */
  static validateTokenVersion(decodedToken, currentVersion) {
    // If no version tracking, consider valid
    if (decodedToken.tokenVersion === undefined || currentVersion === undefined) {
      return true;
    }

    return decodedToken.tokenVersion === currentVersion;
  }

  /**
   * Detect token type by checking payload structure
   * @private
   * @param {string} token - JWT token
   * @returns {string} 'access', 'refresh', or 'unknown'
   */
  static _detectTokenType(token) {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      return 'unknown';
    }

    // Access tokens have email and role
    if (decoded.email && decoded.role) {
      return 'access';
    }

    // Refresh tokens only have userId
    if (decoded.userId && !decoded.email && !decoded.role) {
      return 'refresh';
    }

    return 'unknown';
  }
}

module.exports = Jwt;

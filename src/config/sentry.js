const Sentry = require("@sentry/node");

/**
 * Sanitizes Sentry events to remove sensitive information
 * @param {Object} event - Sentry event object
 * @returns {Object|null} - Sanitized event or null to drop the event
 */
function sanitizeEvent(event) {
  // Remove sensitive data from event context
  if (event.extra) {
    // Remove sensitive parameters
    const sensitiveKeys = [
      "token",
      "password",
      "secret",
      "key",
      "auth",
      "credential",
      "slack_bot_token",
      "slack_signing_secret",
      "slack_app_token",
      "database_url",
      "direct_url",
    ];

    sensitiveKeys.forEach((key) => {
      if (event.extra[key]) {
        event.extra[key] = "[REDACTED]";
      }
    });

    // Sanitize nested objects
    if (event.extra.parameters && typeof event.extra.parameters === "object") {
      sensitiveKeys.forEach((key) => {
        if (event.extra.parameters[key]) {
          event.extra.parameters[key] = "[REDACTED]";
        }
      });
    }
  }

  // Remove sensitive data from request data
  if (event.request && event.request.data) {
    const data = event.request.data;
    if (typeof data === "object") {
      ["token", "password", "secret", "key"].forEach((key) => {
        if (data[key]) {
          data[key] = "[REDACTED]";
        }
      });
    }
  }

  return event;
}

/**
 * Filters breadcrumbs to remove sensitive information
 * @param {Object} breadcrumb - Sentry breadcrumb object
 * @returns {Object|null} - Filtered breadcrumb or null to drop it
 */
function filterBreadcrumb(breadcrumb) {
  // Skip console logs that might contain sensitive data
  if (breadcrumb.category === "console" && breadcrumb.level === "log") {
    const message = breadcrumb.message || "";
    const sensitivePatterns = [
      /token/i,
      /password/i,
      /secret/i,
      /key/i,
      /auth/i,
      /xoxb-/i,
      /xoxp-/i,
      /xoxe-/i, // Slack token patterns
    ];

    if (sensitivePatterns.some((pattern) => pattern.test(message))) {
      return null; // Drop sensitive breadcrumbs
    }
  }

  // Filter HTTP requests to remove sensitive headers
  if (breadcrumb.category === "http") {
    if (breadcrumb.data && breadcrumb.data.headers) {
      const headers = breadcrumb.data.headers;
      ["authorization", "cookie", "x-slack-signature"].forEach((header) => {
        if (headers[header]) {
          headers[header] = "[REDACTED]";
        }
      });
    }
  }

  return breadcrumb;
}

/**
 * Initializes Sentry with custom configuration
 */
function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn("SENTRY_DSN not configured. Sentry logging disabled.");
    return;
  }

  Sentry.init({
    dsn: dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",

    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    profilesSampleRate:
      parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,

    // Custom data scrubbing
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: filterBreadcrumb,

    // Integrations for Node.js environment
    integrations: [
      // HTTP integration for tracing HTTP requests
      new Sentry.Integrations.Http({
        tracing: true,
        breadcrumbs: true,
      }),

      // Console integration for capturing console logs
      new Sentry.Integrations.Console({
        levels: ["error", "warn"],
      }),

      // OnUncaughtException integration
      new Sentry.Integrations.OnUncaughtException({
        exitEvenIfOtherHandlersAreRegistered: false,
      }),

      // OnUnhandledRejection integration
      new Sentry.Integrations.OnUnhandledRejection({
        mode: "warn",
      }),
    ],

    // Additional configuration
    maxBreadcrumbs: 50,
    attachStacktrace: true,

    // Custom tags for all events
    initialScope: {
      tags: {
        component: "daily-dose-bot",
        service: "slack-bot",
      },
    },
  });

  console.log("Sentry initialized successfully");
}

/**
 * Creates a custom Sentry event for command execution
 * @param {string} userId - User ID
 * @param {string} command - Command name
 * @param {Object} params - Command parameters (will be sanitized)
 * @param {string} result - Execution result ('success', 'error', 'blocked')
 * @param {number} duration - Execution duration in milliseconds
 * @param {Object} additionalContext - Additional context data
 */
function logCommandEvent(
  userId,
  command,
  params,
  result,
  duration,
  additionalContext = {}
) {
  if (!Sentry.getCurrentHub().getClient()) {
    return; // Sentry not initialized
  }

  Sentry.addBreadcrumb({
    message: `Command executed: ${command}`,
    category: "command",
    level: result === "success" ? "info" : "warning",
    data: {
      command,
      result,
      duration,
    },
  });

  Sentry.withScope((scope) => {
    // Set user context
    scope.setUser({
      id: userId,
      username: additionalContext.username || "unknown",
    });

    // Set tags
    scope.setTag("command", command);
    scope.setTag("result", result);
    scope.setTag("environment", process.env.NODE_ENV || "development");

    // Set additional context
    scope.setContext("command", {
      type: command,
      channel: additionalContext.channelId,
      workspace: additionalContext.workspaceId,
      duration: duration,
    });

    // Set extra data (will be sanitized by beforeSend)
    scope.setExtra("parameters", params);
    scope.setExtra("duration", duration);

    if (additionalContext.organizationId) {
      scope.setExtra("organizationId", additionalContext.organizationId);
    }

    if (additionalContext.teamId) {
      scope.setExtra("teamId", additionalContext.teamId);
    }

    // Capture the event
    Sentry.captureMessage(`Command executed: ${command}`, "info");
  });
}

/**
 * Creates a custom Sentry event for security violations
 * @param {string} eventType - Type of security event
 * @param {string} userId - User ID
 * @param {Object} details - Event details
 * @param {string} severity - Event severity ('low', 'medium', 'high', 'critical')
 */
function logSecurityEvent(eventType, userId, details, severity = "medium") {
  if (!Sentry.getCurrentHub().getClient()) {
    return; // Sentry not initialized
  }

  const sentryLevel =
    {
      low: "info",
      medium: "warning",
      high: "error",
      critical: "fatal",
    }[severity] || "warning";

  Sentry.withScope((scope) => {
    // Set user context
    scope.setUser({
      id: userId,
      username: details.username || "unknown",
    });

    // Set tags for security events
    scope.setTag("security_event", eventType);
    scope.setTag("severity", severity);
    scope.setTag("userId", userId);

    if (details.command) {
      scope.setTag("command", details.command);
    }

    // Set fingerprint for grouping similar events
    scope.setFingerprint([eventType, userId]);

    // Set extra context
    scope.setExtra("details", details);
    scope.setExtra("attemptedAction", details.attemptedAction);
    scope.setExtra("resourceId", details.resourceId);

    if (details.rateLimitInfo) {
      scope.setExtra("rateLimitInfo", details.rateLimitInfo);
    }

    // Capture the security event
    Sentry.captureMessage(`Security violation: ${eventType}`, sentryLevel);
  });
}

/**
 * Logs performance metrics to Sentry
 * @param {string} command - Command name
 * @param {number} duration - Duration in milliseconds
 * @param {boolean} success - Whether the command was successful
 * @param {Object} additionalMetrics - Additional performance metrics
 */
function logPerformanceMetric(
  command,
  duration,
  success,
  additionalMetrics = {}
) {
  if (!Sentry.getCurrentHub().getClient()) {
    return; // Sentry not initialized
  }

  Sentry.withScope((scope) => {
    scope.setTag("command", command);
    scope.setTag("success", success.toString());

    scope.setExtra("duration", duration);
    scope.setExtra("metrics", additionalMetrics);

    // Use Sentry's performance monitoring
    const transaction = Sentry.startTransaction({
      op: "command",
      name: command,
    });

    transaction.setData("duration", duration);
    transaction.setData("success", success);
    transaction.setStatus(success ? "ok" : "internal_error");

    transaction.finish();
  });
}

module.exports = {
  initializeSentry,
  logCommandEvent,
  logSecurityEvent,
  logPerformanceMetric,
  sanitizeEvent,
  filterBreadcrumb,
};

/** Structured public runtime errors for failed chart mutations. */
export class ChartValidationError extends Error {
  constructor(operation, diagnostics = [], message = null) {
    const details = Array.isArray(diagnostics) ? diagnostics : [];
    const first = details[0] || {};
    super(message || details.map(item => item.message).filter(Boolean).join(' ') || `Invalid ${operation} mutation.`);
    this.name = 'ChartValidationError';
    this.code = 'CHART_VALIDATION_FAILED';
    this.operation = operation;
    this.details = details;
    this.errors = details;
    this.path = first.path;
    this.expected = first.expected;
    this.received = first.received;
    this.suggestion = first.suggestion;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      operation: this.operation,
      message: this.message,
      details: this.details,
      ...(this.path === undefined ? {} : { path: this.path }),
      ...(this.expected === undefined ? {} : { expected: this.expected }),
      ...(this.received === undefined ? {} : { received: this.received }),
      ...(this.suggestion === undefined ? {} : { suggestion: this.suggestion })
    };
  }
}

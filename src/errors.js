function ApiError(code, message) {
  this.name = 'ApiError';
  this.isApiError = true;
  this.code = code;
  this.message = message;
}

function assert(condition, code, message) {
  if (!condition) {
    throw new ApiError(code, message);
  }
}

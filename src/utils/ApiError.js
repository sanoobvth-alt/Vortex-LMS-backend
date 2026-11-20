export class ApiError extends Error {
  constructor(statusCode, message, code = 'REQUEST_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

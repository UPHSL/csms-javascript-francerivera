/**
 * Return a consistent HTTP 404 response.
 *
 * @param {import("express").Request} request Express request.
 * @param {import("express").Response} response Express response.
 */
export function notFound(request, response) {
  response.status(404).json({
    status: "error",
    message: "Resource not found"
  });
}
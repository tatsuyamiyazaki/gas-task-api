function ok(data) {
  return { success: true, data: data };
}

function fail(code, message) {
  return { success: false, error: { code: code, message: message } };
}

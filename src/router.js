var ACTIONS = {
  listTasklists: listTasklists,
  getTasklist: getTasklist,
  createTasklist: createTasklist,
  updateTasklist: updateTasklist,
  deleteTasklist: deleteTasklist,
  listTasks: listTasks,
  getTask: getTask,
  createTask: createTask,
  updateTask: updateTask,
  deleteTask: deleteTask,
  moveTask: moveTask
};

function handleRequest(svc, body) {
  try {
    assert(body && typeof body === 'object', 'VALIDATION', 'リクエストボディが不正です');
    assert(body.action, 'VALIDATION', 'action は必須です');
    var handler = ACTIONS[body.action];
    if (!handler) {
      throw new ApiError('UNKNOWN_ACTION', '不明な action です: ' + body.action);
    }
    return ok(handler(svc, body));
  } catch (err) {
    if (err && err.isApiError) {
      return fail(err.code, err.message);
    }
    return fail('INTERNAL', err && err.message ? err.message : String(err));
  }
}

function parseBody(contents) {
  try {
    return JSON.parse(contents);
  } catch (e) {
    throw new ApiError('VALIDATION', 'JSON の解析に失敗しました');
  }
}

function doPost(e) {
  var body;
  try {
    body = parseBody(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return jsonOutput(fail(err.code || 'VALIDATION', err.message));
  }
  return jsonOutput(handleRequest(Tasks, body));
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

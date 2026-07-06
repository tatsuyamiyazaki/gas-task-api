function listTasks(svc, params) {
  requireFields(params, ['tasklistId']);
  var baseOptions = { maxResults: 100 };
  if (params.showCompleted !== undefined) {
    baseOptions.showCompleted = params.showCompleted;
  }
  if (params.showHidden !== undefined) {
    baseOptions.showHidden = params.showHidden;
  }
  var items = [];
  var pageToken;
  do {
    var options = Object.assign({}, baseOptions);
    if (pageToken) {
      options.pageToken = pageToken;
    }
    var res = svc.Tasks.list(params.tasklistId, options);
    items = items.concat(res.items || []);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return items.map(toTaskDto);
}

function getTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  return toTaskDto(svc.Tasks.get(params.tasklistId, params.taskId));
}

function createTask(svc, params) {
  requireFields(params, ['tasklistId', 'title']);
  var resource = buildTaskResource(params);
  var options = {};
  if (params.parent) {
    options.parent = params.parent;
  }
  return toTaskDto(svc.Tasks.insert(resource, params.tasklistId, options));
}

function updateTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  var resource = buildTaskResource(params);
  return toTaskDto(svc.Tasks.patch(resource, params.tasklistId, params.taskId));
}

function deleteTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  svc.Tasks.remove(params.tasklistId, params.taskId);
  return { deleted: true, taskId: params.taskId };
}

function moveTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  var options = {};
  if (params.parent) {
    options.parent = params.parent;
  }
  if (params.previous) {
    options.previous = params.previous;
  }
  return toTaskDto(svc.Tasks.move(params.tasklistId, params.taskId, options));
}

function buildTaskResource(params) {
  var resource = {};
  if (params.title !== undefined) {
    resource.title = params.title;
  }
  if (params.notes !== undefined) {
    resource.notes = params.notes;
  }
  if (params.due !== undefined) {
    resource.due = parseDue(params.due);
  }
  if (params.status !== undefined) {
    resource.status = validateStatus(params.status);
  }
  return resource;
}

function toTaskDto(task) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status,
    due: formatDue(task.due),
    parent: task.parent,
    position: task.position,
    updated: task.updated
  };
}

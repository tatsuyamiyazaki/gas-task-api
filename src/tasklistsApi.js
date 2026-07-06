function listTasklists(svc, params) {
  var res = svc.Tasklists.list();
  return (res.items || []).map(toTasklistDto);
}

function getTasklist(svc, params) {
  requireFields(params, ['tasklistId']);
  return toTasklistDto(svc.Tasklists.get(params.tasklistId));
}

function createTasklist(svc, params) {
  requireFields(params, ['title']);
  return toTasklistDto(svc.Tasklists.insert({ title: params.title }));
}

function updateTasklist(svc, params) {
  requireFields(params, ['tasklistId', 'title']);
  return toTasklistDto(svc.Tasklists.patch({ title: params.title }, params.tasklistId));
}

function deleteTasklist(svc, params) {
  requireFields(params, ['tasklistId']);
  svc.Tasklists.remove(params.tasklistId);
  return { deleted: true, tasklistId: params.tasklistId };
}

function toTasklistDto(tl) {
  return { id: tl.id, title: tl.title, updated: tl.updated };
}

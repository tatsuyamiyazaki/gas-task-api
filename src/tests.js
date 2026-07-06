/**
 * GASエディタから実行する手動スモークテスト。
 * 一時タスクリストを作り、タスクを create→get→update→delete し、
 * 最後にタスクリストを削除して結果をログ出力する。
 * 実行にはこのプロジェクトのTasks Advanced Serviceが有効である必要がある。
 */
function smokeTest() {
  var created = handleRequest(Tasks, { action: 'createTasklist', title: 'SMOKE_' + new Date().getTime() });
  Logger.log('createTasklist: ' + JSON.stringify(created));
  var tasklistId = created.data.id;

  try {
    var task = handleRequest(Tasks, {
      action: 'createTask',
      tasklistId: tasklistId,
      title: 'スモークタスク',
      notes: 'メモ',
      due: '2026-07-10'
    });
    Logger.log('createTask: ' + JSON.stringify(task));
    var taskId = task.data.id;

    Logger.log('getTask: ' + JSON.stringify(handleRequest(Tasks, { action: 'getTask', tasklistId: tasklistId, taskId: taskId })));

    Logger.log('updateTask: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'updateTask', tasklistId: tasklistId, taskId: taskId, status: 'completed'
    })));

    Logger.log('listTasks: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'listTasks', tasklistId: tasklistId, showCompleted: true
    })));

    Logger.log('deleteTask: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'deleteTask', tasklistId: tasklistId, taskId: taskId
    })));
  } finally {
    Logger.log('deleteTasklist: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'deleteTasklist', tasklistId: tasklistId
    })));
  }
}

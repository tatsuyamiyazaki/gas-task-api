function requireFields(params, fields) {
  fields.forEach(function (field) {
    var value = params ? params[field] : undefined;
    assert(value !== undefined && value !== null && value !== '', 'VALIDATION', field + ' は必須です');
  });
}

function parseDue(dateStr) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), 'VALIDATION', 'due は YYYY-MM-DD 形式で指定してください');
  return dateStr + 'T00:00:00.000Z';
}

function formatDue(rfc3339) {
  if (!rfc3339) {
    return undefined;
  }
  return String(rfc3339).slice(0, 10);
}

function validateStatus(status) {
  assert(status === 'needsAction' || status === 'completed', 'VALIDATION', 'status は needsAction か completed を指定してください');
  return status;
}

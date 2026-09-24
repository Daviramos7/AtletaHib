export function classifyNotice(message: unknown): 'success' | 'error' {
  const text = String(message ?? '').toLowerCase();
  if (/não|erro|falh|inválid|invalid|error|failed|unable|permission/.test(text)) return 'error';
  return /salv[oa]|registrad|importad|iniciad|copiad|atualizad|concluíd|apagado|removid|gerado|adicionado|validado|^[+-]?\d+ ml de água/.test(text) ? 'success' : 'error';
}

export function noticeText(message: unknown): string {
  const text = String(message ?? '').trim();
  if (/failed to fetch|networkerror|load failed|network request/i.test(text)) {
    return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
  }
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos. Confira e tente novamente.';
  if (/jwt expired|invalid refresh token|refresh token not found/i.test(text)) return 'Sua sessão expirou. Entre novamente.';
  if (/PGRST\d+|SQLSTATE|violates .+ constraint|permission denied|row.level security|relation .+ does not exist|column .+ does not exist|schema cache|<html|eyJ[A-Za-z0-9_-]+\./i.test(text)) {
    return 'Não foi possível concluir a operação. Tente novamente; se persistir, confira a configuração do serviço.';
  }
  return text || 'Não foi possível concluir. Tente novamente.';
}

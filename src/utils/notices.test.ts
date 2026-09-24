import { describe, expect, it } from 'vitest';
import { classifyNotice, noticeText } from './notices';

describe('feedback de operações', () => {
  it('não confunde falha ao salvar com sucesso', () => {
    expect(classifyNotice('Não foi possível salvar o treino.')).toBe('error');
    expect(classifyNotice('Erro ao importar dados.')).toBe('error');
    expect(classifyNotice('Treino salvo.')).toBe('success');
    expect(classifyNotice('Cardio apagado.')).toBe('success');
  });
  it('explica falhas técnicas sem expor mensagens do banco', () => {
    expect(noticeText('PGRST116: query returned no rows')).not.toContain('PGRST');
    expect(noticeText('Failed to fetch')).toContain('conexão');
    expect(noticeText('Invalid login credentials')).toContain('senha');
  });
  it('preserva mensagens úteis de validação', () => {
    expect(noticeText('Informe a duração do cardio.')).toBe('Informe a duração do cardio.');
  });
});

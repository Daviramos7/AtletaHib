import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Copy, Download, Droplets, Dumbbell, Flame, Footprints, Moon, NotebookTabs, Scale, Target, TrendingUp, TriangleAlert } from 'lucide-react';
import { loadWeeklyReview } from '../services/analyticsService';

export default function WeeklyReviewView({ userId, profile, onError }) {
  const [review, setReview] = useState(null);
  const [days, setDays] = useState(7);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async (selectedDays = days) => {
    try {
      setReview(await loadWeeklyReview(userId, profile, selectedDays));
    } catch (err) {
      onError(err.message);
    }
  }, [days, onError, profile, userId]);

  useEffect(() => { load(days); }, [days, load]);

  if (!review) return <p>Carregando revisão...</p>;

  const report = review.ruleReport;
  const exportText = JSON.stringify(review.exportPayload, null, 2);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      onError('Relatório semanal copiado. Agora envie para o chat Analista Semanal.');
    } catch {
      onError('Não consegui copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  }

  function downloadExport() {
    const blob = new Blob([exportText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atleta-hibrido-relatorio-semanal-${review.exportPayload.period.start_date}_${review.exportPayload.period.end_date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="weekly-review-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Semana</p>
          <h2>Resumo inteligente da semana</h2>
          <p className="muted-text">Análise automática por regras claras: treino, cardio, sono, água, dieta e check-in.</p>
        </div>
        <div className="weekly-actions">
          <select className="date-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button className="ghost-btn" type="button" onClick={() => setShowExport((value) => !value)}>
            <Copy size={16} /> Exportar JSON
          </button>
        </div>
      </div>

      <section className={`panel weekly-score-panel ${report.tone}`}>
        <div className="weekly-score-main">
          <span className="score-badge">{report.score}</span>
          <div>
            <p className="eyebrow">Nota da janela</p>
            <h3>{report.label}</h3>
            <p>{report.summary}</p>
          </div>
        </div>
        <div className="rule-score-list">
          {report.rules.map((rule) => (
            <div className={`rule-score-item ${rule.status}`} key={rule.label}>
              <span>{rule.label}</span>
              <strong>{rule.points}/{rule.max}</strong>
            </div>
          ))}
        </div>
      </section>

      {showExport && (
        <section className="panel weekly-export-panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Exportação completa</p>
              <h3>JSON para o chat Analista Semanal</h3>
              <p className="muted-text">Inclui resumo, aderência diária, treinos, cardio, sono corrigido, dados do relógio, peso e check-ins.</p>
            </div>
            <div className="form-actions compact-actions">
              <button className="ghost-btn" type="button" onClick={copyExport}><Copy size={16} /> Copiar</button>
              <button className="ghost-btn" type="button" onClick={downloadExport}><Download size={16} /> Baixar</button>
            </div>
          </div>
          <textarea className="json-import-box weekly-export-box" value={exportText} readOnly />
        </section>
      )}

      <div className="metric-grid four">
        <Metric icon={Flame} label="Média kcal" value={review.avgKcal ? review.avgKcal.toFixed(0) : '--'} sub={`${review.mealLoggedDays}/${review.days} dias registrados`} />
        <Metric icon={Droplets} label="Água" value={`${review.waterHitDays}/${review.days}`} sub="dias batendo meta" />
        <Metric icon={Dumbbell} label="Musculação" value={review.workouts} sub={`${review.strengthSets ?? 0} séries · ${(review.strengthVolume ?? 0).toFixed(0)} kg`} />
        <Metric icon={Footprints} label="Cardio" value={`${review.totalKm.toFixed(2)} km`} sub={`${review.runs} sessões`} />
      </div>

      <div className="metric-grid four">
        <Metric icon={Moon} label="Sono médio" value={review.avgSleepHours ? `${review.avgSleepHours.toFixed(1)}h` : '--'} sub={`${review.sleepDays ?? 0}/${review.days} dias com sono`} />
        <Metric icon={Footprints} label="Passos médios" value={review.avgSteps ? Math.round(review.avgSteps) : '--'} sub={`${review.stepDays ?? 0}/${review.days} dias com passos`} />
        <Metric icon={NotebookTabs} label="Check-ins" value={`${review.checkinDays}/${review.days}`} sub="dias com prontidão" />
        <Metric icon={Scale} label="Peso" value={review.latestWeight ? `${Number(review.latestWeight.weight_kg).toFixed(1)} kg` : '--'} sub={review.weightChange !== null ? `${review.weightChange >= 0 ? '-' : '+'}${Math.abs(review.weightChange).toFixed(1)} kg na janela` : 'sem tendência'} />
      </div>

      <section className="panel highlight-panel">
        <div className="review-decision">
          <BarChart3 size={34} />
          <div>
            <p className="eyebrow">Próxima decisão</p>
            <h3>{review.decision.title}</h3>
            <p>{review.decision.body}</p>
          </div>
        </div>
      </section>

      <div className="rule-report-grid">
        <section className="panel report-card good">
          <p className="eyebrow">Pontos fortes</p>
          {report.strengths.length === 0 ? (
            <p className="muted-text">Ainda não há dados suficientes para cravar pontos fortes.</p>
          ) : (
            <div className="clean-list">
              {report.strengths.map((item) => <Insight key={item.title} icon={CheckCircle2} title={item.title} text={item.body} />)}
            </div>
          )}
        </section>

        <section className="panel report-card warning">
          <p className="eyebrow">O que precisa melhorar</p>
          {report.improvements.length === 0 ? (
            <p className="muted-text">Nenhum ponto crítico detectado pelas regras atuais.</p>
          ) : (
            <div className="clean-list">
              {report.improvements.map((item) => <Insight key={item.title} icon={TriangleAlert} title={item.title} text={item.body} />)}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Plano objetivo para a próxima semana</p>
        <div className="next-focus-list">
          {report.nextWeekFocus.map((item, index) => (
            <div key={item}>
              <strong>{index + 1}</strong>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Aderência diária</p>
        <div className="adherence-grid">
          {review.daysData.map((day) => (
            <div className="adherence-day" key={day.date}>
              <strong>{formatDate(day.date)}</strong>
              <span className={day.kcalHit ? 'ok' : ''}>Kcal {day.kcal ? day.kcal : '--'}</span>
              <span className={day.waterHit ? 'ok' : ''}>Água {day.water ? `${day.water}ml` : '--'}</span>
              <span className={day.sleepHours >= 6 ? 'ok' : day.sleepHours > 0 ? 'bad' : ''}>Sono {day.sleepHours ? `${day.sleepHours.toFixed(1)}h` : '--'}</span>
              <span className={day.readiness.score >= 70 ? 'ok' : day.readiness.score < 55 ? 'bad' : ''}>Prontidão {day.hasCheckin ? day.readiness.score : '--'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Critérios usados</p>
        <div className="rules-explainer">
          <span><Target size={16} /> Dieta: registrar a maioria dos dias vale mais do que perfeição.</span>
          <span><Dumbbell size={16} /> Força: meta mínima proporcional a 3 treinos por semana.</span>
          <span><Footprints size={16} /> Cardio: meta inicial de 2 a 3 sessões curtas por semana.</span>
          <span><Moon size={16} /> Sono: abaixo de 6h liga alerta; 7h ou mais é bom.</span>
          <span><TrendingUp size={16} /> Peso: tendência vale mais que um dia isolado.</span>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }) {
  return <div className="small-metric"><span><Icon size={15} /> {label}</span><strong>{value}</strong><p>{sub}</p></div>;
}

function Insight({ icon: Icon, title, text }) {
  return <div className="insight-card"><Icon size={18} /><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MEALS } from '../data/defaultPlan';
import { addMeal, deleteMeal, listCustomFoods, listMeals, saveCustomFood, searchFoodLocally } from '../services/mealService';
import { todayKey } from '../services/dailyService';
import { ConfirmDialog, MetricCard, PageHeader } from './ui';

export default function DietView({ userId, profile, onError }) {
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ meal_type: 'almoco', food_name: '', grams: '', kcal_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '', save_food: true });

  const load = useCallback(async () => {
    try {
      const [mealData, foodData] = await Promise.all([listMeals(userId, date), listCustomFoods(userId)]);
      setItems(mealData);
      setCustomFoods(foodData);
    } catch (err) {
      onError(err.message);
    }
  }, [date, onError, userId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => items.reduce((acc, item) => ({
    kcal: acc.kcal + Number(item.kcal || 0),
    protein: acc.protein + Number(item.protein_g || 0),
    carbs: acc.carbs + Number(item.carbs_g || 0),
    fat: acc.fat + Number(item.fat_g || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [items]);
  const macrosComplete = items.length > 0 && items.every((item) => item.protein_g != null && item.carbs_g != null && item.fat_g != null);

  const suggestions = searchFoodLocally(form.food_name, customFoods);

  async function handleAdd(event) {
    event.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      const grams = parsePositiveNumber(form.grams);
      const kcal100 = parseRequiredNonNegativeNumber(form.kcal_per_100g);
      const protein100 = parseOptionalNonNegativeNumber(form.protein_per_100g);
      const carbs100 = parseOptionalNonNegativeNumber(form.carbs_per_100g);
      const fat100 = parseOptionalNonNegativeNumber(form.fat_per_100g);

      if (!form.food_name.trim()) throw new Error('Informe o nome do alimento.');
      if (grams === null) throw new Error('Informe gramas válidas acima de zero.');
      if (kcal100 === null) throw new Error('Informe as calorias por 100 g.');

      const factor = grams / 100;
      await addMeal(userId, {
        log_date: date,
        meal_type: form.meal_type,
        food_name: form.food_name.trim(),
        grams,
        kcal: Math.round(kcal100 * factor),
        protein_g: scaleOptionalMacro(protein100, factor),
        carbs_g: scaleOptionalMacro(carbs100, factor),
        fat_g: scaleOptionalMacro(fat100, factor),
      });

      if (form.save_food) {
        await saveCustomFood(userId, {
          name: form.food_name.trim(),
          kcal_per_100g: Math.round(kcal100),
          protein_per_100g: protein100,
          carbs_per_100g: carbs100,
          fat_per_100g: fat100,
        });
      }

      setForm((old) => ({ ...old, food_name: '', grams: '', kcal_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '' }));
      await load();
      onError('Alimento registrado.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      setDeleting(true);
      await deleteMeal(userId, id);
      await load();
      setPendingDelete(null);
      onError('Alimento excluído.');
    } catch (err) {
      onError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function applySuggestion(food) {
    setForm((old) => ({
      ...old,
      food_name: food.name,
      kcal_per_100g: food.kcal_per_100g,
      protein_per_100g: food.protein_per_100g ?? '',
      carbs_per_100g: food.carbs_per_100g ?? '',
      fat_per_100g: food.fat_per_100g ?? '',
    }));
  }

  return (
    <div>
      <PageHeader
        title="Comida"
        action={<input aria-label="Data dos registros alimentares" className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      />

      <div className="metric-grid four">
        <MetricCard label="Kcal" value={items.length ? totals.kcal : '—'} detail={`meta ${profile?.kcal_goal ?? 2300}`} />
        <MetricCard label="Proteína" value={formatMacroTotal(totals.protein, items.filter((item) => item.protein_g != null).length, macrosComplete)} detail={!items.length ? 'sem registros' : macrosComplete ? 'total registrado' : 'total parcial'} />
        <MetricCard label="Carboidratos" value={formatMacroTotal(totals.carbs, items.filter((item) => item.carbs_g != null).length, macrosComplete)} detail={!items.length ? 'sem registros' : macrosComplete ? 'total registrado' : 'total parcial'} />
        <MetricCard label="Gordura" value={formatMacroTotal(totals.fat, items.filter((item) => item.fat_g != null).length, macrosComplete)} detail={!items.length ? 'sem registros' : macrosComplete ? 'total registrado' : 'total parcial'} />
      </div>

      <form className="panel form-grid" onSubmit={handleAdd}>
        <label>Refeição
          <select value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })}>
            {MEALS.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
          </select>
        </label>
        <label>Alimento
          <input value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} placeholder="Ex.: arroz cozido" required />
        </label>
        {suggestions.length > 0 && form.food_name && (
          <div className="suggestions full" aria-label="Alimentos salvos">
            {suggestions.map((food) => <button type="button" key={food.id ?? food.name} onClick={() => applySuggestion(food)}>{food.name}<span>{food.kcal_per_100g} kcal/100 g</span></button>)}
          </div>
        )}
        <label>Peso da porção (g)
          <input type="number" inputMode="decimal" min="0.1" step="0.1" value={form.grams} onChange={(e) => setForm({ ...form, grams: e.target.value })} required />
        </label>
        <label>Calorias por 100 g
          <input type="number" inputMode="decimal" min="0" step="0.1" value={form.kcal_per_100g} onChange={(e) => setForm({ ...form, kcal_per_100g: e.target.value })} required />
        </label>
        <details className="full disclosure-panel">
          <summary>Macros por 100 g (opcional)</summary>
          <div className="form-section-grid">
        <label>Proteína (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={form.protein_per_100g} onChange={(e) => setForm({ ...form, protein_per_100g: e.target.value })} />
        </label>
        <label>Carboidratos (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={form.carbs_per_100g} onChange={(e) => setForm({ ...form, carbs_per_100g: e.target.value })} />
        </label>
        <label>Gordura (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={form.fat_per_100g} onChange={(e) => setForm({ ...form, fat_per_100g: e.target.value })} />
        </label>
          </div>
          <p className="field-hint-v401">Deixe em branco os valores que não souber.</p>
        </details>
        <label className="check-row">
          <input type="checkbox" checked={form.save_food} onChange={(e) => setForm({ ...form, save_food: e.target.checked })} /> Salvar para usar novamente
        </label>
        <button className="primary-btn" disabled={saving}><Plus size={16} /> {saving ? 'Registrando…' : 'Registrar alimento'}</button>
      </form>

      <div className="panel">
        <p className="eyebrow">Registros do dia</p>
        {!items.length && <p className="muted">Nenhum alimento registrado nesta data.</p>}
        {MEALS.filter((meal) => items.some((item) => item.meal_type === meal.id)).map((meal) => {
          const mealItems = items.filter((item) => item.meal_type === meal.id);
          const subtotal = mealItems.reduce((sum, item) => sum + Number(item.kcal), 0);
          return (
            <div key={meal.id} className="meal-group">
              <div className="meal-head"><strong>{meal.name}</strong><span>{subtotal} kcal</span></div>
              {mealItems.length === 0 ? <p className="muted">Nenhum registro.</p> : mealItems.map((item) => (
                <div className="entry-row" key={item.id}>
                  <div><strong>{item.food_name}</strong><span>{item.grams == null ? 'Peso não informado' : `${Number(item.grams)} g`} · {item.kcal ?? '—'} kcal · {mealSourceLabel(item)}{item.confidence === 'estimated' || String(item.source).includes('_ai') ? ' · estimado' : ''}</span></div>
                  <button className="icon-btn danger" type="button" aria-label={`Excluir ${item.food_name}`} onClick={() => setPendingDelete(item)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Excluir alimento?" description={pendingDelete?.food_name} confirmLabel="Excluir" danger busy={deleting} onCancel={() => setPendingDelete(null)} onConfirm={() => handleDelete(pendingDelete.id)} />
    </div>
  );
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRequiredNonNegativeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalNonNegativeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function scaleOptionalMacro(value: number | null, factor: number) {
  return value === null ? null : Number((value * factor).toFixed(1));
}

function formatMacroTotal(value: number, itemCount: number, complete: boolean) {
  if (!itemCount) return '--';
  return `${value.toFixed(0)}g${complete ? '' : ' conhecidos'}`;
}

function mealSourceLabel(item: any) {
  const method = String(item?.import_method ?? item?.source ?? 'manual').toLowerCase();
  return method.includes('json') ? 'JSON' : 'manual';
}
